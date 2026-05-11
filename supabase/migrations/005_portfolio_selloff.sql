-- Run this in the Supabase SQL editor after 004_monte_carlo.sql

-- ── scenario_configs: start year + holding-sourced starting value ─────────────

alter table public.scenario_configs
  add column if not exists start_year integer not null default extract(year from now())::integer,

  -- 'manual' = user types the value; 'holding' = sourced from a specific holding
  add column if not exists starting_value_source text not null default 'manual',

  add column if not exists starting_value_portfolio_id   uuid references public.portfolios(id) on delete set null,
  add column if not exists starting_value_portfolio_name text,   -- denormalized for display
  add column if not exists starting_value_holding_id     uuid references public.holdings(id) on delete set null,
  add column if not exists starting_value_holding_name   text,   -- denormalized for display
  add column if not exists starting_value_pct            numeric not null default 100,
  add column if not exists starting_value_snapshot       numeric,
  add column if not exists starting_value_snapshot_date  timestamptz;

-- ── scenario_events: holding-sourced one-off contribution amounts ─────────────

alter table public.scenario_events
  add column if not exists linked_portfolio_id   uuid references public.portfolios(id) on delete set null,
  add column if not exists linked_portfolio_name text,   -- denormalized for display
  add column if not exists linked_holding_id     uuid references public.holdings(id) on delete set null,
  add column if not exists linked_holding_name   text,   -- denormalized for display
  add column if not exists linked_pct            numeric not null default 100,
  add column if not exists linked_snapshot       numeric,
  add column if not exists linked_snapshot_date  timestamptz;
