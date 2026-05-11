-- Run this in the Supabase SQL editor after 007_drop_old_holding_columns.sql
-- Adds per-year (or year-range) growth and inflation rate overrides to scenarios.

create table public.scenario_year_rate_overrides (
  id               uuid primary key default gen_random_uuid(),
  scenario_id      uuid not null references public.scenarios(id) on delete cascade,
  from_year        integer not null,
  to_year          integer,            -- null = single year (from_year only)
  annual_return_pct numeric,           -- null = use flat config rate
  inflation_pct    numeric,            -- null = use flat config rate
  note             text,
  created_at       timestamptz not null default now(),
  check (to_year is null or to_year >= from_year),
  check (annual_return_pct is not null or inflation_pct is not null)
);

create index scenario_year_rate_overrides_scenario_id_idx
  on public.scenario_year_rate_overrides(scenario_id);

alter table public.scenario_year_rate_overrides enable row level security;

create policy "Users can manage year rate overrides for their scenarios"
  on public.scenario_year_rate_overrides for all
  using (
    exists (
      select 1 from public.scenarios s
      where s.id = scenario_year_rate_overrides.scenario_id
        and s.user_id = auth.uid()
    )
  );

grant select, insert, update, delete
  on public.scenario_year_rate_overrides to authenticated;
