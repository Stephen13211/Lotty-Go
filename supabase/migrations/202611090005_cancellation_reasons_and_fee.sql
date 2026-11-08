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
 if p_reason not in ('Changed my mind','Booked by mistake','Driver taking too long','Pickup location is wrong','Destination or trip details changed','Found another ride','Safety concern','Other') then
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
revoke all on function public.cancel_ride_request(uuid,text) from public;
grant execute on function public.cancel_ride_request(uuid,text) to authenticated;
commit;
