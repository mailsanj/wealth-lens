-- Run this in the Supabase SQL editor after 005_portfolio_selloff.sql
-- Replaces per-column holding links with flexible JSONB arrays that support
-- multiple portfolio/holding sources per scenario config and event.
--
-- Each array element shape:
-- { portfolioId, portfolioName, holdingId, holdingName, pct, snapshot, snapshotDate }

alter table public.scenario_configs
  add column if not exists starting_value_sources jsonb not null default '[]'::jsonb;

alter table public.scenario_events
  add column if not exists linked_sources jsonb not null default '[]'::jsonb;

-- NOTE: The old per-column fields from 005_portfolio_selloff.sql remain in the
-- table until you are ready to drop them. Run 007_drop_old_holding_columns.sql
-- AFTER confirming all scenarios have been re-saved with the new JSONB fields.
