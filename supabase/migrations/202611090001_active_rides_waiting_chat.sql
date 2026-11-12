-- Active ride lifecycle, waiting fees, private ride chat and scoped driver location.
-- Initial waiting fee: R2 per minute after two free minutes. Admins can change it.
begin;
alter table public.rides
  add column if not exists driver_arrived_at timestamptz,
  add column if not exists trip_started_at timestamptz,
  add column if not exists trip_completed_at timestamptz,
  add column if not exists waiting_fee_amount numeric(10,2) not null default 0,
  add column if not exists waiting_fee_minutes integer not null default 0,
  add column if not exists driver_latitude double precision,
  add column if not exists driver_longitude double precision,
  add column if not exists driver_location_updated_at timestamptz;
alter table public.driver_profiles add column if not exists profile_photo_url text;
create table if not exists public.platform_settings (
  id boolean primary key default true check (id = true),
  waiting_free_minutes integer not null default 2 check (waiting_free_minutes between 0 and 30),
  waiting_fee_per_minute numeric(10,2) not null default 2.00 check (waiting_fee_per_minute between 0 and 100),
  updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
insert into public.platform_settings (id,waiting_free_minutes,waiting_fee_per_minute)
values (true,2,2.00) on conflict (id) do nothing;
alter table public.platform_settings enable row level security;
drop policy if exists platform_settings_read_authenticated on public.platform_settings;
create policy platform_settings_read_authenticated on public.platform_settings for select to authenticated using (true);
drop policy if exists platform_settings_admin_update on public.platform_settings;
create policy platform_settings_admin_update on public.platform_settings for update to authenticated
using ((auth.jwt()->'app_metadata'->>'role')='admin') with check ((auth.jwt()->'app_metadata'->>'role')='admin');

create table if not exists public.ride_messages (
 id uuid primary key default gen_random_uuid(), ride_id uuid not null references public.rides(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 body text not null check (char_length(body) between 1 and 2000), created_at timestamptz not null default now()
);
create index if not exists ride_messages_ride_created_idx on public.ride_messages(ride_id,created_at);
alter table public.ride_messages enable row level security;
drop policy if exists ride_messages_participant_select on public.ride_messages;
create policy ride_messages_participant_select on public.ride_messages for select to authenticated using (
 exists(select 1 from public.rides r where r.id=ride_id and auth.uid() in (r.rider_id,r.driver_id) and r.status in ('accepted','in_progress'))
);
drop policy if exists ride_messages_participant_insert on public.ride_messages;
create policy ride_messages_participant_insert on public.ride_messages for insert to authenticated with check (
 sender_id=auth.uid() and exists(select 1 from public.rides r where r.id=ride_id and auth.uid() in (r.rider_id,r.driver_id) and r.status in ('accepted','in_progress'))
);
drop policy if exists driver_profiles_read_active_rider on public.driver_profiles;
create policy driver_profiles_read_active_rider on public.driver_profiles for select to authenticated using (
 exists(select 1 from public.rides r where r.driver_id=driver_profiles.user_id and r.rider_id=auth.uid() and r.status in ('accepted','in_progress'))
);

insert into storage.buckets(id,name,public) values('driver-profile-photos','driver-profile-photos',true)
on conflict(id) do update set public=true;
drop policy if exists driver_profile_photo_upload_own on storage.objects;
create policy driver_profile_photo_upload_own on storage.objects for insert to authenticated with check(
 bucket_id='driver-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);
drop policy if exists driver_profile_photo_update_own on storage.objects;
create policy driver_profile_photo_update_own on storage.objects for update to authenticated using(
 bucket_id='driver-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text) with check(
 bucket_id='driver-profile-photos' and (storage.foldername(name))[1]=auth.uid()::text);

create or replace function public.lotty_guard_ride_lifecycle()
returns trigger language plpgsql set search_path=public as $$
begin
 if current_setting('lotty.internal_ride_update',true)='on' then return new; end if;
 if auth.uid() is null then return new; end if;
 -- Preserve the existing atomic accept action.
 if old.status='requested' and new.status='accepted' and new.driver_id=auth.uid()
    and (to_jsonb(new)-'driver_id'-'status') is not distinct from (to_jsonb(old)-'driver_id'-'status') then return new; end if;
 -- Permit a participant to cancel without altering ride details.
 if new.status='cancelled' and auth.uid() in (old.rider_id,old.driver_id)
    and (to_jsonb(new)-'status') is not distinct from (to_jsonb(old)-'status') then return new; end if;
 if new.driver_arrived_at is distinct from old.driver_arrived_at
 or new.trip_started_at is distinct from old.trip_started_at
 or new.trip_completed_at is distinct from old.trip_completed_at
 or new.waiting_fee_amount is distinct from old.waiting_fee_amount
 or new.waiting_fee_minutes is distinct from old.waiting_fee_minutes
 or new.driver_latitude is distinct from old.driver_latitude
 or new.driver_longitude is distinct from old.driver_longitude
 or new.driver_location_updated_at is distinct from old.driver_location_updated_at
 or new.status is distinct from old.status then
   raise exception 'Use the Lotty Go ride actions to update ride progress';
 end if;
 return new;
end; $$;
drop trigger if exists rides_guard_lifecycle on public.rides;
create trigger rides_guard_lifecycle before update on public.rides for each row execute function public.lotty_guard_ride_lifecycle();

create or replace function public.driver_arrive_at_pickup(p_ride_id uuid)
returns timestamptz language plpgsql security definer set search_path=public as $$
declare v_arrival timestamptz;
begin
 perform set_config('lotty.internal_ride_update','on',true);
 update public.rides set driver_arrived_at=coalesce(driver_arrived_at,clock_timestamp())
 where id=p_ride_id and driver_id=auth.uid() and status='accepted' returning driver_arrived_at into v_arrival;
 if v_arrival is null then raise exception 'Ride not found or not assigned to this driver'; end if;
 return v_arrival;
end; $$;

create or replace function public.get_ride_waiting_quote(p_ride_id uuid)
returns table(free_minutes integer,fee_per_minute numeric,billable_minutes integer,waiting_fee numeric,charging_started boolean)
language plpgsql security definer set search_path=public as $$
declare v_ride public.rides%rowtype; v_free integer; v_rate numeric; v_elapsed integer; v_billable integer;
begin
 select * into v_ride from public.rides where id=p_ride_id and auth.uid() in(rider_id,driver_id) and status in('accepted','in_progress');
 if not found then raise exception 'Active ride not found'; end if;
 select waiting_free_minutes,waiting_fee_per_minute into v_free,v_rate from public.platform_settings where id=true;
 v_elapsed:=case when v_ride.driver_arrived_at is null then 0 else greatest(0,floor(extract(epoch from(coalesce(v_ride.trip_started_at,clock_timestamp())-v_ride.driver_arrived_at)))::integer) end;
 v_billable:=case when v_elapsed<=v_free*60 then 0 else ceil((v_elapsed-v_free*60)::numeric/60)::integer end;
 return query select v_free,v_rate,v_billable,
 case when v_ride.trip_started_at is not null then v_ride.waiting_fee_amount else round(v_billable*v_rate,2) end,v_billable>0;
end; $$;

create or replace function public.start_ride_trip(p_ride_id uuid)
returns table(ride_status text,final_waiting_fee numeric,billable_waiting_minutes integer)
language plpgsql security definer set search_path=public as $$
declare v_ride public.rides%rowtype; v_free integer; v_rate numeric; v_elapsed integer; v_billable integer; v_fee numeric;
begin
 select * into v_ride from public.rides where id=p_ride_id and driver_id=auth.uid() and status='accepted' for update;
 if not found then raise exception 'Ride not found or not assigned to this driver'; end if;
 if v_ride.driver_arrived_at is null then raise exception 'Mark your arrival before starting the trip'; end if;
 select waiting_free_minutes,waiting_fee_per_minute into v_free,v_rate from public.platform_settings where id=true;
 v_elapsed:=greatest(0,floor(extract(epoch from(clock_timestamp()-v_ride.driver_arrived_at)))::integer);
 v_billable:=case when v_elapsed<=v_free*60 then 0 else ceil((v_elapsed-v_free*60)::numeric/60)::integer end;
 v_fee:=round(v_billable*v_rate,2);
 perform set_config('lotty.internal_ride_update','on',true);
 update public.rides set status='in_progress',trip_started_at=clock_timestamp(),waiting_fee_amount=v_fee,
 waiting_fee_minutes=v_billable,fare=fare+v_fee where id=p_ride_id;
 return query select 'in_progress'::text,v_fee,v_billable;
end; $$;

create or replace function public.complete_ride_trip(p_ride_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 perform set_config('lotty.internal_ride_update','on',true);
 update public.rides set status='completed',trip_completed_at=clock_timestamp()
 where id=p_ride_id and driver_id=auth.uid() and status='in_progress';
 if not found then raise exception 'Ride not found or not in progress'; end if;
end; $$;

create or replace function public.update_active_ride_location(p_ride_id uuid,p_latitude double precision,p_longitude double precision)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'Invalid location'; end if;
 perform set_config('lotty.internal_ride_update','on',true);
 update public.rides set driver_latitude=p_latitude,driver_longitude=p_longitude,driver_location_updated_at=clock_timestamp()
 where id=p_ride_id and driver_id=auth.uid() and status in('accepted','in_progress');
 if not found then raise exception 'Active ride not found'; end if;
end; $$;

create or replace function public.admin_set_waiting_fee(p_free_minutes integer,p_fee_per_minute numeric)
returns void language plpgsql security definer set search_path=public as $$
begin
 if coalesce(auth.jwt()->'app_metadata'->>'role','')<>'admin' then raise exception 'Administrator access required'; end if;
 if p_free_minutes not between 0 and 30 or p_fee_per_minute not between 0 and 100 then raise exception 'Waiting fee values are outside the allowed range'; end if;
 update public.platform_settings set waiting_free_minutes=p_free_minutes,waiting_fee_per_minute=round(p_fee_per_minute,2),
 updated_at=now(),updated_by=auth.uid() where id=true;
end; $$;

revoke all on function public.driver_arrive_at_pickup(uuid) from public;
revoke all on function public.get_ride_waiting_quote(uuid) from public;
revoke all on function public.start_ride_trip(uuid) from public;
revoke all on function public.complete_ride_trip(uuid) from public;
revoke all on function public.update_active_ride_location(uuid,double precision,double precision) from public;
revoke all on function public.admin_set_waiting_fee(integer,numeric) from public;
grant execute on function public.driver_arrive_at_pickup(uuid) to authenticated;
grant execute on function public.get_ride_waiting_quote(uuid) to authenticated;
grant execute on function public.start_ride_trip(uuid) to authenticated;
grant execute on function public.complete_ride_trip(uuid) to authenticated;
grant execute on function public.update_active_ride_location(uuid,double precision,double precision) to authenticated;
grant execute on function public.admin_set_waiting_fee(integer,numeric) to authenticated;

do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime')
 and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ride_messages')
 then alter publication supabase_realtime add table public.ride_messages; end if;
end $$;
commit;
