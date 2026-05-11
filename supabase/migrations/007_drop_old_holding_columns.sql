-- Run this ONLY after all scenarios have been re-saved using the new
-- starting_value_sources and linked_sources JSONB columns from migration 006.
-- Drops the per-column holding fields added in 005_portfolio_selloff.sql.

alter table public.scenario_configs
  drop column if exists starting_value_source,
  drop column if exists starting_value_portfolio_id,
  drop column if exists starting_value_portfolio_name,
  drop column if exists starting_value_holding_id,
  drop column if exists starting_value_holding_name,
  drop column if exists starting_value_pct,
  drop column if exists starting_value_snapshot,
  drop column if exists starting_value_snapshot_date;

alter table public.scenario_events
  drop column if exists linked_portfolio_id,
  drop column if exists linked_portfolio_name,
  drop column if exists linked_holding_id,
  drop column if exists linked_holding_name,
  drop column if exists linked_pct,
  drop column if exists linked_snapshot,
  drop column if exists linked_snapshot_date;
