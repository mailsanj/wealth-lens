-- ── alert_rules ───────────────────────────────────────────────────────────────
-- One row per configured alert. Supports stock and portfolio threshold alerts.

create table public.alert_rules (
  id              uuid    primary key default gen_random_uuid(),
  user_id         uuid    not null references auth.users(id) on delete cascade,

  -- Type and target
  alert_type      text    not null check (alert_type in ('holding_stock', 'holding_portfolio')),
  symbol          text,                                   -- for holding_stock
  portfolio_id    uuid    references public.portfolios(id) on delete cascade, -- for holding_portfolio

  -- Condition
  direction       text    not null check (direction in ('up', 'down', 'either')),
  amount_type     text    not null check (amount_type in ('dollars', 'percent')),
  amount          numeric not null check (amount > 0),

  -- Notification channels
  notify_email    boolean not null default true,
  notify_sms      boolean not null default false,
  email           text,
  phone           text,                                   -- E.164 format e.g. +14155552671

  -- Cooldown
  cooldown_value  integer not null default 24 check (cooldown_value > 0),
  cooldown_unit   text    not null default 'hours' check (cooldown_unit in ('minutes', 'hours', 'days')),

  -- State
  is_active       boolean not null default true,
  last_triggered_at timestamptz,
  label           text,                                   -- optional user note
  created_at      timestamptz not null default now()
);

create index alert_rules_user_id_idx on public.alert_rules(user_id);
create index alert_rules_active_idx  on public.alert_rules(user_id, is_active);

alter table public.alert_rules enable row level security;

create policy "Users manage their own alert rules"
  on public.alert_rules for all
  using (user_id = auth.uid());

grant select, insert, update, delete on public.alert_rules to authenticated;
grant select, insert, update, delete on public.alert_rules to service_role;

-- ── stock_price_history ────────────────────────────────────────────────────────
-- One row per symbol per day, written by market-close-snapshot.
-- Provides the "previous close" baseline for intraday stock alert checks.

create table public.stock_price_history (
  id      uuid    primary key default gen_random_uuid(),
  symbol  text    not null,
  price   numeric not null,
  date    date    not null default current_date,
  unique(symbol, date)
);

create index stock_price_history_symbol_date_idx on public.stock_price_history(symbol, date);

alter table public.stock_price_history enable row level security;

-- All authenticated users can read (needed for check-alerts to find baselines)
create policy "Authenticated users can read stock price history"
  on public.stock_price_history for select
  to authenticated
  using (true);

grant select, insert, update, delete on public.stock_price_history to service_role;
grant select on public.stock_price_history to authenticated;
