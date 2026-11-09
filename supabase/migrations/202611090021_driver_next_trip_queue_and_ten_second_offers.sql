-- Queued next-trip offers for drivers on an active ride.
-- The accepted next ride remains requested until the current ride ends.
begin;
create table if not exists public.driver_next_trip_queue (
 id uuid primary key default gen_random_uuid(),
 ride_id uuid not null unique references public.rides(id) on delete cascade,
 driver_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'accepted' check(status in('accepted','activated','cancelled')),
 accepted_at timestamptz not null default clock_timestamp(), activated_at timestamptz
);
create unique index if not exists driver_one_accepted_next_trip on public.driver_next_trip_queue(driver_id) where status='accepted';
alter table public.driver_next_trip_queue enable row level security;
revoke all on public.driver_next_trip_queue from anon,authenticated;

create or replace function public.get_my_next_trip_offer()
returns table(ride_id uuid,expires_at timestamptz,pickup_address text,dropoff_address text,fare numeric,distance_km numeric,ride_type text)
language sql security definer set search_path=public as $$
 select r.id,a.expires_at,r.pickup_address,r.dropoff_address,r.fare,r.distance_km,r.ride_type
 from public.ride_dispatch_attempts a join public.rides r on r.id=a.ride_id
 where a.driver_id=auth.uid() and a.status='offered' and a.expires_at>clock_timestamp() and r.status='requested'
 and exists(select 1 from public.rides cr where cr.driver_id=auth.uid() and cr.status in('accepted','in_progress'))
 order by a.offered_at limit 1;
$$;
create or replace function public.accept_next_trip_offer(p_ride_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare r public.rides%rowtype; a public.ride_dispatch_attempts%rowtype; d public.driver_profiles%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 perform 1 from public.rides where driver_id=auth.uid() and status in('accepted','in_progress') for update;
 if not found then raise exception 'Your current trip is no longer active'; end if;
 select * into r from public.rides where id=p_ride_id and status='requested' for update;
 if not found then raise exception 'This request is no longer available'; end if;
 select * into a from public.ride_dispatch_attempts where ride_id=p_ride_id and driver_id=auth.uid()
 and status='offered' and expires_at>clock_timestamp() for update;
 if not found then raise exception 'This 10-second offer has expired'; end if;
 select * into d from public.driver_profiles where user_id=auth.uid() and application_status='approved';
 if not found then raise exception 'Your driver approval is no longer active'; end if;
 if not ((d.vehicle_type='motorcycle' and r.ride_type='courier_motorcycle') or (d.vehicle_type='car' and r.ride_type<>'courier_motorcycle')) then raise exception 'Your vehicle is not eligible for this request'; end if;
 if r.ride_type='lotty_xl' and d.women_service_approved is distinct from true then raise exception 'Your account is not approved for this ride category'; end if;
 if d.women_riders_only and r.ride_type<>'lotty_xl' then raise exception 'Your ride preferences do not allow this request'; end if;
 if r.payment_method='card' and not(d.payout_provider='paystack' and d.payout_recipient_id is not null and d.payout_status='verified') then raise exception 'A verified Paystack payout account is required for card rides'; end if;
 insert into public.driver_next_trip_queue(ride_id,driver_id,status) values(p_ride_id,auth.uid(),'accepted');
 update public.ride_dispatch_attempts set status='accepted',responded_at=clock_timestamp() where id=a.id;
end; $$;
create or replace function public.decline_next_trip_offer(p_ride_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.ride_dispatch_attempts set status='declined',responded_at=clock_timestamp()
 where ride_id=p_ride_id and driver_id=auth.uid() and status='offered' and expires_at>clock_timestamp();
 if not found then raise exception 'This offer is no longer available'; end if;
end; $$;

create or replace function public.activate_driver_next_trip(p_driver_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare q public.driver_next_trip_queue%rowtype;
begin
 if exists(select 1 from public.rides where driver_id=p_driver_id and status in('accepted','in_progress')) then return; end if;
 select * into q from public.driver_next_trip_queue where driver_id=p_driver_id and status='accepted' order by accepted_at limit 1 for update;
 if not found then return; end if;
 update public.rides set driver_id=p_driver_id,status='accepted' where id=q.ride_id and status='requested' and driver_id is null;
 if found then
  update public.driver_next_trip_queue set status='activated',activated_at=clock_timestamp() where id=q.id;
  update public.driver_availability set is_online=false,updated_at=clock_timestamp() where driver_id=p_driver_id;
 else update public.driver_next_trip_queue set status='cancelled' where id=q.id; end if;
end; $$;
create or replace function public.activate_queued_trip_after_current_change()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if old.driver_id is not null and (new.status in('completed','cancelled') or (new.status='requested' and new.driver_id is null)) then
  perform public.activate_driver_next_trip(old.driver_id);
 end if;
 return new;
end; $$;
drop trigger if exists activate_queued_trip_after_current_change on public.rides;
create trigger activate_queued_trip_after_current_change after update of status,driver_id on public.rides
for each row execute function public.activate_queued_trip_after_current_change();

-- Extend dispatch to busy drivers only after no eligible idle driver is available.
create or replace function public.advance_ride_dispatch(p_ride_id uuid)
returns table(dispatch_status text,offered_driver_id uuid,offer_expires_at timestamptz,attempts integer)
language plpgsql security definer set search_path=public as $$
declare r public.rides%rowtype; a public.ride_dispatch_attempts%rowtype; d uuid; expiry timestamptz;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into r from public.rides where id=p_ride_id and rider_id=auth.uid() for update;
 if not found then raise exception 'Ride request not found'; end if;
 if r.status='accepted' then return query select 'accepted'::text,r.driver_id,null::timestamptz,r.dispatch_attempt_count; return;
 elsif r.status<>'requested' then return query select r.status::text,null::uuid,null::timestamptz,r.dispatch_attempt_count; return; end if;
 update public.ride_dispatch_attempts set status='expired',responded_at=clock_timestamp()
 where ride_id=p_ride_id and status='offered' and expires_at<=clock_timestamp();
 select * into a from public.ride_dispatch_attempts where ride_id=p_ride_id and status='offered' and expires_at>clock_timestamp() limit 1;
 if found then return query select 'offered'::text,a.driver_id,a.expires_at,r.dispatch_attempt_count; return; end if;

 select dp.user_id into d from public.driver_profiles dp join public.driver_availability da on da.driver_id=dp.user_id
 where dp.application_status='approved' and da.is_online and da.latitude is not null and da.longitude is not null
 and da.location_updated_at>clock_timestamp()-interval '90 seconds'
 and ((dp.vehicle_type='motorcycle' and r.ride_type='courier_motorcycle') or (dp.vehicle_type='car' and r.ride_type<>'courier_motorcycle'))
 and (r.ride_type<>'lotty_xl' or dp.women_service_approved=true) and (dp.women_riders_only=false or r.ride_type='lotty_xl')
 and (r.payment_method<>'card' or (dp.payout_provider='paystack' and dp.payout_recipient_id is not null and dp.payout_status='verified'))
 and not exists(select 1 from public.ride_dispatch_attempts x where x.ride_id=p_ride_id and x.driver_id=dp.user_id)
 and not exists(select 1 from public.driver_next_trip_queue q where q.driver_id=dp.user_id and q.status='accepted')
 and 6371*2*asin(sqrt(power(sin(radians(da.latitude-r.pickup_lat)/2),2)+cos(radians(r.pickup_lat))*cos(radians(da.latitude))*power(sin(radians(da.longitude-r.pickup_lng)/2),2)))<=20
 order by 6371*2*asin(sqrt(power(sin(radians(da.latitude-r.pickup_lat)/2),2)+cos(radians(r.pickup_lat))*cos(radians(da.latitude))*power(sin(radians(da.longitude-r.pickup_lng)/2),2))) limit 1;

 if d is null then
  select dp.user_id into d from public.driver_profiles dp
  join lateral(select x.driver_latitude lat,x.driver_longitude lng,x.driver_location_updated_at upd from public.rides x
    where x.driver_id=dp.user_id and x.status in('accepted','in_progress') and x.driver_latitude is not null and x.driver_longitude is not null
    and x.driver_location_updated_at>clock_timestamp()-interval '90 seconds' order by x.created_at desc limit 1) loc on true
  where dp.application_status='approved'
  and ((dp.vehicle_type='motorcycle' and r.ride_type='courier_motorcycle') or (dp.vehicle_type='car' and r.ride_type<>'courier_motorcycle'))
  and (r.ride_type<>'lotty_xl' or dp.women_service_approved=true) and (dp.women_riders_only=false or r.ride_type='lotty_xl')
  and (r.payment_method<>'card' or (dp.payout_provider='paystack' and dp.payout_recipient_id is not null and dp.payout_status='verified'))
  and not exists(select 1 from public.ride_dispatch_attempts x where x.ride_id=p_ride_id and x.driver_id=dp.user_id)
  and not exists(select 1 from public.driver_next_trip_queue q where q.driver_id=dp.user_id and q.status='accepted')
  and not exists(select 1 from public.ride_dispatch_attempts x where x.driver_id=dp.user_id and x.status='offered' and x.expires_at>clock_timestamp())
  and 6371*2*asin(sqrt(power(sin(radians(loc.lat-r.pickup_lat)/2),2)+cos(radians(r.pickup_lat))*cos(radians(loc.lat))*power(sin(radians(loc.lng-r.pickup_lng)/2),2)))<=20
  order by 6371*2*asin(sqrt(power(sin(radians(loc.lat-r.pickup_lat)/2),2)+cos(radians(r.pickup_lat))*cos(radians(loc.lat))*power(sin(radians(loc.lng-r.pickup_lng)/2),2))) limit 1;
 end if;
 if d is null then return query select 'searching'::text,null::uuid,null::timestamptz,r.dispatch_attempt_count; return; end if;
 expiry:=clock_timestamp()+interval '10 seconds';
 insert into public.ride_dispatch_attempts(ride_id,driver_id,status,offered_at,expires_at) values(p_ride_id,d,'offered',clock_timestamp(),expiry);
 update public.rides set dispatch_attempt_count=dispatch_attempt_count+1 where id=p_ride_id returning dispatch_attempt_count into r.dispatch_attempt_count;
 return query select 'offered'::text,d,expiry,r.dispatch_attempt_count;
end; $$;
create or replace function public.get_my_ride_offer()
returns table(ride_id uuid,expires_at timestamptz) language sql security definer set search_path=public as $$
 select a.ride_id,a.expires_at from public.ride_dispatch_attempts a join public.rides r on r.id=a.ride_id
 join public.driver_availability da on da.driver_id=a.driver_id
 where a.driver_id=auth.uid() and a.status='offered' and a.expires_at>clock_timestamp() and r.status='requested'
 and da.is_online and da.location_updated_at>clock_timestamp()-interval '90 seconds' order by a.offered_at limit 1;
$$;
revoke all on function public.get_my_next_trip_offer() from public,anon;
revoke all on function public.accept_next_trip_offer(uuid) from public,anon;
revoke all on function public.decline_next_trip_offer(uuid) from public,anon;
revoke all on function public.activate_driver_next_trip(uuid) from public,anon,authenticated;
revoke all on function public.activate_queued_trip_after_current_change() from public,anon,authenticated;
grant execute on function public.get_my_next_trip_offer() to authenticated;
grant execute on function public.accept_next_trip_offer(uuid) to authenticated;
grant execute on function public.decline_next_trip_offer(uuid) to authenticated;
commit;