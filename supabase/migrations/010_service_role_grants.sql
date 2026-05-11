-- Grant service_role table-level access for edge functions (cron jobs, price refresh).
-- service_role bypasses RLS but still needs explicit GRANT — it is not a superuser.
grant usage on schema public to service_role;

grant select, insert, update, delete on public.holdings            to service_role;
grant select, insert, update, delete on public.portfolios          to service_role;
grant select, insert, update, delete on public.portfolio_snapshots to service_role;
