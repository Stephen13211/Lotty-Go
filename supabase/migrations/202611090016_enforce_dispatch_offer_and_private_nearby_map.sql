-- Enforce the seven-second offer at the database boundary and reduce map-location precision.
begin;

drop policy if exists driver_accept on public.rides;
create policy driver_accept on public.rides
for update to authenticated
using (
  status='requested'
  and exists (
    select 1 from public.ride_dispatch_attempts a
    where a.ride_id=rides.id and a.driver_id=auth.uid()
      and a.status='offered' and a.expires_at>clock_timestamp()
  )
  and exists (
    select 1 from public.driver_profiles p
    where p.user_id=auth.uid() and p.application_status='approved'
      and ((p.vehicle_type='motorcycle' and rides.ride_type='courier_motorcycle')
        or (p.vehicle_type='car' and rides.ride_type<>'courier_motorcycle'))
      and (rides.ride_type<>'lotty_xl' or p.women_service_approved=true)
      and (p.women_riders_only=false or rides.ride_type='lotty_xl')
      and (rides.payment_method<>'card' or
        (p.payout_provider='paystack' and p.payout_recipient_id is not null and p.payout_status='verified'))
  )
)
with check (
  auth.uid()=driver_id
  and exists (
    select 1 from public.ride_dispatch_attempts a
    where a.ride_id=rides.id and a.driver_id=auth.uid()
      and a.status='offered' and a.expires_at>clock_timestamp()
  )
  and exists (
    select 1 from public.driver_profiles p
    where p.user_id=auth.uid() and p.application_status='approved'
      and ((p.vehicle_type='motorcycle' and rides.ride_type='courier_motorcycle')
        or (p.vehicle_type='car' and rides.ride_type<>'courier_motorcycle'))
      and (rides.ride_type<>'lotty_xl' or p.women_service_approved=true)
      and (p.women_riders_only=false or rides.ride_type='lotty_xl')
      and (rides.payment_method<>'card' or
        (p.payout_provider='paystack' and p.payout_recipient_id is not null and p.payout_status='verified'))
  )
);

-- All app acceptance now uses accept_ride_offer(), which verifies the current offer.
revoke all on function public.claim_ride_request(uuid) from public,anon,authenticated;

create or replace function public.get_nearby_online_drivers(p_latitude double precision,p_longitude double precision,p_ride_type text)
returns table(latitude double precision,longitude double precision,vehicle_type text)
language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then raise exception 'Invalid map location'; end if;
  if p_ride_type not in ('lotty_x','lotty_comfort','lotty_xl','courier_motorcycle') then raise exception 'Invalid ride type'; end if;
  return query
  select round(da.latitude::numeric,3)::double precision,
         round(da.longitude::numeric,3)::double precision,dp.vehicle_type
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
    ))<=15
  order by 6371*2*asin(sqrt(
      power(sin(radians(da.latitude-p_latitude)/2),2)
      +cos(radians(p_latitude))*cos(radians(da.latitude))
      *power(sin(radians(da.longitude-p_longitude)/2),2)
    )) asc limit 30;
end;
$$;
revoke all on function public.get_nearby_online_drivers(double precision,double precision,text) from public,anon;
grant execute on function public.get_nearby_online_drivers(double precision,double precision,text) to authenticated;
commit;