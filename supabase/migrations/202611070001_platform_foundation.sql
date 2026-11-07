-- Lotty Go platform foundation: driver onboarding, service types and payment ledger.
create table if not exists public.driver_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  application_status text not null default 'not_started'
    check (application_status in ('not_started','pending','approved','rejected')),
  legal_name text,
  phone text,
  vehicle_type text check (vehicle_type in ('car','motorcycle')),
  vehicle_make text,
  vehicle_model text,
  vehicle_year integer,
  vehicle_registration text,
  women_riders_only boolean not null default false,
  women_service_approved boolean not null default false,
  payout_provider text,
  payout_recipient_id text,
  payout_status text not null default 'not_connected'
    check (payout_status in ('not_connected','pending','verified','rejected')),
  review_notes text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in (
    'south_african_id','drivers_licence','prdp','vehicle_registration',
    'operating_licence','police_clearance','vehicle_roadworthy'
  )),
  storage_path text not null,
  review_status text not null default 'pending'
    check (review_status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null unique references public.rides(id) on delete restrict,
  rider_id uuid not null references auth.users(id),
  driver_id uuid references auth.users(id),
  total_fare numeric(10,2) not null check (total_fare >= 0),
  driver_share numeric(10,2) not null check (driver_share >= 0),
  lotty_share numeric(10,2) not null check (lotty_share >= 0),
  currency text not null default 'ZAR',
  gateway text,
  gateway_reference text,
  collection_status text not null default 'pending'
    check (collection_status in ('pending','paid','failed','refunded')),
  driver_payout_status text not null default 'not_ready'
    check (driver_payout_status in ('not_ready','pending','processing','paid','failed')),
  lotty_settlement_status text not null default 'not_ready'
    check (lotty_settlement_status in ('not_ready','pending','paid','failed')),
  payout_provider_reference text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

alter table public.rides add column if not exists payment_method text not null default 'cash';
alter table public.rides add column if not exists payment_status text not null default 'unpaid';
alter table public.rides add column if not exists service_notes text;
alter table public.rides drop constraint if exists rides_ride_type_check;
alter table public.rides add constraint rides_ride_type_check
  check (ride_type in ('lotty_x','lotty_comfort','lotty_xl','courier_motorcycle'));

alter table public.driver_profiles enable row level security;
alter table public.driver_documents enable row level security;
alter table public.payments enable row level security;

drop policy if exists "driver_profiles_read_own" on public.driver_profiles;
create policy "driver_profiles_read_own" on public.driver_profiles
  for select using (auth.uid() = user_id or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "driver_profiles_insert_own" on public.driver_profiles;
create policy "driver_profiles_insert_own" on public.driver_profiles
  for insert with check (auth.uid() = user_id);
drop policy if exists "driver_profiles_update_own" on public.driver_profiles;
create policy "driver_profiles_update_own" on public.driver_profiles
  for update using (auth.uid() = user_id and application_status <> 'approved')
  with check (auth.uid() = user_id and application_status in ('not_started','pending','rejected'));

drop policy if exists "driver_documents_read_own_or_admin" on public.driver_documents;
create policy "driver_documents_read_own_or_admin" on public.driver_documents
  for select using (auth.uid() = driver_id or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
drop policy if exists "driver_documents_insert_own" on public.driver_documents;
create policy "driver_documents_insert_own" on public.driver_documents
  for insert with check (auth.uid() = driver_id);

drop policy if exists "payments_read_participant_or_admin" on public.payments;
create policy "payments_read_participant_or_admin" on public.payments
  for select using (auth.uid() = rider_id or auth.uid() = driver_id or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

insert into storage.buckets (id, name, public)
values ('driver-private-documents','driver-private-documents',false)
on conflict (id) do nothing;

drop policy if exists "driver_upload_own_private_documents" on storage.objects;
create policy "driver_upload_own_private_documents" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'driver-private-documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "driver_read_own_private_documents" on storage.objects;
create policy "driver_read_own_private_documents" on storage.objects
  for select to authenticated
  using (bucket_id = 'driver-private-documents' and (
    (storage.foldername(name))[1] = auth.uid()::text or
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  ));

-- Payment rows are written only by trusted server-side functions/service role.
-- The 75/25 values must be calculated in cents server-side, never trusted from the app.
