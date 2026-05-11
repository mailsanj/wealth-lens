-- Add sort_order to portfolios for drag-and-drop reordering.
-- Run this in the Supabase SQL editor after 001_initial_schema.sql.

alter table public.portfolios
  add column if not exists sort_order integer not null default 0;

-- Assign sequential order to existing portfolios based on creation date
-- so the first created portfolio gets sort_order = 0, next = 1, etc.
with ordered as (
  select id, row_number() over (partition by user_id order by created_at asc) - 1 as rn
  from public.portfolios
)
update public.portfolios p
set sort_order = o.rn
from ordered o
where p.id = o.id;
