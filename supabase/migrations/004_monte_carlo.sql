-- Run this in the Supabase SQL editor after 003_scenario_enhancements.sql

-- Add volatility parameter to scenario configs for Monte Carlo simulation.
-- Represents annualized standard deviation of returns (e.g. 15 = 15%).
-- Default of 12 is a reasonable estimate for a balanced equity/bond portfolio.
alter table public.scenario_configs
  add column if not exists volatility_pct numeric not null default 12;
