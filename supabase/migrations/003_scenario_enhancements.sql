-- Run this in the Supabase SQL editor after 002_portfolio_sort_order.sql

-- 1. Inflation-adjusted withdrawals flag on scenario configs
alter table public.scenario_configs
  add column if not exists withdrawal_inflation_adjusted boolean not null default false;

-- 2. Future annual contributions (recurring income streams like Social Security, annuities)
create table public.scenario_future_contributions (
  id            uuid primary key default gen_random_uuid(),
  scenario_id   uuid not null references public.scenarios(id) on delete cascade,
  name          text not null,
  annual_amount numeric not null default 0,
  start_year    integer not null,
  end_year      integer,  -- null = runs to end of horizon
  created_at    timestamptz not null default now()
);

create index scenario_future_contributions_scenario_id_idx
  on public.scenario_future_contributions(scenario_id);

alter table public.scenario_future_contributions enable row level security;

create policy "Users can manage future contributions for their scenarios"
  on public.scenario_future_contributions for all
  using (
    exists (
      select 1 from public.scenarios s
      where s.id = scenario_future_contributions.scenario_id
        and s.user_id = auth.uid()
    )
  );

grant select, insert, update, delete on public.scenario_future_contributions to authenticated;

-- 3. Linked portfolio IDs on goals (array stored as JSONB)
alter table public.goals
  add column if not exists linked_portfolio_ids jsonb not null default '[]'::jsonb;
