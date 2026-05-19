# WealthLens — Developer Guide

This document covers the architecture, technical decisions, coding standards, and project learnings for WealthLens — a personal finance tracking and scenario simulation platform.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Organization](#project-organization)
3. [Architecture Overview](#architecture-overview)
4. [Database Schema](#database-schema)
5. [Key Technical Decisions](#key-technical-decisions)
6. [Coding Standards](#coding-standards)
7. [Supabase Edge Functions](#supabase-edge-functions)
8. [Authentication & Permissions](#authentication--permissions)
9. [Simulation Engine](#simulation-engine)
10. [External APIs](#external-apis)
11. [Project Learnings](#project-learnings)
12. [Future Enhancements](#future-enhancements)

---

## Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend framework | React 19 + TypeScript | Vite build tool |
| Styling | Tailwind CSS v4 | CSS-first config (`@theme` in CSS, no `tailwind.config.js`) |
| UI components | shadcn/ui v4 (Base UI) | **Not Radix UI** — see [Key Decisions](#key-technical-decisions) |
| Charts | Recharts | `ComposedChart` used for overlay lines on area charts |
| Drag & drop | @dnd-kit | Separate contexts per column; `verticalListSortingStrategy` for panels, `rectSortingStrategy` for portfolio cards |
| Backend / Database | Supabase (PostgreSQL) | Row Level Security enforced; untyped client (see [Key Decisions](#key-technical-decisions)) |
| Auth | Supabase Auth | Email/password only |
| Edge Functions | Supabase Edge Functions (Deno) | Price refresh + EOD snapshot + alert checks |
| Email notifications | Resend API | Free tier: 3,000 emails/month |
| SMS notifications | Twilio | Pay-per-SMS; `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| Price data | Twelve Data API | US equities + crypto; 8 symbols/minute free tier |
| Currency conversion | open.er-api.com + Frankfurter fallback | 4-hour localStorage cache; 8-second timeout |
| Excel export | SheetJS (`xlsx`) | Write-only usage; parser CVE does not apply |
| Router | React Router v6 | File-based pages, no lazy loading |

---

## Project Organization

```
src/
  components/
    charts/          # Recharts wrappers (AllocationChart, NetWorthChart,
    |                  MonteCarloChart, HistoricalSimChart, ScenarioResultsChart)
    forms/           # Reusable form primitives (NumericInput, SelectField)
    layout/          # AppLayout (sidebar + outlet), WealthLensLogo
    ui/              # shadcn/ui generated components
  features/
    auth/            # AuthContext, AuthGuard, GrantContext, GrantGuard, OwnerPicker
    dashboard/       # NetWorthSummary, PortfolioBreakdown
    goals/           # GoalCard, GoalForm
    holdings/        # AssetTypeBadge, HoldingForm, HoldingsList
    portfolios/      # PortfolioCard, PortfolioForm
    scenarios/       # ScenarioConfigPanel, ScenarioEventList, FutureContributionsList,
    |                  YearRateOverrideList, HoldingSourcePicker, ScenarioForm
    settings/        # ProfileForm, PreferencesForm, PermissionsPanel
  hooks/             # All data-fetching hooks (one per domain), incl. useAlerts
  lib/               # Utilities: simulation, currency, export, formatters, permissions
  pages/             # Route-level page components (one per route), incl. Alerts.tsx
  types/             # TypeScript interfaces (holding.ts, scenario.ts, portfolio.ts)

supabase/
  migrations/        # Numbered SQL migrations (001–012)
  functions/
    refresh-prices/         # Edge Function: batch price fetch from Twelve Data
    market-close-snapshot/  # Edge Function: EOD portfolio snapshot + stock_price_history write
    check-alerts/           # Edge Function: evaluate alert rules, send Resend email + Twilio SMS

docs/                # User Guide + Developer Guide
```

### Naming Conventions

- **Pages** — `PascalCase.tsx` in `src/pages/`, one per route.
- **Feature components** — `PascalCase.tsx` in `src/features/<domain>/`.
- **Hooks** — `use<Domain>.ts` in `src/hooks/`.
- **Utilities** — `camelCase.ts` in `src/lib/`.
- **Types** — `camelCase.ts` in `src/types/`.

---

## Architecture Overview

```
Browser
  └─ React SPA (Vite)
       ├─ AuthContext         → Supabase Auth session
       ├─ GrantContext        → viewer mode detection (effectiveUserId)
       ├─ Route pages         → consume hooks, render UI
       ├─ Hooks               → Supabase JS queries (RLS-filtered)
       └─ lib/simulation.ts   → pure TS, no network calls

Supabase
  ├─ Auth                    → email/password
  ├─ PostgreSQL + RLS        → per-user + grantee data isolation
  ├─ Edge Functions (Deno)   → price refresh, EOD snapshot, alert checks
  └─ pg_cron + pg_net        → scheduled Edge Function invocations

External
  ├─ Twelve Data API         → stock/ETF/crypto prices
  ├─ Resend API              → email notifications
  ├─ Twilio API              → SMS notifications
  ├─ open.er-api.com         → currency exchange rates
  └─ Frankfurter (fallback)  → exchange rates backup
```

### Data Flow

1. User logs in → `AuthContext` stores Supabase session.
2. `GrantContext` checks `access_grants` table — sets `effectiveUserId` (owner's ID if viewer, own ID if owner).
3. All data hooks query Supabase using `effectiveUserId`. RLS policies enforce access server-side.
4. Simulation runs entirely client-side from fetched config — no server round-trip for projections.
5. Edge Functions (cron-triggered) write price updates and snapshots to the database; clients re-fetch on demand.

---

## Database Schema

### Tables

| Table | Purpose |
|-------|---------|
| `profiles` | User display name, currency, date format. PK = `auth.users.id` (column name: `id`, not `user_id`) |
| `portfolios` | Portfolio metadata. Has `user_id`, `sort_order`, `is_active` |
| `holdings` | Individual assets. Has `symbol`, `last_price_updated_at` for auto-refresh |
| `portfolio_snapshots` | Point-in-time **equity** values per portfolio. `portfolio_id` is nullable (SET NULL on portfolio deletion — preserves history). Has `currency` column stored at save time. Unique on `(portfolio_id, snapshot_date)` |
| `scenarios` | Scenario metadata. Has `user_id` |
| `scenario_configs` | One row per scenario. All simulation parameters |
| `scenario_events` | One-off events (contribution/withdrawal/shock/rebalance). Has `linked_sources` JSONB |
| `scenario_future_contributions` | Recurring future income streams |
| `scenario_year_rate_overrides` | Per-year or per-range growth/inflation overrides |
| `goals` | Financial targets linked to portfolios and/or scenarios |
| `access_grants` | Read-only page grants from owner to grantee (viewer mode) |
| `alert_rules` | User-configured alert conditions. Has `alert_type`, `direction`, `amount_type`, cooldown fields, `last_triggered_at` |
| `stock_price_history` | EOD closing price per symbol per day. Written by `market-close-snapshot`. Unique on `(symbol, date)`. Used as the previous-close baseline for stock alert checks |

### JSONB Columns

- `holdings.metadata` — asset-type-specific data (mortgage balance, exchange, sector, etc.)
- `scenario_configs.starting_value_sources` — array of `HoldingSource` (portfolioId, holdingId, pct, snapshot)
- `scenario_events.linked_sources` — same `HoldingSource` structure for contribution events

### Migrations

Migrations are numbered sequentially in `supabase/migrations/`:

| File | Change |
|------|--------|
| `001_initial_schema.sql` | All core tables, RLS policies, GRANTs to `authenticated` |
| `002_portfolio_sort_order.sql` | `sort_order` on portfolios |
| `003_scenario_enhancements.sql` | `withdrawal_inflation_adjusted`, future contributions, goals |
| `004_monte_carlo.sql` | `volatility_pct` on scenario_configs |
| `005_portfolio_selloff.sql` | Starting value source columns (superseded by 006) |
| `006_multi_holding_sources.sql` | JSONB `starting_value_sources`, `linked_sources` (replaces 005 columns) |
| `007_drop_old_holding_columns.sql` | Drops columns added in 005 |
| `008_year_rate_overrides.sql` | `scenario_year_rate_overrides` table |
| `009_price_refresh.sql` | `last_price_updated_at` on holdings, enables `pg_cron` + `pg_net` |
| `010_service_role_grants.sql` | Explicit GRANTs to `service_role` for Edge Function access |
| `011_access_grants.sql` | `access_grants` table, trigger, grantee RLS policies |
| `012_alerts.sql` | `alert_rules` + `stock_price_history` tables, RLS, service_role grants |
| `013_snapshot_currency.sql` | `portfolio_snapshots`: adds `currency` column, changes FK from `CASCADE → SET NULL` (preserves history on portfolio deletion), backfills currency from current portfolio rows |

### RLS Approach

All tables use Row Level Security. The general pattern:

```sql
-- Owner access (full CRUD)
create policy "Users can manage their own X"
  on public.X for all
  using (auth.uid() = user_id);

-- Grantee access (SELECT only, added in migration 011)
create policy "Grantees read X"
  on public.X for select
  using (has_page_grant(user_id, 'page_name'));
```

The helper function `has_page_grant(owner_id, page)` checks the `access_grants` table.

**Critical:** `profiles` uses `id` (not `user_id`) as its primary key — grantee RLS on profiles must reference `profiles.id`, not `profiles.user_id`.

**service_role grants:** Edge Functions use the `service_role` key, which bypasses RLS but still requires explicit PostgreSQL table-level `GRANT`. These are in migration 010. Any new table used by Edge Functions needs a corresponding `GRANT ... TO service_role`.

---

## Key Technical Decisions

### 1. shadcn/ui v4 uses Base UI, not Radix UI

shadcn/ui v4 switched from `@radix-ui/react-*` to `@base-ui/react`. This has two important implications:

- **`asChild` is not supported.** Do not use `asChild` on any shadcn component — it does not exist in Base UI and causes TypeScript errors.
- **`SelectValue` does not auto-display labels.** Base UI's `SelectValue` shows the raw `value` string (e.g. `"stock"` instead of `"Stock"`). Always use the `SelectField` wrapper component at `src/components/forms/SelectField.tsx`, which computes and renders the label from an options array.

### 2. Untyped Supabase Client

The hand-written `src/types/database.ts` lacks the `Relationships` field required by `createClient<Database>`. Using the generic resolves queries to `never`.

**Pattern:** Use `createClient(url, key)` (no generic) in `src/lib/supabase.ts`. Cast all query results in hooks:

```typescript
const { data } = await supabase.from('portfolios').select('*')
const portfolios = (data ?? []) as unknown as Portfolio[]
```

To fix properly: run `npx supabase gen types typescript --project-id <id>` to generate accurate types.

### 3. NumericInput Component

HTML `<input type="number">` bound to a numeric React state cannot be cleared to empty (snaps back to the bound value). All currency and quantity fields use `src/components/forms/NumericInput.tsx`, which:

- Uses `type="text"` with `inputMode="decimal"`
- Manages raw display string internally
- Formats with commas on blur

Never use `<Input type="number">` for currency or quantity fields.

### 4. Simulation Engine is Pure TypeScript

`src/lib/simulation.ts` has no network calls, no Supabase access, and no React dependencies. It exports three pure functions:

- `runSimulation(input)` — deterministic year-by-year projection
- `runMonteCarlo(input, iterations)` — Box-Muller normal distribution, 1,000 iterations default
- `runHistoricalSimulation(input)` — S&P 500 rolling windows 1926–2024

All three run synchronously on the client. Monte Carlo with 1,000 iterations completes in under 200ms on modern hardware.

### 5. Real Estate Equity

`src/lib/holdings.ts` exports `computeEffectiveValue(holding)`:

```typescript
// Real estate: equity = current_value - mortgage_balance - heloc_balance
// All other types: equity = current_value
```

The **Net Worth** stat uses equity (true wealth). **Gain/Loss** uses gross appreciation (current_value − cost_basis) for all asset types.

### 6. GrantContext for Viewer Mode

`src/features/auth/GrantContext.tsx` provides the viewer/owner abstraction:

- `effectiveUserId` — the user whose data to fetch (own ID for owners, owner's ID for viewers).
- `isViewer` — true when logged in as a grantee with at least one grant.
- `grantedPages` — pages the viewer is allowed to access.

All data hooks (`usePortfolios`, `useNetWorth`, `useScenarios`, `useGoals`) use `effectiveUserId` for their queries. This, combined with server-side RLS, ensures viewers only see what they're permitted to see.

### 7. Currency Conversion

`src/lib/currency.ts`:

- Primary source: `https://open.er-api.com/v6/latest/${base}`
- Fallback: `https://api.frankfurter.app/latest?base=${base}`
- 8-second `AbortController` timeout on each request
- 4-hour localStorage cache keyed by base currency
- `convert(amount, from, to, rates)` — returns amount unchanged if rates are unavailable

### 8. Portfolio Snapshots — Equity, Currency, and Deletion Safety

Three design decisions govern `portfolio_snapshots`:

**Store equity, not gross value.** `total_value` stores equity (real estate deducts `mortgage_balance + heloc_balance`) so the Net Worth Over Time chart matches the Dashboard stat card exactly. Both the manual "Take Snapshot" button (`useSnapshots.takeSnapshot`) and the EOD cron (`market-close-snapshot`) apply the same equity computation as `computeEffectiveValue()` in `src/lib/holdings.ts`.

**Store currency at save time.** The `currency` column is written when the snapshot is taken and never updated. This makes the chart aggregation self-contained — it converts using `snapshot.currency` rather than looking up the live portfolio, so deleted portfolios still contribute correctly to historical totals.

**SET NULL on portfolio deletion.** The FK changed from `ON DELETE CASCADE` (migration 013) to `ON DELETE SET NULL`. Deleting a portfolio no longer wipes its history — `portfolio_id` becomes NULL, but the row and its `total_value`/`currency` are preserved. The chart query filters by active `portfolioIds`, so orphaned rows are excluded from the live view but remain in the database for potential future analysis.

> **Pre-migration-013 snapshots** stored gross value without currency. These can be deleted manually via the Supabase SQL Editor or — once built — via the Snapshot Management UI in the backlog.

### 9. Page Constants for Granted Access

`src/lib/permissions.ts` defines `GRANTABLE_PAGES` as a `const` array. Adding a new page to the permission system requires only adding one entry here. Existing grants default to **No Access** for any new page added — they must be explicitly re-granted.

---

## Coding Standards

### General

- **ES modules** (`import`/`export`), never CommonJS (`require`).
- **`async`/`await`** over `.then()` chains.
- **2-space indentation** throughout.
- **Descriptive variable names** — no single letters except loop counters.

### Comments

- Only comment the **WHY** — hidden constraints, non-obvious invariants, workarounds for specific bugs.
- Do not comment what the code does (well-named identifiers handle that).
- No multi-paragraph docstrings or multi-line comment blocks.

### React Patterns

- One hook per data domain in `src/hooks/`.
- Hooks expose a `refetch` function — use it instead of `window.location.reload()` after mutations.
- Hooks use `useCallback` with the correct dependency array. Never depend on `user` when `effectiveUserId` is available.
- Derived values (e.g. `isViewer = grants.length > 0`) are computed inline from state — not stored as additional state.

### Forms

- Use `NumericInput` for all numeric fields (currency, percentages, quantities).
- Use `SelectField` for all dropdown selects.
- Validate at the form level before calling API. Don't add validation for impossible scenarios.

### Security

- Never put API keys, secrets, or tokens in source code.
- Supabase anon key (public) goes in `.env.local` → `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`.
- Service role key goes in Supabase Edge Function secrets only — never in frontend code or committed files.
- Add `.env*` and `supabase/setup_cron.sql` to `.gitignore` before first commit.

---

## Supabase Edge Functions

Three Edge Functions live in `supabase/functions/`:

### `refresh-prices`

Fetches latest prices from Twelve Data and updates `holdings.current_value`.

**Key behaviours:**
- Uses two explicit queries (never-refreshed holdings first, then oldest-refreshed) to rotate fairly through all symbols — avoids the `nullsFirst` bug in supabase-js edge function environments.
- Caps at 8 symbols per call (Twelve Data free tier: 8 credits/minute).
- Batch-upserts all updated holdings in a single round-trip.
- Crypto symbols are appended with `/USD` (e.g. `BTC` → `BTC/USD`) before the API call.
- Debug mode removed for security — the function previously exposed cross-user portfolio composition via `?debug=true`.

**Deployment:**
```bash
npx supabase functions deploy refresh-prices --no-verify-jwt
```

`--no-verify-jwt` is required and must be re-passed on every redeploy (Supabase resets this flag).

### `market-close-snapshot`

Takes an end-of-day portfolio snapshot for all portfolios, and records the closing price per symbol.

**Key behaviours:**
- Does NOT call `refresh-prices` — relies on the 15-minute cron having kept prices current.
- Fetches all portfolios with their holdings in a single JOIN query.
- Upserts into `portfolio_snapshots` with `onConflict: 'portfolio_id,snapshot_date'` — safe to run multiple times per day.
- **Also writes to `stock_price_history`** — derives closing price as `current_value / quantity` for each symbol, upserted with `onConflict: 'symbol,date'`. This provides the previous-close baseline for `check-alerts`.

**Deployment:**
```bash
npx supabase functions deploy market-close-snapshot --no-verify-jwt
```

### `check-alerts`

Evaluates all active alert rules and fires Resend email and/or Twilio SMS notifications when thresholds are crossed.

**Key behaviours:**
- Fetches all active `alert_rules` across all users via service role.
- **Stock alerts:** fetches current prices from Twelve Data (up to 8 symbols, same rotation cap); compares against the most recent `stock_price_history` entry within the past 5 days (to handle weekends/holidays).
- **Portfolio alerts:** sums `holdings.current_value` for the monitored portfolio; compares against the most recent `portfolio_snapshots` entry before today.
- Respects per-alert cooldown (`cooldown_value` + `cooldown_unit`); skips if `last_triggered_at + cooldown > now()`.
- Updates `last_triggered_at` after each successful trigger.
- Runs 7 minutes after `refresh-prices` each cycle (`7-59/15`) to avoid Twelve Data rate limit collisions.

**Required secrets:** `RESEND_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

**Deployment:**
```bash
npx supabase functions deploy check-alerts --no-verify-jwt
```

### CORS Headers

Both functions must include these CORS headers to work from the browser (pg_net/cron calls don't require CORS, but the manual Refresh Prices button does):

```typescript
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
```

Missing `x-client-info` or `apikey` causes a silent preflight failure from the browser.

### Cron Schedule

Set up via `pg_cron` + `pg_net` in the Supabase SQL Editor (see `supabase/setup_cron.sql` after replacing credentials):

| Job | Schedule | UTC time | ET equivalent |
|-----|----------|----------|---------------|
| `wealthlens-refresh-prices` | `*/15 14-21 * * 1-5` | Every 15 min, 14:00–21:00 UTC, weekdays | 9 AM–4 PM ET |
| `wealthlens-check-alerts` | `7-59/15 14-21 * * 1-5` | Every 15 min offset by 7 min, weekdays | Runs at :07, :22, :37, :52 past each hour |
| `wealthlens-market-close-snapshot` | `30 21 * * 1-5` | 21:30 UTC, weekdays | 4:30 PM EST / 5:30 PM EDT |

The 7-minute offset on `check-alerts` prevents it from making Twelve Data API calls in the same minute as `refresh-prices`, avoiding rate limit collisions on the free tier.

---

## Authentication & Permissions

### Auth Flow

1. User registers/logs in via Supabase Auth.
2. `AuthContext` stores the session and exposes `user`, `session`, `signOut`.
3. `AuthGuard` wraps all protected routes — redirects to `/login` if no session.
4. `GrantContext` (inside `AuthProvider`) queries `access_grants` for the logged-in user's email and populates `effectiveUserId`, `isViewer`, `grantedPages`.

### Viewer Mode

When a viewer logs in:

1. `GrantContext` finds their `grantee_id` in `access_grants`.
2. `effectiveUserId` is set to the `owner_id`.
3. All hooks query using `effectiveUserId` — they fetch the owner's data.
4. RLS `FOR SELECT` policies (added in migration 011) permit this read via `has_page_grant()`.
5. `GrantGuard` on each route checks `grantedPages` — non-granted routes redirect to the first granted page.
6. UI hides all add/edit/delete controls when `isViewer = true`.

**Security model:** RLS enforces read-only at the database level regardless of UI state. Viewers cannot write to any table — there are no grantee `FOR INSERT/UPDATE/DELETE` policies.

### Auto-Link Trigger

When a new user signs up, the `link_grants_on_signup()` trigger fires:

```sql
UPDATE access_grants
SET grantee_id = NEW.id
WHERE grantee_email = NEW.email AND grantee_id IS NULL;
```

This connects pending grants to the new account automatically — no manual step required.

---

## Simulation Engine

`src/lib/simulation.ts` implements three simulation modes. All are synchronous, pure functions with no side effects.

### Rate Resolution (`resolveRates`)

For deterministic simulations, `resolveRates(year, overrides, baseReturn, baseInflation)`:
- Single-year overrides (`to_year === null`) take precedence over ranges.
- Falls back to flat config rates when no override matches.

### Monte Carlo (Box-Muller)

```typescript
// Box-Muller transform: uniform → normal distribution
const u1 = Math.max(Math.random(), 1e-10)
const u2 = Math.random()
const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
const yearReturn = mean + stdDev * z
```

Year-rate overrides are applied deterministically (no randomisation) even in Monte Carlo mode.

### Historical Returns

`src/lib/historicalReturns.ts` contains S&P 500 annual returns from 1926 to 2024 (99 data points). The simulation runs one path per possible starting year, producing ~70+ rolling windows for a 30-year horizon.

---

## External APIs

### Twelve Data

- **Endpoint:** `https://api.twelvedata.com/price?symbol=AAPL,SPY&apikey=KEY`
- **Response (single symbol):** `{ "price": "150.25" }`
- **Response (multiple symbols):** `{ "AAPL": { "price": "150.25" }, "SPY": { "price": "450.00" } }`
- **Crypto format:** Use `BTC/USD`, `ETH/USD` — ticker + `/USD`.
- **Rate limit:** 8 API credits/minute on free tier (1 credit per symbol in a batch request).
- **Key storage:** Supabase Edge Function secret `TWELVE_DATA_API_KEY`.

### Resend (Email Notifications)

- **Endpoint:** `POST https://api.resend.com/emails`
- **Auth:** `Authorization: Bearer <RESEND_API_KEY>`
- **From address:** `WealthLens <onboarding@resend.dev>` (free Resend sender; swap for custom domain when ready)
- **Free tier:** 3,000 emails/month, 100/day
- **Key storage:** Supabase Edge Function secret `RESEND_API_KEY`

### Twilio (SMS Notifications)

- **Endpoint:** `POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json`
- **Auth:** HTTP Basic (`TWILIO_ACCOUNT_SID:TWILIO_AUTH_TOKEN` base64-encoded)
- **Body format:** `application/x-www-form-urlencoded` with `To`, `From`, `Body` fields
- **Phone format:** E.164 international format (e.g. `+14155552671`)
- **Trial limitation:** On the free trial, SMS can only be sent to numbers verified in the Twilio Console
- **Key storage:** Supabase Edge Function secrets `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`

### Exchange Rates

- **Primary:** `https://open.er-api.com/v6/latest/${base}` — free, no key required, reliable.
- **Fallback:** `https://api.frankfurter.app/latest?base=${base}` — triggered if primary times out.
- **Cache:** 4 hours in `localStorage` keyed as `fx_rates_${currency}_${datestamp}`.
- **Timeout:** 8 seconds via `AbortController`.

---

## Project Learnings

These are hard-won lessons from building WealthLens. Each caused at least one debugging session.

### shadcn / Base UI

- `SelectValue` shows raw value, not label. Always use `SelectField`.
- `asChild` prop does not exist in Base UI components.

### Supabase

- **`service_role` is not a superuser.** It has `BYPASSRLS` but still needs explicit `GRANT ... TO service_role` for table access. Every new table used by Edge Functions needs one.
- **`profiles.id` not `profiles.user_id`.** The profiles table uses `id` as its PK (mirrors auth.users). All other tables use a separate `user_id` FK column.
- **`NULLS FIRST` in supabase-js edge functions.** The `{ nullsFirst: true }` option in `.order()` is unreliable in the Deno runtime. Use two explicit queries: one for `IS NULL`, one for oldest non-null.
- **service_role key in pg_cron.** Storing the service role key in cron SQL (pg_cron.job table) stores it in plaintext. Deploy Edge Functions with `--no-verify-jwt` to avoid needing the key in cron jobs at all.

### Edge Functions

- **Import specifier:** Use `https://esm.sh/@supabase/supabase-js@2` not `npm:@supabase/supabase-js@2`. The `npm:` specifier is unreliable in Supabase's Deno runtime.
- **Server-side client options:** Always pass `auth: { autoRefreshToken: false, persistSession: false }` when creating a Supabase client in Edge Functions. Without this, the client tries to use `localStorage` (unavailable in Deno) and falls back to a lower-privilege role.
- **CORS for browser callers.** Include `x-client-info` and `apikey` in `Access-Control-Allow-Headers`. Missing these causes silent preflight failures from the browser (cron/pg_net callers are unaffected).
- **`--no-verify-jwt` resets on every deploy.** Always append the flag when redeploying.
- **Debug pattern.** Never use bare `catch` in edge functions. Capture errors and return them in a `?debug=true` response block.

### React Patterns

- Use hook `refetch()` instead of `window.location.reload()` after mutations — the latter wipes all React state before new data is visible.
- `NumericInput` is required for all numeric fields — `<input type="number">` cannot be cleared when bound to a numeric state value.

---

## Future Enhancements

### Planned (Backlog)

| Feature | Complexity | Notes |
|---------|-----------|-------|
| **Scenario Drift Alerts** | Medium | Alert when actual portfolio diverges from scenario projection by X%. Deferred to a future phase; `alert_rules` table already designed to accommodate new `alert_type` values. |
| **Portfolio Sell-Off / Drawdown** | Medium | Model withdrawals funded by specific portfolio liquidation (sequential or proportional). Remaining from Phase 5; `scenario_configs.portfolio_id` FK is the starting point. |
| **Tax Reporting** | High | Cost basis per lot, realized gain/loss, tax-year summaries. Requires new `transactions` table — major schema addition. |
| **Mobile App** | High | React Native / Expo reusing the same Supabase backend. Hook/API layer is designed to support this. Build after web is stable. |

### Architecture Notes for Future Work

- **International equities** — Twelve Data supports 50+ exchanges. Add `metadata.exchange` lookup to the price refresh function.
- **Adding new grantable pages** — Add one entry to `GRANTABLE_PAGES` in `src/lib/permissions.ts`. Existing grants default to No Access for new pages automatically.
- **Real-time prices** — The 15-minute cron + batch rotation pattern handles any portfolio size within the free API tier. Upgrade to a paid Twelve Data plan to remove the 8-symbol/minute constraint.
- **XLSX export additional sheets** — `exportScenarioXlsx` in `src/lib/exportXlsx.ts` accepts pre-computed results. Add new sheets by extending the function; the `appendPercentileSummary` helper can be reused.
- **Alerts — adding new alert types** — add a new value to the `alert_type` check constraint in `012_alerts.sql` and a new evaluation branch in `check-alerts/index.ts`. The notification dispatch (Resend + Twilio) and cooldown logic are shared and need no changes.
- **Alerts — custom email domain** — change the `from` field in `check-alerts/index.ts` from `onboarding@resend.dev` to `alerts@yourdomain.com`. Requires domain verification in the Resend dashboard.
