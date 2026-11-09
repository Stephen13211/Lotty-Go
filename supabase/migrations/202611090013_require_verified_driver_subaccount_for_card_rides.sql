-- Only drivers with verified Paystack subaccounts may accept card rides.
create or replace function public.claim_ride_request(p_ride_id uuid)
returns setof public.rides
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.driver_profiles%rowtype;
  v_ride public.rides%rowtype;
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  select * into v_profile from public.driver_profiles
  where user_id = auth.uid() and application_status = 'approved';
  if not found then raise exception 'Your driver account is not approved'; end if;
  if not exists (
    select 1 from public.driver_availability a
    where a.driver_id = auth.uid() and a.is_online
      and a.location_updated_at > clock_timestamp() - interval '90 seconds'
  ) then raise exception 'Go online and enable location before accepting requests'; end if;

  update public.rides r
  set driver_id = auth.uid(), status = 'accepted'
  where r.id = p_ride_id and r.status = 'requested'
    and (r.payment_method <> 'card' or (
      v_profile.payout_provider = 'paystack'
      and v_profile.payout_recipient_id is not null
      and v_profile.payout_status = 'verified'
    ))
    and ((v_profile.vehicle_type = 'motorcycle' and r.ride_type = 'courier_motorcycle')
      or (v_profile.vehicle_type = 'car' and r.ride_type <> 'courier_motorcycle'))
    and (r.ride_type <> 'lotty_xl' or v_profile.women_service_approved)
    and (not v_profile.women_riders_only or r.ride_type = 'lotty_xl')
  returning * into v_ride;

  if not found then raise exception 'This request is no longer available or your account is not eligible for this payment or vehicle type'; end if;
  return next v_ride;
end;
$$;
revoke all on function public.claim_ride_request(uuid) from public, anon;
grant execute on function public.claim_ride_request(uuid) to authenticated;