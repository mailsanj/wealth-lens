-- ── portfolio_snapshots: add currency + preserve on portfolio deletion ─────────
--
-- Two problems fixed here:
--   1. ON DELETE CASCADE was destroying all historical snapshot data when a
--      portfolio was deleted (e.g. on liquidation).
--   2. total_value was stored without its currency, making multi-currency
--      net-worth chart aggregation incorrect.
--
-- Migration strategy for existing rows:
--   The backfill UPDATE below joins each snapshot to its portfolio and copies
--   the currency. Because the old CASCADE constraint is still in effect, every
--   existing snapshot is guaranteed to have a live portfolio row — the JOIN
--   will match 100% of rows. Any portfolio deleted *before* this migration
--   also had its snapshots deleted (by CASCADE), so there is nothing to recover.

-- 1. Make portfolio_id nullable (required for ON DELETE SET NULL semantics)
alter table public.portfolio_snapshots
  alter column portfolio_id drop not null;

-- 2. Swap the FK from CASCADE → SET NULL so deletions preserve history
alter table public.portfolio_snapshots
  drop constraint portfolio_snapshots_portfolio_id_fkey;

alter table public.portfolio_snapshots
  add constraint portfolio_snapshots_portfolio_id_fkey
    foreign key (portfolio_id)
    references public.portfolios(id)
    on delete set null;

-- 3. Add currency column (defaults to USD for safety; backfilled below)
alter table public.portfolio_snapshots
  add column if not exists currency text not null default 'USD';

-- 4. Backfill all existing snapshots from their current portfolio's currency.
--    Every existing snapshot has a live portfolio (guaranteed by the CASCADE
--    that was in place until this migration), so this UPDATE covers all rows.
update public.portfolio_snapshots ps
set    currency = p.currency
from   public.portfolios p
where  ps.portfolio_id = p.id;
