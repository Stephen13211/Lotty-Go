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

-- Enforce eligibility at the database boundary, not only in the app UI.
drop policy if exists "driver_accept" on public.rides;
create policy "driver_accept" on public.rides for update
  using (
    status = 'requested'
    and exists (
      select 1 from public.driver_profiles p
      where p.user_id = auth.uid()
        and p.application_status = 'approved'
        and (p.vehicle_type = 'motorcycle' and ride_type = 'courier_motorcycle'
          or p.vehicle_type = 'car' and ride_type <> 'courier_motorcycle')
        and (ride_type <> 'lotty_xl' or p.women_service_approved = true)
        and (p.women_riders_only = false or ride_type = 'lotty_xl')
    )
  )
  with check (
    auth.uid() = driver_id
    and exists (
      select 1 from public.driver_profiles p
      where p.user_id = auth.uid()
        and p.application_status = 'approved'
        and (p.vehicle_type = 'motorcycle' and ride_type = 'courier_motorcycle'
          or p.vehicle_type = 'car' and ride_type <> 'courier_motorcycle')
        and (ride_type <> 'lotty_xl' or p.women_service_approved = true)
        and (p.women_riders_only = false or ride_type = 'lotty_xl')
    )
  );

drop policy if exists "driver_profiles_admin_update" on public.driver_profiles;
create policy "driver_profiles_admin_update" on public.driver_profiles
  for update using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

drop policy if exists "driver_documents_admin_update" on public.driver_documents;
create policy "driver_documents_admin_update" on public.driver_documents
  for update using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  with check ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Calculate the 75/25 split on the server when a payment ledger row is created.
create or replace function public.set_lotty_payment_split()
returns trigger language plpgsql as $$
begin
  new.driver_share := round(new.total_fare * 0.75, 2);
  new.lotty_share := new.total_fare - new.driver_share;
  return new;
end;
$$;
drop trigger if exists lotty_payment_split_before_insert on public.payments;
create trigger lotty_payment_split_before_insert
before insert on public.payments
for each row execute function public.set_lotty_payment_split();

-- Let an approved driver change only their women-only preference without
-- granting permission to edit their approval status or verification fields.
create or replace function public.set_driver_women_preference(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.driver_profiles
     set women_riders_only = p_enabled,
         updated_at = now()
   where user_id = auth.uid()
     and application_status = 'approved';
  if not found then
    raise exception 'Only an approved driver can change this preference';
  end if;
end;
$$;
revoke all on function public.set_driver_women_preference(boolean) from public;
grant execute on function public.set_driver_women_preference(boolean) to authenticated;


-- SECURITY HARDENING: applicants must never be able to approve themselves,
-- enable Lotty Women eligibility, or alter payout/review fields.
create or replace function public.guard_driver_profile_privileged_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Trusted server-side operations (service role) have no end-user auth.uid().
  if auth.uid() is null or (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.user_id <> auth.uid()
       or new.application_status <> 'pending'
       or new.women_service_approved <> false
       or new.payout_status <> 'not_connected'
       or new.payout_provider is not null
       or new.payout_recipient_id is not null
       or new.review_notes is not null
       or new.reviewed_at is not null then
      raise exception 'Driver applications must start pending and cannot set approval or payout fields';
    end if;
  else
    if new.user_id <> old.user_id
       or new.application_status is distinct from old.application_status
       or new.women_service_approved is distinct from old.women_service_approved
       or new.payout_status is distinct from old.payout_status
       or new.payout_provider is distinct from old.payout_provider
       or new.payout_recipient_id is distinct from old.payout_recipient_id
       or new.review_notes is distinct from old.review_notes
       or new.reviewed_at is distinct from old.reviewed_at then
      raise exception 'Only Lotty Go administrators can change approval, verification, and payout fields';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists driver_profile_guard_privileged_fields on public.driver_profiles;
create trigger driver_profile_guard_privileged_fields
before insert or update on public.driver_profiles
for each row execute function public.guard_driver_profile_privileged_fields();

drop policy if exists "driver_profiles_insert_own" on public.driver_profiles;
create policy "driver_profiles_insert_own" on public.driver_profiles
  for insert with check (
    auth.uid() = user_id
    and application_status = 'pending'
    and women_service_approved = false
    and payout_status = 'not_connected'
    and payout_provider is null
    and payout_recipient_id is null
  );

-- An accepting driver may change only driver_id and status. This prevents
-- changing the fare, rider, route, or other ride details during acceptance.
create or replace function public.guard_ride_acceptance_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null
     and (auth.jwt() -> 'app_metadata' ->> 'role') <> 'admin'
     and old.status = 'requested'
     and new.status = 'accepted'
     and new.driver_id = auth.uid() then
    if (to_jsonb(new) - 'driver_id' - 'status')
       is distinct from
       (to_jsonb(old) - 'driver_id' - 'status') then
      raise exception 'Drivers may only assign themselves and accept a requested ride';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists rides_guard_acceptance_changes on public.rides;
create trigger rides_guard_acceptance_changes
before update on public.rides
for each row execute function public.guard_ride_acceptance_changes();
