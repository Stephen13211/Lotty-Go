create extension if not exists "pgcrypto";

create table if not exists public.rides (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references auth.users(id) on delete cascade,
  driver_id uuid references auth.users(id) on delete set null,
  pickup_address text not null,
  pickup_lat double precision not null,
  pickup_lng double precision not null,
  dropoff_address text not null,
  dropoff_lat double precision not null,
  dropoff_lng double precision not null,
  ride_type text not null check (ride_type in ('lotty_x','lotty_comfort','lotty_xl')),
  fare numeric(10,2) not null,
  distance_km numeric(8,2) not null,
  status text not null default 'requested'
    check (status in ('requested','accepted','in_progress','completed','cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists rides_status_idx on public.rides(status);
create index if not exists rides_rider_idx  on public.rides(rider_id);
create index if not exists rides_driver_idx on public.rides(driver_id);

alter table public.rides enable row level security;

create policy "rider_select_own"  on public.rides for select using (auth.uid() = rider_id);
create policy "rider_insert_own"  on public.rides for insert with check (auth.uid() = rider_id);
create policy "driver_select_open_or_own" on public.rides for select
  using (status = 'requested' or auth.uid() = driver_id);
create policy "driver_accept"     on public.rides for update
  using (status = 'requested' or auth.uid() = driver_id)
  with check (auth.uid() = driver_id);
create policy "rider_update_own"  on public.rides for update
  using (auth.uid() = rider_id)
  with check (auth.uid() = rider_id);

