-- Revalidate driver approval, vehicle eligibility and payout status at offer acceptance.
begin;
create or replace function public.accept_ride_offer(p_ride_id uuid)
returns setof public.rides
language plpgsql security definer set search_path=public as $$
declare
  v_ride public.rides%rowtype;
  v_offer public.ride_dispatch_attempts%rowtype;
  v_profile public.driver_profiles%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into v_ride from public.rides where id=p_ride_id for update;
  if not found or v_ride.status<>'requested' then raise exception 'This request is no longer available'; end if;

  select * into v_offer from public.ride_dispatch_attempts
    where ride_id=p_ride_id and driver_id=auth.uid()
      and status='offered' and expires_at>clock_timestamp()
    for update;
  if not found then raise exception 'This 7-second offer has expired'; end if;

  select * into v_profile from public.driver_profiles
    where user_id=auth.uid() and application_status='approved';
  if not found then raise exception 'Your driver approval is no longer active'; end if;
  if not (
    (v_profile.vehicle_type='motorcycle' and v_ride.ride_type='courier_motorcycle')
    or (v_profile.vehicle_type='car' and v_ride.ride_type<>'courier_motorcycle')
  ) then raise exception 'Your vehicle is not eligible for this request'; end if;
  if v_ride.ride_type='lotty_xl' and v_profile.women_service_approved is distinct from true then
    raise exception 'Your account is not approved for this ride category';
  end if;
  if v_profile.women_riders_only and v_ride.ride_type<>'lotty_xl' then
    raise exception 'Your ride preferences do not allow this request';
  end if;
  if v_ride.payment_method='card' and not (
    v_profile.payout_provider='paystack'
    and v_profile.payout_recipient_id is not null
    and v_profile.payout_status='verified'
  ) then raise exception 'A verified Paystack payout account is required for card rides'; end if;
  if not exists(select 1 from public.driver_availability da where da.driver_id=auth.uid()
    and da.is_online and da.location_updated_at>clock_timestamp()-interval '90 seconds') then
    raise exception 'Your online location expired. Go online again to receive requests.';
  end if;

  update public.rides set driver_id=auth.uid(),status='accepted'
    where id=p_ride_id returning * into v_ride;
  update public.ride_dispatch_attempts set status='accepted',responded_at=clock_timestamp() where id=v_offer.id;
  update public.driver_availability set is_online=false,updated_at=clock_timestamp() where driver_id=auth.uid();
  return next v_ride;
end;
$$;
revoke all on function public.accept_ride_offer(uuid) from public,anon;
grant execute on function public.accept_ride_offer(uuid) to authenticated;
commit;