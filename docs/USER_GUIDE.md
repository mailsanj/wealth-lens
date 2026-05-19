# WealthLens — User Guide

WealthLens is a personal finance tracking and simulation platform. It lets you track investment portfolios, model future financial scenarios, and set measurable goals — all in one place.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Navigation](#navigation)
3. [Dashboard](#dashboard)
4. [Portfolios](#portfolios)
5. [Holdings](#holdings)
6. [Scenarios](#scenarios)
7. [Goals](#goals)
8. [Alerts](#alerts)
9. [Settings](#settings)
10. [Shared Access (Viewer Mode)](#shared-access)

---

## Getting Started

### Creating an Account

1. Navigate to the app URL and click **Sign Up** (or go to `/register`).
2. Enter your email address and a password.
3. You are immediately logged in — no email verification step.

### First Steps

After signing in, the recommended setup order is:

1. **Settings** — set your preferred currency and date format.
2. **Portfolios** — create one or more portfolios and add your holdings.
3. **Scenarios** — model projections using your portfolio values as a starting point.
4. **Goals** — set financial targets and link them to portfolios and scenarios.

---

## Navigation

The sidebar on the left provides access to all main sections:

| Link | Description |
|------|-------------|
| Dashboard | Net worth overview, allocation chart, historical chart |
| Portfolios | List of all portfolios; create and manage them |
| Scenarios | Investment projection models |
| Goals | Financial milestones and progress tracking |
| Alerts | Configure threshold and movement alerts with email/SMS notifications |
| Settings | Profile, preferences, and shared access |

The bottom of the sidebar shows your logged-in email and a **Sign out** button.

---

## Dashboard

The Dashboard gives you a real-time snapshot of your overall financial position.

### Net Worth Summary

Four stat cards across the top show:

- **Net Worth** — total equity across all portfolios (for real estate, this deducts mortgage and HELOC balances from the property value).
- **Cost Basis** — total amount invested across all holdings.
- **Gain / Loss** — gross appreciation (current market value minus cost basis).
- **Return %** — gain/loss as a percentage of cost basis.

All values are displayed in your base currency (set in Settings). Portfolios held in a different currency are automatically converted using live exchange rates.

### Asset Allocation Chart

A donut chart showing the proportion of your net worth by asset type (stocks, ETFs, crypto, real estate, etc.).

### Portfolio Breakdown

A list of all portfolios showing individual values and their share of your total net worth. Each row has a toggle to switch between your base currency and the portfolio's native currency (useful if you hold assets in foreign currencies).

### Net Worth Over Time

A line chart showing your net worth history. Each data point is a **snapshot** — a point-in-time record of your portfolio values.

**Taking a Snapshot:** Click **Take Snapshot** in the top-right to record today's values. The button shows the **date and time** of the last snapshot taken (e.g. `May 10 at 4:31 PM`). Snapshots are used to build the historical chart and to overlay your actual progress on Scenario projections.

> Snapshots are also taken automatically at market close each weekday (4:30 PM ET) once the cron jobs are running.

---

## Portfolios

### Portfolio List

The Portfolios page shows all your portfolios as cards. Cards display:

- Portfolio name and type (color-coded badge)
- Total gross value and, for real estate portfolios, equity below it
- Holdings count and gross gain/loss

**Drag to reorder** — grab the grip handle (⠿) on any card to drag it into a different position. Order is saved automatically.

**Edit** — hover a card to reveal the pencil (edit) and copy (duplicate) icons.

### Portfolio Types

| Type | Badge Color |
|------|------------|
| Investment | Blue |
| Retirement | Amber |
| Education | Violet |
| General | Slate |

### Creating a Portfolio

Click **New Portfolio** → fill in name, type, currency, and optional description → Save.

### Portfolio Detail

Clicking a portfolio card opens its detail page, which shows:

- **Stats bar** — Total Value, Cost Basis, Gain/Loss, Return %.
- **Holdings table** — all holdings with their type, cost basis, current value, and gain/loss.
- For symbol-linked holdings, a small badge shows whether the price is **auto** (last fetched) or **manual**.

**Refresh Prices** — fetches the latest market prices from Twelve Data for all symbol-linked holdings in the portfolio. The button is disabled if no holdings have a ticker symbol. Up to 8 symbols are refreshed per click (free-tier API limit); click again to refresh the next batch.

**Export CSV / Export XLSX** — downloads all holdings in the selected format.

### Holdings Table

The holdings table shows the following columns:

| Column | Notes |
|--------|-------|
| Name | Holding name and symbol. Symbol-linked holdings show an **auto** badge with time since last price refresh, or a **manual** badge if no symbol is set. |
| Type | Asset type badge |
| Qty | Quantity of shares, coins, or units. Shows `—` for asset types where quantity is not applicable (cash, real estate, retirement accounts, education plans). |
| Cost Basis | Total amount originally paid |
| Current Value | Current market value (with equity sub-label for real estate) |
| Gain / Loss | Gross appreciation in value and percentage |

**Click any column header** to sort the table by that column. Click again to reverse the sort direction. An arrow icon (↑ ↓) indicates the active sort column.

---

## Holdings

### Asset Types

| Type | Symbol Required | Notes |
|------|----------------|-------|
| Stock | Yes | e.g. `AAPL`, `MSFT` |
| ETF | Yes | e.g. `SPY`, `QQQ` |
| Mutual Fund | Yes | e.g. `VFIAX` |
| Crypto | Yes | Ticker only — e.g. `BTC`, `ETH` (not `BTC/USD`) |
| Bond | Optional | Works for bond ETFs/funds; individual bonds use CUSIP (not supported) |
| Cash | No | Savings, checking, money market |
| Real Estate | No | Property values; supports mortgage and HELOC balance deduction |
| Retirement Account | No | 401(k), IRA, Roth IRA |
| Education Plan | No | 529 plans |
| Other | No | Anything not covered above |

### Adding / Editing a Holding

Click **Add Holding** on the Portfolio detail page. Fields vary by asset type:

- **Symbol** — required for Stock, ETF, Mutual Fund, and Crypto. Automatically uppercased. For crypto, enter just the ticker (`BTC` not `BTC/USD`).
- **Quantity** — number of shares, coins, or units.
- **Cost Basis** — total amount originally paid.
- **Current Value** — current market value. For symbol-linked holdings this is updated automatically by the price refresh.
- **Purchase Date** — optional.

Additional metadata fields appear for each asset type (e.g. exchange/sector for stocks, mortgage balance for real estate, account type for cash).

### Lot-Based Tracking

You can add multiple holdings with the same ticker symbol — for example, two separate AAPL purchases on different dates with different quantities and cost bases. Each is stored and displayed as an independent row. This is called **lot-based tracking** and allows precise cost basis tracking per purchase date, which is useful for tax purposes.

When prices are refreshed, all rows with the same symbol receive the same per-share price, but their individual `current_value` values differ based on their respective quantities.

### Real Estate Equity

For real estate holdings, the Holdings table shows the **gross value** with an **Equity** sub-label. Equity = Current Value − Mortgage Balance − HELOC Balance. This equity figure is what flows into your Net Worth calculation on the Dashboard.

### Automatic Price Refresh

Holdings with a ticker symbol are refreshed automatically every 15 minutes on weekdays during US market hours (9 AM – 4 PM ET), rotating through 8 symbols per cycle to stay within the free API tier. An end-of-day snapshot is taken at 4:30 PM ET.

---

## Scenarios

Scenarios let you model how a portfolio might grow or decline over time, testing different assumptions about returns, contributions, and withdrawals.

### Creating a Scenario

Click **New Scenario** → enter a name and optional description → Save. The scenario detail page opens immediately.

### Scenario Detail Page

The page has two columns:

- **Left column** — configuration panels (Parameters, Year Rate Overrides, Future Contributions, One-off Events).
- **Right column** — projection chart, summary statistics, and holding allocation.

Panels in both columns can be **drag-and-drop reordered**. Order is saved per-session in your browser.

### Parameters Panel

The core assumptions driving the simulation:

| Field | Description |
|-------|-------------|
| Start Year | Calendar year the simulation begins (used to align the X-axis to real years) |
| Starting Value | Initial portfolio value — enter manually or pull from one or more linked holdings |
| Annual Return (%) | Expected annual growth rate |
| Volatility / Std Dev (%) | Return variability (used in Monte Carlo mode) |
| Inflation Rate (%) | Annual inflation assumption |
| Time Horizon (years) | Number of years to project |
| Annual Contribution ($) | Regular yearly contribution (stops when withdrawals begin) |
| Contribution Growth (%) | Annual increase in contributions |
| Withdrawal Start (year) | Simulation year when withdrawals replace contributions; 0 = no withdrawals |
| Annual Withdrawal ($) | Annual withdrawal amount |
| Inflation-Adjusted | If checked, withdrawals grow with inflation each year |

Click **Save Parameters** to apply changes. The chart updates immediately.

**Starting Value from Holdings** — toggle from *Manual* to *From Holdings* to link the starting value to specific holdings. You can select multiple holdings and specify what percentage of each to include. The total is calculated automatically.

### Year Rate Overrides

Override the flat return or inflation rate for specific years or ranges. Useful for modelling recessions, high-inflation periods, or planned market events.

- Set a **From Year** and optionally a **To Year** (leave blank for a single year override).
- Enter a custom **Growth Rate %** and/or **Inflation %**.
- Add an optional **Note** for reference.

Single-year overrides take precedence over range overrides.

### Future Annual Contributions

Model recurring income streams that begin in a future year — Social Security, pension payments, annuity income, etc.

Each entry has:
- **Name** (e.g. "Social Security")
- **Annual Amount ($)**
- **Start Year** (simulation year)
- **End Year** (optional — leave blank for ongoing)

Multiple entries are supported and they stack with each other.

### One-off Events

Model discrete financial events in a specific year:

| Type | Description |
|------|-------------|
| Contribution | A one-time addition (windfall, inheritance, asset sale proceeds) |
| Withdrawal | A one-time large expense (home purchase, tuition) |
| Shock | A percentage loss applied to the portfolio (market crash, e.g. 30% drop) |
| Rebalance | Recorded for reference; no simulation effect |

Contributions and withdrawals can be linked to specific holdings (same as Starting Value).

### Simulation Modes

Switch between modes using the toggle above the chart:

#### Deterministic

A single-path projection using the exact parameters you set. Shows year-by-year values as a smooth curve. The **Summary** panel shows final value, inflation-adjusted value, and key milestones.

#### Monte Carlo

Runs 1,000 simulations with randomly varied annual returns drawn from a normal distribution (mean = your Annual Return %, standard deviation = your Volatility %). Shows percentile bands:

- **P90** — optimistic outcome (top 10%)
- **P75** — above-average outcome
- **Median (P50)** — middle outcome
- **P25** — below-average outcome
- **P10** — pessimistic outcome (bottom 10%)

The **Probability Summary** panel shows both nominal and inflation-adjusted percentiles, plus the probability of reaching your current net worth.

#### Historical

Runs the scenario against every historical S&P 500 return sequence from 1926 to 2024 (rolling windows). Shows the same P10–P90 bands based on actual market history. The **Historical Summary** panel identifies the best and worst starting years and the number of windows tested.

### X-Axis Toggle

Switch the chart's X-axis between:
- **Yr 1, 2, 3…** — simulation year numbers
- **2026, 2027…** — actual calendar years (based on Start Year in Parameters)

### Portfolio Overlay

Click the **eye icon** to overlay your actual portfolio snapshot history on top of the projection. This shows whether your real portfolio is tracking ahead or behind the simulation. You can select one or more portfolios to include in the overlay.

### Export

- **Export CSV** — deterministic projection table with all year-by-year columns.
- **Export XLSX** — Excel file with up to 3 sheets (Deterministic, Monte Carlo, Historical), depending on which modes have been run. All currency columns are formatted with the portfolio currency and comma separators.

### Comparing Scenarios

From the Scenarios list, click **Compare** to enter comparison mode. Select 2–5 scenarios and click **Compare** to view them side by side in a combined chart and summary table.

---

## Goals

Goals let you define financial milestones and track progress toward them.

### Creating a Goal

Click **New Goal** → fill in:

| Field | Description |
|-------|-------------|
| Name | e.g. "Retirement", "Kids College", "Pay off mortgage" |
| Target Value ($) | The amount you want to reach |
| Target Date | When you want to reach it |
| Linked Portfolios | Optionally link specific portfolios to track progress against their values rather than total net worth |
| Linked Scenario | Optionally link a scenario to show whether its projection reaches the goal in time |

### Goal Card

Each goal card shows:
- **Progress bar** — current value vs target value.
- **% complete** and **amount remaining**.
- **Years away** from the target date.
- **Projection status** — if linked to a scenario, shows whether the projection is on track (green) or off track (amber), and the projected year of reaching the target.

---

## Alerts

The Alerts page lets you configure threshold-based notifications that fire when a stock or portfolio moves by a defined amount within a trading day.

### Alert Types

| Type | Target | How it works |
|------|--------|-------------|
| Individual Stock | Ticker symbol (e.g. `AAPL`) | Compares the current price from Twelve Data against the previous trading day's closing price |
| Portfolio | A specific portfolio | Compares the current sum of all holding values against the most recent end-of-day portfolio snapshot |

Both types are checked every 15 minutes during US market hours (9 AM – 4 PM ET, weekdays).

### Creating an Alert

Click **New Alert** → fill in:

- **Label** — optional description (e.g. "AAPL crash guard")
- **Alert Type** — Individual Stock or Portfolio
- **Target** — ticker symbol (for stock) or portfolio dropdown
- **Direction** — Goes Down / Goes Up / Either Direction
- **By** — % Percent or $ Dollars
- **Threshold** — the amount that triggers the alert (e.g. 5 for 5%, or 1000 for $1,000)
- **Notification Channels** — Email and/or SMS (both can be enabled simultaneously)
  - Email defaults to your login email; you can change it per alert
  - Phone number must be in international format (e.g. `+14155552671`)
- **Re-alert after** — cooldown before the same alert can fire again (e.g. 24 Hours)

Click **Create Alert** to save.

### Managing Alerts

Each alert card shows the condition, notification channels, cooldown, and last triggered time.

**Hover actions** (reveal on hover):
- **Pencil** — edit the alert
- **Copy** — duplicate the alert (saved as inactive)
- **Trash** — delete permanently

**Bell icon** — toggle the alert on or off without deleting it. A filled bell (🔔) means active; a crossed bell means paused.

### How Notifications Are Sent

- **Email** — sent via Resend from `WealthLens <onboarding@resend.dev>`. Can be moved to a custom domain in future.
- **SMS** — sent via Twilio. During the Twilio trial, SMS can only be sent to phone numbers that have been verified in the Twilio Console.

> **Note:** Stock alerts require at least one day of price history before they can fire. After the first end-of-day cron run following deployment, the baseline is established and alerts become active.

---

## Settings

### Profile

- **Display Name** — shown in the Dashboard welcome message.
- **Email** — your login email (read-only).

### Preferences

- **Currency** — your base currency for all Dashboard totals and net worth calculations. Live exchange rates convert foreign-currency portfolios automatically.
- **Date Format** — how dates are displayed throughout the app.

### Shared Access

Grant read-only access to other people (e.g. a financial advisor or family member).

**Adding a grant:**
1. Click **Add Access Grant**.
2. Enter their **email address** (they must sign up using this exact address).
3. Add an optional **label** (e.g. "Financial Advisor").
4. Tick which **pages** they should have access to: Dashboard, Portfolios, Scenarios, Goals.
5. Click **Add Grant**.

**Status indicators:**
- **Pending signup** (amber clock) — the person hasn't created an account yet.
- **Active** (green checkmark) — they've signed up and can log in.

**Revoking access** — click the trash icon next to any grant to remove it immediately.

---

## Shared Access

### For the Grantee (Viewer)

If someone has shared access with you:

1. Sign up at the app using the **exact email address** the owner used when creating the grant.
2. Log in — you are automatically placed in **Read-only view** for that owner's data.
3. An amber **Read-only view** badge appears in the sidebar.

**What you can see:**
- Only the pages the owner granted you access to.
- All data is live — you see the owner's actual portfolios, holdings, scenarios, and goals.

**What you cannot do:**
- Add, edit, or delete any data.
- Take snapshots or refresh prices.
- Access Settings → Shared Access.

**Multiple owners:** If you have viewing grants from more than one owner, a workspace picker appears after login. Select whose data you want to view.

> Viewer access is read-only at both the UI level (buttons are hidden) and the database level (Row Level Security policies enforce this server-side).
