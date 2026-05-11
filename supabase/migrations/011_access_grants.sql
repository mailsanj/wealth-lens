-- ── access_grants ─────────────────────────────────────────────────────────────
-- Stores read-only page grants from an owner to a named grantee.
-- grantee_id is populated automatically when the grantee signs up (see trigger).

create table public.access_grants (
  id            uuid    primary key default gen_random_uuid(),
  owner_id      uuid    not null references auth.users(id) on delete cascade,
  grantee_email text    not null,
  grantee_id    uuid    references auth.users(id) on delete set null,
  pages         text[]  not null default '{}',
  label         text,
  created_at    timestamptz not null default now(),
  unique(owner_id, grantee_email)
);

alter table public.access_grants enable row level security;

-- Owner can fully manage their grants
create policy "Owner manages grants"
  on public.access_grants for all
  using (owner_id = auth.uid());

-- Grantee can read their own grants (to detect viewer mode on login)
create policy "Grantee reads own grants"
  on public.access_grants for select
  using (grantee_id = auth.uid());

grant select, insert, update, delete on public.access_grants to authenticated;
grant select, insert, update, delete on public.access_grants to service_role;

-- ── Auto-link trigger ─────────────────────────────────────────────────────────
-- When a new user signs up, populate grantee_id for any pending grants that
-- match their email address.

create or replace function public.link_grants_on_signup()
returns trigger language plpgsql security definer as $$
begin
  update public.access_grants
  set grantee_id = new.id
  where grantee_email = new.email
    and grantee_id is null;
  return new;
end;
$$;

create trigger on_auth_user_created_link_grants
  after insert on auth.users
  for each row execute function public.link_grants_on_signup();

-- ── Helper function ────────────────────────────────────────────────────────────
-- Returns true if the current user has a grant from p_owner_id for p_page.

create or replace function public.has_page_grant(p_owner_id uuid, p_page text)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.access_grants ag
    where ag.owner_id    = p_owner_id
      and ag.grantee_id  = auth.uid()
      and p_page = any(ag.pages)
  )
$$;

-- ── Grantee SELECT policies ────────────────────────────────────────────────────
-- Each policy is FOR SELECT only — grantees are always read-only.
-- Existing "Users can manage their own X" policies remain unchanged for owners.

-- profiles: any grantee can read the owner's profile (needed for currency setting)
create policy "Grantees read owner profile"
  on public.profiles for select
  using (
    exists (
      select 1 from public.access_grants ag
      where ag.owner_id  = profiles.id
        and ag.grantee_id = auth.uid()
    )
  );

-- portfolios: readable with any page grant (dashboard needs totals, scenarios needs overlay)
create policy "Grantees read portfolios"
  on public.portfolios for select
  using (
    exists (
      select 1 from public.access_grants ag
      where ag.owner_id  = portfolios.user_id
        and ag.grantee_id = auth.uid()
    )
  );

-- holdings: readable with 'portfolios' or 'scenarios' grant
create policy "Grantees read holdings"
  on public.holdings for select
  using (
    exists (
      select 1 from public.portfolios p
      join  public.access_grants ag on ag.owner_id = p.user_id
      where p.id              = holdings.portfolio_id
        and ag.grantee_id     = auth.uid()
        and (
          'portfolios' = any(ag.pages) or
          'scenarios'  = any(ag.pages)
        )
    )
  );

-- portfolio_snapshots: readable with 'dashboard' or 'portfolios' grant
create policy "Grantees read portfolio_snapshots"
  on public.portfolio_snapshots for select
  using (
    exists (
      select 1 from public.portfolios p
      join  public.access_grants ag on ag.owner_id = p.user_id
      where p.id              = portfolio_snapshots.portfolio_id
        and ag.grantee_id     = auth.uid()
        and (
          'dashboard'  = any(ag.pages) or
          'portfolios' = any(ag.pages)
        )
    )
  );

-- scenarios: readable with 'scenarios' grant
create policy "Grantees read scenarios"
  on public.scenarios for select
  using (has_page_grant(user_id, 'scenarios'));

-- scenario_configs
create policy "Grantees read scenario_configs"
  on public.scenario_configs for select
  using (
    exists (
      select 1 from public.scenarios s
      where s.id = scenario_configs.scenario_id
        and has_page_grant(s.user_id, 'scenarios')
    )
  );

-- scenario_events
create policy "Grantees read scenario_events"
  on public.scenario_events for select
  using (
    exists (
      select 1 from public.scenarios s
      where s.id = scenario_events.scenario_id
        and has_page_grant(s.user_id, 'scenarios')
    )
  );

-- scenario_future_contributions
create policy "Grantees read scenario_future_contributions"
  on public.scenario_future_contributions for select
  using (
    exists (
      select 1 from public.scenarios s
      where s.id = scenario_future_contributions.scenario_id
        and has_page_grant(s.user_id, 'scenarios')
    )
  );

-- scenario_year_rate_overrides
create policy "Grantees read scenario_year_rate_overrides"
  on public.scenario_year_rate_overrides for select
  using (
    exists (
      select 1 from public.scenarios s
      where s.id = scenario_year_rate_overrides.scenario_id
        and has_page_grant(s.user_id, 'scenarios')
    )
  );

-- goals: readable with 'goals' grant
create policy "Grantees read goals"
  on public.goals for select
  using (has_page_grant(user_id, 'goals'));
