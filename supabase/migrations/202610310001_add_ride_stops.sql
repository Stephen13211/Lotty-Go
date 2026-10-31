alter table public.rides
add column if not exists stops jsonb not null default '[]'::jsonb;
