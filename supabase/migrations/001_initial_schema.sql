-- ============================================================
-- 001_initial_schema.sql
-- Run this in your Supabase SQL editor or via Supabase CLI:
--   supabase db push
-- ============================================================

-- ─────────────────────────────────────────
-- PROFILES
-- ─────────────────────────────────────────
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  currency      text not null default 'USD',
  date_format   text not null default 'MM/DD/YYYY',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─────────────────────────────────────────
-- PORTFOLIOS
-- ─────────────────────────────────────────
create table public.portfolios (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  name            text not null,
  description     text,
  portfolio_type  text not null default 'investment'
                    check (portfolio_type in ('investment','retirement','education','general')),
  currency        text not null default 'USD',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index portfolios_user_id_idx on public.portfolios(user_id);

alter table public.portfolios enable row level security;

create policy "Users can manage their own portfolios"
  on public.portfolios for all
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- HOLDINGS
-- ─────────────────────────────────────────
create table public.holdings (
  id            uuid primary key default gen_random_uuid(),
  portfolio_id  uuid not null references public.portfolios(id) on delete cascade,
  asset_type    text not null
                  check (asset_type in (
                    'stock','etf','mutual_fund','cash','real_estate',
                    'retirement_account','education_plan','bond','crypto','other'
                  )),
  name          text not null,
  symbol        text,
  quantity      numeric not null default 1,
  cost_basis    numeric not null default 0,
  current_value numeric not null default 0,
  purchase_date date,
  notes         text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index holdings_portfolio_id_idx on public.holdings(portfolio_id);

alter table public.holdings enable row level security;

create policy "Users can manage holdings in their portfolios"
  on public.holdings for all
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = holdings.portfolio_id
        and p.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────
-- PORTFOLIO SNAPSHOTS (historical net worth)
-- ─────────────────────────────────────────
create table public.portfolio_snapshots (
  id             uuid primary key default gen_random_uuid(),
  portfolio_id   uuid not null references public.portfolios(id) on delete cascade,
  snapshot_date  date not null,
  total_value    numeric not null,
  breakdown      jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  unique (portfolio_id, snapshot_date)
);

create index portfolio_snapshots_portfolio_id_idx on public.portfolio_snapshots(portfolio_id);
create index portfolio_snapshots_date_idx on public.portfolio_snapshots(snapshot_date);

alter table public.portfolio_snapshots enable row level security;

create policy "Users can manage snapshots for their portfolios"
  on public.portfolio_snapshots for all
  using (
    exists (
      select 1 from public.portfolios p
      where p.id = portfolio_snapshots.portfolio_id
        and p.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────
-- SCENARIOS
-- ─────────────────────────────────────────
create table public.scenarios (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index scenarios_user_id_idx on public.scenarios(user_id);

alter table public.scenarios enable row level security;

create policy "Users can manage their own scenarios"
  on public.scenarios for all
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- SCENARIO CONFIGS
-- ─────────────────────────────────────────
create table public.scenario_configs (
  id                      uuid primary key default gen_random_uuid(),
  scenario_id             uuid not null references public.scenarios(id) on delete cascade,
  portfolio_id            uuid references public.portfolios(id) on delete set null,
  initial_value           numeric not null default 0,
  annual_contribution     numeric not null default 0,
  contribution_growth_pct numeric not null default 0,
  annual_return_pct       numeric not null default 7,
  inflation_pct           numeric not null default 3,
  time_horizon_years      integer not null default 20,
  withdrawal_start_year   integer,
  annual_withdrawal       numeric not null default 0
);

create index scenario_configs_scenario_id_idx on public.scenario_configs(scenario_id);

alter table public.scenario_configs enable row level security;

create policy "Users can manage configs for their scenarios"
  on public.scenario_configs for all
  using (
    exists (
      select 1 from public.scenarios s
      where s.id = scenario_configs.scenario_id
        and s.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────
-- SCENARIO EVENTS
-- ─────────────────────────────────────────
create table public.scenario_events (
  id           uuid primary key default gen_random_uuid(),
  scenario_id  uuid not null references public.scenarios(id) on delete cascade,
  event_year   integer not null,
  event_type   text not null
                 check (event_type in ('withdrawal','contribution','shock','rebalance')),
  amount       numeric not null default 0,
  description  text
);

create index scenario_events_scenario_id_idx on public.scenario_events(scenario_id);

alter table public.scenario_events enable row level security;

create policy "Users can manage events for their scenarios"
  on public.scenario_events for all
  using (
    exists (
      select 1 from public.scenarios s
      where s.id = scenario_events.scenario_id
        and s.user_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────
-- GOALS
-- ─────────────────────────────────────────
create table public.goals (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  name                text not null,
  target_value        numeric not null,
  target_date         date not null,
  linked_scenario_id  uuid references public.scenarios(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index goals_user_id_idx on public.goals(user_id);

alter table public.goals enable row level security;

create policy "Users can manage their own goals"
  on public.goals for all
  using (auth.uid() = user_id);

-- ─────────────────────────────────────────
-- UPDATED_AT trigger (shared function)
-- ─────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();

create trigger set_portfolios_updated_at
  before update on public.portfolios
  for each row execute procedure public.set_updated_at();

create trigger set_holdings_updated_at
  before update on public.holdings
  for each row execute procedure public.set_updated_at();

create trigger set_scenarios_updated_at
  before update on public.scenarios
  for each row execute procedure public.set_updated_at();

create trigger set_goals_updated_at
  before update on public.goals
  for each row execute procedure public.set_updated_at();

-- ─────────────────────────────────────────
-- GRANTS
-- Required when "Automatically expose new tables" is disabled in Supabase.
-- RLS policies handle row-level security; these grants handle table-level access.
-- ─────────────────────────────────────────
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.profiles            to authenticated;
grant select, insert, update, delete on public.portfolios          to authenticated;
grant select, insert, update, delete on public.holdings            to authenticated;
grant select, insert, update, delete on public.portfolio_snapshots to authenticated;
grant select, insert, update, delete on public.scenarios           to authenticated;
grant select, insert, update, delete on public.scenario_configs    to authenticated;
grant select, insert, update, delete on public.scenario_events     to authenticated;
grant select, insert, update, delete on public.goals               to authenticated;
