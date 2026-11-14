begin;
create table if not exists public.driver_push_tokens (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references auth.users(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios','android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists driver_push_tokens_driver_id_idx on public.driver_push_tokens(driver_id);
alter table public.driver_push_tokens enable row level security;
drop policy if exists "Drivers can view their own push tokens" on public.driver_push_tokens;
create policy "Drivers can view their own push tokens" on public.driver_push_tokens
  for select to authenticated using ((select auth.uid()) = driver_id);
drop policy if exists "Drivers can register their own push tokens" on public.driver_push_tokens;
create policy "Drivers can register their own push tokens" on public.driver_push_tokens
  for insert to authenticated with check ((select auth.uid()) = driver_id);
drop policy if exists "Drivers can update their own push tokens" on public.driver_push_tokens;
create policy "Drivers can update their own push tokens" on public.driver_push_tokens
  for update to authenticated using ((select auth.uid()) = driver_id)
  with check ((select auth.uid()) = driver_id);
drop policy if exists "Drivers can delete their own push tokens" on public.driver_push_tokens;
create policy "Drivers can delete their own push tokens" on public.driver_push_tokens
  for delete to authenticated using ((select auth.uid()) = driver_id);
grant select, insert, update, delete on public.driver_push_tokens to authenticated;
comment on table public.driver_push_tokens is 'Expo push tokens registered by drivers for ride offer notifications.';
commit;