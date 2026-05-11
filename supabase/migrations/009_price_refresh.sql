-- Enable extensions needed for scheduled edge function calls
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Track when a holding's price was last auto-refreshed from Twelve Data
alter table public.holdings
  add column if not exists last_price_updated_at timestamptz;
