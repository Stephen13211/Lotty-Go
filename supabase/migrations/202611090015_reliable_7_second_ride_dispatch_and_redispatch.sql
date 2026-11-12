-- Reliable one-driver-at-a-time dispatch, 7-second offers, driver-cancel redispatch,
-- and privacy-safe nearby-driver map locations.
begin;

alter table public.rides
  add column if not exists dispatch_attempt_count integer not null default 0;

create table if not exists public.ride_dispatch_attempts (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  driver_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('offered','accepted','declined','expired','cancelled')),
  offered_at timestamptz not null default clock_timestamp(),
  expires_at timestamptz not null,
  responded_at timestamptz,
  unique (ride_id, driver_id)
);
create index if not exists ride_dispatch_attempts_driver_status_idx
  on public.ride_dispatch_attempts(driver_id,status,expires_at);
create index if not exists ride_dispatch_attempts_ride_status_idx
  on public.ride_dispatch_attempts(ride_id,status,offered_at desc);
create unique index if not exists ride_dispatch_one_live_offer_per_ride
  on public.ride_dispatch_attempts(ride_id) where status='offered';

alter table public.ride_dispatch_attempts enable row level security;
revoke all on public.ride_dispatch_attempts from anon, authenticated;
grant select on public.ride_dispatch_attempts to authenticated;
drop policy if exists ride_dispatch_driver_reads_own_offer on public.ride_dispatch_attempts;
create policy ride_dispatch_driver_reads_own_offer on public.ride_dispatch_attempts
  for select to authenticated using (driver_id=auth.uid());

create or replace function public.advance_ride_dispatch(p_ride_id uuid)
returns table(dispatch_status text, offered_driver_id uuid, offer_expires_at timestamptz, attempts integer)
language plpgsql security definer set search_path=public as $$
declare
  v_ride public.rides%rowtype;
  v_offer public.ride_dispatch_attempts%rowtype;
  v_driver uuid;
  v_expiry timestamptz;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into v_ride from public.rides where id=p_ride_id and rider_id=auth.uid() for update;
  if not found then raise exception 'Ride request not found'; end if;
  if v_ride.status='accepted' then
    return query select 'accepted'::text,v_ride.driver_id,null::timestamptz,v_ride.dispatch_attempt_count; return;
  elsif v_ride.status<>'requested' then
    return query select v_ride.status::text,null::uuid,null::timestamptz,v_ride.dispatch_attempt_count; return;
  end if;

  update public.ride_dispatch_attempts a set status='expired',responded_at=clock_timestamp()
    where a.ride_id=p_ride_id and a.status='offered' and a.expires_at<=clock_timestamp();

  select * into v_offer from public.ride_dispatch_attempts a
    where a.ride_id=p_ride_id and a.status='offered' and a.expires_at>clock_timestamp()
    order by a.offered_at desc limit 1;
  if found then
    return query select 'offered'::text,v_offer.driver_id,v_offer.expires_at,v_ride.dispatch_attempt_count; return;
  end if;

  select dp.user_id into v_driver
  from public.driver_profiles dp
  join public.driver_availability da on da.driver_id=dp.user_id
  where dp.application_status='approved'
    and da.is_online=true
    and da.latitude is not null and da.longitude is not null
    and da.location_updated_at>clock_timestamp()-interval '90 seconds'
    and ((dp.vehicle_type='motorcycle' and v_ride.ride_type='courier_motorcycle')
      or (dp.vehicle_type='car' and v_ride.ride_type<>'courier_motorcycle'))
    and (v_ride.ride_type<>'lotty_xl' or dp.women_service_approved=true)
    and (dp.women_riders_only=false or v_ride.ride_type='lotty_xl')
    and (v_ride.payment_method<>'card' or (
      dp.payout_provider='paystack' and dp.payout_recipient_id is not null and dp.payout_status='verified'
    ))
    and not exists(select 1 from public.ride_dispatch_attempts old
      where old.ride_id=p_ride_id and old.driver_id=dp.user_id)
    and (
      6371*2*asin(sqrt(
        power(sin(radians(da.latitude-v_ride.pickup_lat)/2),2)
        +cos(radians(v_ride.pickup_lat))*cos(radians(da.latitude))
        *power(sin(radians(da.longitude-v_ride.pickup_lng)/2),2)
      ))
    )<=20
  order by
    6371*2*asin(sqrt(
      power(sin(radians(da.latitude-v_ride.pickup_lat)/2),2)
      +cos(radians(v_ride.pickup_lat))*cos(radians(da.latitude))
      *power(sin(radians(da.longitude-v_ride.pickup_lng)/2),2)
    )) asc,
    da.location_updated_at desc
  limit 1;

  if v_driver is null then
    return query select 'searching'::text,null::uuid,null::timestamptz,v_ride.dispatch_attempt_count; return;
  end if;

  v_expiry:=clock_timestamp()+interval '7 seconds';
  insert into public.ride_dispatch_attempts(ride_id,driver_id,status,offered_at,expires_at)
    values(p_ride_id,v_driver,'offered',clock_timestamp(),v_expiry);
  update public.rides set dispatch_attempt_count=dispatch_attempt_count+1 where id=p_ride_id
    returning dispatch_attempt_count into v_ride.dispatch_attempt_count;
  return query select 'offered'::text,v_driver,v_expiry,v_ride.dispatch_attempt_count;
end;
$$;

create or replace function public.get_my_ride_offer()
returns table(ride_id uuid, expires_at timestamptz)
language sql security definer set search_path=public as $$
  select a.ride_id,a.expires_at
  from public.ride_dispatch_attempts a
  join public.rides r on r.id=a.ride_id
  join public.driver_availability da on da.driver_id=a.driver_id
  where a.driver_id=auth.uid() and a.status='offered' and a.expires_at>clock_timestamp()
    and r.status='requested' and da.is_online=true
    and da.location_updated_at>clock_timestamp()-interval '90 seconds'
  order by a.offered_at asc limit 1;
$$;

create or replace function public.accept_ride_offer(p_ride_id uuid)
returns setof public.rides
language plpgsql security definer set search_path=public as $$
declare v_ride public.rides%rowtype; v_offer public.ride_dispatch_attempts%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into v_ride from public.rides where id=p_ride_id for update;
  if not found or v_ride.status<>'requested' then raise exception 'This request is no longer available'; end if;
  select * into v_offer from public.ride_dispatch_attempts
    where ride_id=p_ride_id and driver_id=auth.uid() and status='offered' and expires_at>clock_timestamp()
    for update;
  if not found then raise exception 'This 7-second offer has expired'; end if;
  if not exists(select 1 from public.driver_availability da where da.driver_id=auth.uid()
    and da.is_online and da.location_updated_at>clock_timestamp()-interval '90 seconds') then
    raise exception 'Your online location expired. Go online again to receive requests.';
  end if;
  update public.rides set driver_id=auth.uid(),status='accepted' where id=p_ride_id returning * into v_ride;
  update public.ride_dispatch_attempts set status='accepted',responded_at=clock_timestamp() where id=v_offer.id;
  update public.driver_availability set is_online=false,updated_at=clock_timestamp() where driver_id=auth.uid();
  return next v_ride;
end;
$$;

create or replace function public.decline_ride_offer(p_ride_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  update public.ride_dispatch_attempts set status='declined',responded_at=clock_timestamp()
  where ride_id=p_ride_id and driver_id=auth.uid() and status='offered';
  if not found then raise exception 'This offer is no longer available'; end if;
end;
$$;

create or replace function public.get_nearby_online_drivers(p_latitude double precision,p_longitude double precision,p_ride_type text)
returns table(latitude double precision,longitude double precision,vehicle_type text)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'Invalid map location'; end if;
  if p_ride_type not in ('lotty_x','lotty_comfort','lotty_xl','courier_motorcycle') then raise exception 'Invalid ride type'; end if;
  return query
  select da.latitude,da.longitude,dp.vehicle_type
  from public.driver_profiles dp join public.driver_availability da on da.driver_id=dp.user_id
  where dp.application_status='approved' and da.is_online=true
    and da.latitude is not null and da.longitude is not null
    and da.location_updated_at>clock_timestamp()-interval '90 seconds'
    and ((dp.vehicle_type='motorcycle' and p_ride_type='courier_motorcycle')
      or (dp.vehicle_type='car' and p_ride_type<>'courier_motorcycle'))
    and (p_ride_type<>'lotty_xl' or dp.women_service_approved=true)
    and (dp.women_riders_only=false or p_ride_type='lotty_xl')
    and 6371*2*asin(sqrt(
      power(sin(radians(da.latitude-p_latitude)/2),2)
      +cos(radians(p_latitude))*cos(radians(da.latitude))
      *power(sin(radians(da.longitude-p_longitude)/2),2)
    ))<=20
  order by 6371*2*asin(sqrt(
      power(sin(radians(da.latitude-p_latitude)/2),2)
      +cos(radians(p_latitude))*cos(radians(da.latitude))
      *power(sin(radians(da.longitude-p_longitude)/2),2)
    )) asc limit 40;
end;
$$;

-- Driver cancellation before trip start releases the ride for the next driver.
-- Rider cancellation still ends the request and retains the existing R10 rule.
create or replace function public.cancel_ride_request(p_ride_id uuid,p_reason text)
returns table(cancelled_status text,cancellation_fee numeric,driver_distance_km numeric)
language plpgsql security definer set search_path=public as $$
declare
  v_ride public.rides%rowtype;
  v_fee numeric(10,2):=0;
  v_distance numeric;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_reason is null or p_reason not in ('Changed my mind','Booked by mistake','Driver taking too long','Pickup location is wrong','Destination or trip details changed','Found another ride','Safety concern','Other') then
    raise exception 'Choose a valid cancellation reason';
  end if;
  select * into v_ride from public.rides where id=p_ride_id
    and auth.uid() in(rider_id,driver_id) and status in('requested','accepted') for update;
  if not found then raise exception 'This ride can no longer be cancelled'; end if;

  if auth.uid()=v_ride.driver_id and v_ride.status='accepted' then
    update public.ride_dispatch_attempts set status='cancelled',responded_at=clock_timestamp()
      where ride_id=p_ride_id and driver_id=auth.uid() and status='accepted';
    perform set_config('lotty.internal_ride_update','on',true);
    update public.rides set status='requested',driver_id=null,driver_arrived_at=null,
      driver_latitude=null,driver_longitude=null,driver_location_updated_at=null,
      trip_started_at=null,trip_completed_at=null,waiting_fee_amount=0,waiting_fee_minutes=0
      where id=p_ride_id;
    update public.driver_availability set is_online=false,updated_at=clock_timestamp() where driver_id=auth.uid();
    return query select 'requested'::text,0::numeric,null::numeric;
    return;
  end if;

  if auth.uid()=v_ride.rider_id and v_ride.status='accepted'
    and v_ride.driver_latitude is not null and v_ride.driver_longitude is not null
    and v_ride.driver_location_updated_at>clock_timestamp()-interval '120 seconds' then
    v_distance:=2*6371*asin(sqrt(
      power(sin(radians(v_ride.driver_latitude-v_ride.pickup_lat)/2),2)
      +cos(radians(v_ride.pickup_lat))*cos(radians(v_ride.driver_latitude))
      *power(sin(radians(v_ride.driver_longitude-v_ride.pickup_lng)/2),2)
    ));
    if v_distance<1 then v_fee:=10.00; end if;
  end if;
  perform set_config('lotty.internal_ride_update','on',true);
  update public.rides set status='cancelled',cancellation_reason=p_reason,cancelled_by=auth.uid(),
    cancelled_at=clock_timestamp(),cancellation_fee_amount=v_fee where id=p_ride_id;
  return query select 'cancelled'::text,v_fee,v_distance;
end;
$$;

revoke all on function public.advance_ride_dispatch(uuid) from public,anon;
revoke all on function public.get_my_ride_offer() from public,anon;
revoke all on function public.accept_ride_offer(uuid) from public,anon;
revoke all on function public.decline_ride_offer(uuid) from public,anon;
revoke all on function public.get_nearby_online_drivers(double precision,double precision,text) from public,anon;
revoke all on function public.cancel_ride_request(uuid,text) from public,anon;
grant execute on function public.advance_ride_dispatch(uuid) to authenticated;
grant execute on function public.get_my_ride_offer() to authenticated;
grant execute on function public.accept_ride_offer(uuid) to authenticated;
grant execute on function public.decline_ride_offer(uuid) to authenticated;
grant execute on function public.get_nearby_online_drivers(double precision,double precision,text) to authenticated;
grant execute on function public.cancel_ride_request(uuid,text) to authenticated;
commit;