## Project: WealthLens
Personal finance tracking and investment scenario simulation platform.

## Tech Stack
- **Frontend:** React 19 + TypeScript, Vite (port 5173)
- **Styling:** Tailwind CSS v4 (CSS-first config, no tailwind.config.js) + shadcn/ui v4 (Base UI — NOT Radix UI)
- **Charts:** Recharts (ComposedChart for overlay lines on area charts)
- **Drag & Drop:** @dnd-kit (verticalListSortingStrategy for panels, rectSortingStrategy for cards)
- **Backend:** Supabase (PostgreSQL + RLS + Auth + Edge Functions)
- **Edge Functions:** Deno runtime — price refresh + EOD portfolio snapshots
- **Price Data:** Twelve Data API (US equities + crypto, 8 symbols/min free tier)
- **Currency:** open.er-api.com (primary) + Frankfurter (fallback), 4h localStorage cache
- **Excel Export:** SheetJS (`xlsx`) — write-only usage
- **Router:** React Router v6
- **Deployment:** GitHub (source); deployment target TBD

## Key Commands

### Dev
- Dev server: `npm run dev` (port 5173)
- Build: `npm run build`
- Lint: `npm run lint`

### Supabase Edge Functions
- Deploy: `npx supabase functions deploy <name> --no-verify-jwt`
- Link project: `npx supabase link --project-ref <PROJECT_REF>`
- Login: `npx supabase login`

### Git — Daily Workflow
- Check status: `git status`
- Stage all: `git add .`
- Commit: `git commit -m "message"`
- Push: `git push origin main`
- Pull (sync from remote): `git pull origin main`

### Git — Setup (one-time)
- Init repo: `git init`
- Add remote: `git remote add origin https://github.com/<user>/<repo>.git`
- Update remote URL: `git remote set-url origin <url>`
- First push: `git push -u origin main`

## File Structure
- src/components/ — Reusable UI components
- src/features/ — Feature-specific modules
- src/lib/ — Utility functions and helpers
- src/pages/ — Route-level page components
- supabase/ — Database migrations and types

## Architecture Notes

### Critical Gotchas
- **shadcn/ui v4 uses Base UI, not Radix.** `asChild` does not exist. `SelectValue` shows raw value not label — always use `SelectField` (`src/components/forms/SelectField.tsx`).
- **Numeric inputs:** Always use `NumericInput` (`src/components/forms/NumericInput.tsx`) for currency/quantity fields. `<input type="number">` cannot be cleared when bound to numeric state.
- **Supabase client is untyped.** Use `createClient(url, key)` with no generic; cast results as `as unknown as MyType`. The hand-written types lack `Relationships` required by the typed client.
- **`profiles` table uses `id` not `user_id`** as its primary key (mirrors `auth.users.id`).
- **`service_role` needs explicit GRANTs.** It bypasses RLS but is not a superuser. Every new table used by Edge Functions needs `GRANT ... TO service_role` (see migration 010).

### Auth & Permissions
- `AuthContext` — Supabase session; exposes `user`, `session`, `signOut`.
- `GrantContext` — viewer mode; provides `effectiveUserId`, `isViewer`, `grantedPages`. All data hooks use `effectiveUserId` so viewers fetch the owner's data within RLS constraints.
- `GrantGuard` — route-level access check; redirects viewers away from non-granted pages.
- Grantable pages are defined in `src/lib/permissions.ts` (`GRANTABLE_PAGES`). Adding a new page = one line change.

### Data Hooks Pattern
All hooks in `src/hooks/` follow this pattern:
- Use `effectiveUserId` from `GrantContext` (not `user.id`) for all SELECT queries.
- Expose a `refetch` function — use it after mutations instead of `window.location.reload()`.
- Cast Supabase results with `as unknown as MyType`.

### Simulation Engine
`src/lib/simulation.ts` is pure TypeScript — no network calls, no React deps. Three exports:
- `runSimulation` — deterministic projection
- `runMonteCarlo` — Box-Muller, 1,000 iterations
- `runHistoricalSimulation` — S&P 500 rolling windows 1926–2024

### Edge Functions
- Always deploy with `--no-verify-jwt` (flag resets on every deploy).
- Import Supabase client as `https://esm.sh/@supabase/supabase-js@2` (not `npm:`).
- Always pass `auth: { autoRefreshToken: false, persistSession: false }` when creating client.
- CORS headers must include `x-client-info` and `apikey` for browser callers.
- Twelve Data: 8 symbols/min limit; rotate via two-query NULLS-FIRST pattern (not `.order(nullsFirst)`).

### Real Estate Equity
`computeEffectiveValue()` in `src/lib/holdings.ts` deducts `mortgage_balance + heloc_balance` from real estate `current_value`. Net Worth uses equity; Gain/Loss uses gross appreciation.

### Error Handling

**Never swallow errors silently.** Bare `catch (_e) {}` blocks were responsible for hours of lost debugging time in Phase 7. Every catch must capture and surface the error.

**Edge Functions:**
```typescript
// Always capture errors; support ?debug=true for full diagnostics
const isDebug = new URL(req.url).searchParams.get('debug') === 'true'
const debug: Record<string, unknown> = {}

try {
  // ... work ...
} catch (e) {
  debug.fetchError = String(e)  // never swallow
}

// Return structured Supabase errors with all available fields
if (error) {
  return new Response(
    JSON.stringify({ error: error.message, hint: error.hint ?? null, code: error.code ?? null }),
    { status: 500, headers: CORS }
  )
}

return new Response(JSON.stringify({ result, ...(isDebug && { debug }) }), { headers: CORS })
```

**React Hooks:**
```typescript
// Expose error state so pages can display it
const [error, setError] = useState<string | null>(null)

const { data, error: sbError } = await supabase.from('table').select('*')
if (sbError) { setError(sbError.message); return }

// Mutations should throw so the calling component can catch
async function createItem(input: Input) {
  const { data, error } = await supabase.from('table').insert(input).select().single()
  if (error) throw new Error(error.message)
  return data
}
```

**Form Components:**
```typescript
// Standard error display pattern
const [error, setError] = useState<string | null>(null)

async function handleSave() {
  setError(null)
  try {
    await onSave(form)
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Something went wrong')
  }
}

// In JSX — always near the action that failed, not in a global location
{error && <p className="text-sm text-destructive">{error}</p>}
```

**Page-level handlers:**
```typescript
// Inline error state; never use browser alert()
const [refreshResult, setRefreshResult] = useState<{ ok: boolean; message: string } | null>(null)

try {
  const { data, error } = await supabase.functions.invoke('my-function')
  if (error) throw new Error(error.message)
  if (data?.error) throw new Error(data.error)  // check function-level errors too
  setRefreshResult({ ok: true, message: `Updated ${data.count} items` })
} catch (err) {
  setRefreshResult({ ok: false, message: err instanceof Error ? err.message : 'Unknown error' })
}
```