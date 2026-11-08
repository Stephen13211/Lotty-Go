-- Rider/driver cancellation reasons and server-calculated close-pickup cancellation fee.
begin;
alter table public.rides
 add column if not exists cancellation_reason text,
 add column if not exists cancelled_by uuid references auth.users(id),
 add column if not exists cancelled_at timestamptz,
 add column if not exists cancellation_fee_amount numeric(10,2) not null default 0;

create or replace function public.cancel_ride_request(p_ride_id uuid,p_reason text)
returns table(cancelled_status text,cancellation_fee numeric,driver_distance_km numeric)
language plpgsql security definer set search_path=public as $$
declare v_ride public.rides%rowtype; v_fee numeric(10,2):=0; v_distance numeric;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_reason is null or p_reason not in ('Changed my mind','Booked by mistake','Driver taking too long','Pickup location is wrong','Destination or trip details changed','Found another ride','Safety concern','Other') then
   raise exception 'Choose a valid cancellation reason';
 end if;
 select * into v_ride from public.rides where id=p_ride_id and auth.uid() in(rider_id,driver_id)
 and status in('requested','accepted') for update;
 if not found then raise exception 'This ride can no longer be cancelled'; end if;
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
end; $$;
-- Extend the existing lifecycle guard to permit only the cancellation metadata
-- alongside a participant cancellation; all route/fare/assignment fields remain immutable.
create or replace function public.lotty_guard_ride_lifecycle()
returns trigger language plpgsql set search_path=public as $function$
begin
 if current_setting('lotty.internal_ride_update',true)='on' then return new; end if;
 if auth.uid() is null then return new; end if;
 if old.status='requested' and new.status='accepted' and new.driver_id=auth.uid()
    and (to_jsonb(new)-'driver_id'-'status') is not distinct from (to_jsonb(old)-'driver_id'-'status') then return new; end if;
 if new.status='cancelled' and auth.uid() in (old.rider_id,old.driver_id)
    and (to_jsonb(new)-'status'-'cancellation_reason'-'cancelled_by'-'cancelled_at'-'cancellation_fee_amount')
      is not distinct from
        (to_jsonb(old)-'status'-'cancellation_reason'-'cancelled_by'-'cancelled_at'-'cancellation_fee_amount')
 then return new; end if;
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
end; $function$;

revoke all on function public.cancel_ride_request(uuid,text) from public;
grant execute on function public.cancel_ride_request(uuid,text) to authenticated;
commit;
