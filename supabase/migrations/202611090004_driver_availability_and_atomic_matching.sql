-- Persistent driver availability and atomic ride claiming.
begin;

create table if not exists public.driver_availability (
  driver_id uuid primary key references auth.users(id) on delete cascade,
  is_online boolean not null default false,
  latitude double precision,
  longitude double precision,
  location_updated_at timestamptz,
  updated_at timestamptz not null default now(),
  constraint driver_availability_latitude_valid check (latitude is null or latitude between -90 and 90),
  constraint driver_availability_longitude_valid check (longitude is null or longitude between -180 and 180)
);
alter table public.driver_availability enable row level security;
drop policy if exists driver_availability_read_own on public.driver_availability;
create policy driver_availability_read_own on public.driver_availability
 for select to authenticated using (driver_id=auth.uid());
revoke all on public.driver_availability from anon, authenticated;
grant select on public.driver_availability to authenticated;

create or replace function public.set_driver_availability(
 p_online boolean, p_latitude double precision default null, p_longitude double precision default null
) returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_latitude is not null and p_latitude not between -90 and 90 then raise exception 'Invalid latitude'; end if;
 if p_longitude is not null and p_longitude not between -180 and 180 then raise exception 'Invalid longitude'; end if;
 if p_online and (p_latitude is null or p_longitude is null) then raise exception 'A current location is required to go online'; end if;
 if p_online and not exists(select 1 from public.driver_profiles where user_id=auth.uid() and application_status='approved') then
   raise exception 'Only approved drivers can go online';
 end if;
 insert into public.driver_availability(driver_id,is_online,latitude,longitude,location_updated_at,updated_at)
 values(auth.uid(),p_online,case when p_online then p_latitude else null end,case when p_online then p_longitude else null end,
 case when p_online then clock_timestamp() else null end,clock_timestamp())
 on conflict(driver_id) do update set is_online=excluded.is_online,
 latitude=excluded.latitude,longitude=excluded.longitude,location_updated_at=excluded.location_updated_at,updated_at=clock_timestamp();
end; $$;

create or replace function public.claim_ride_request(p_ride_id uuid)
returns setof public.rides language plpgsql security definer set search_path=public as $$
declare v_profile public.driver_profiles%rowtype; v_ride public.rides%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into v_profile from public.driver_profiles where user_id=auth.uid() and application_status='approved';
 if not found then raise exception 'Your driver account is not approved'; end if;
 if not exists(select 1 from public.driver_availability a where a.driver_id=auth.uid() and a.is_online
   and a.location_updated_at>clock_timestamp()-interval '90 seconds') then
   raise exception 'Go online and enable location before accepting requests';
 end if;
 update public.rides r set driver_id=auth.uid(),status='accepted'
 where r.id=p_ride_id and r.status='requested'
 and ((v_profile.vehicle_type='motorcycle' and r.ride_type='courier_motorcycle')
   or (v_profile.vehicle_type='car' and r.ride_type<>'courier_motorcycle'))
 and (r.ride_type<>'lotty_xl' or v_profile.women_service_approved)
 and (not v_profile.women_riders_only or r.ride_type='lotty_xl')
 returning * into v_ride;
 if not found then raise exception 'This request is no longer available or is not eligible for your vehicle'; end if;
 return next v_ride;
end; $$;

revoke all on function public.set_driver_availability(boolean,double precision,double precision) from public;
revoke all on function public.claim_ride_request(uuid) from public;
grant execute on function public.set_driver_availability(boolean,double precision,double precision) to authenticated;
grant execute on function public.claim_ride_request(uuid) to authenticated;
commit;
