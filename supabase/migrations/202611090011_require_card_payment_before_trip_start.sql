-- Card rides cannot start until Paystack confirms successful payment.
begin;

create or replace function public.start_ride_trip(p_ride_id uuid)
returns table(ride_status text, final_waiting_fee numeric, billable_waiting_minutes integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ride public.rides%rowtype;
  v_free integer;
  v_rate numeric;
  v_elapsed integer;
  v_billable integer;
  v_fee numeric;
begin
  select * into v_ride
  from public.rides
  where id = p_ride_id and driver_id = auth.uid() and status = 'accepted'
  for update;

  if not found then
    raise exception 'Ride not found or not assigned to this driver';
  end if;

  if v_ride.payment_method = 'card' and v_ride.payment_status <> 'paid' then
    raise exception 'Card payment must be completed before the trip can start';
  end if;

  if v_ride.driver_arrived_at is null then
    raise exception 'Mark your arrival before starting the trip';
  end if;

  if not exists (
    select 1 from public.ride_pickup_pins
    where ride_id = p_ride_id and verified_at is not null
  ) then
    raise exception 'Verify the rider pickup PIN before starting';
  end if;

  select waiting_free_minutes, waiting_fee_per_minute
  into v_free, v_rate
  from public.platform_settings where id = true;

  v_elapsed := greatest(0, floor(extract(epoch from (clock_timestamp() - v_ride.driver_arrived_at)))::integer);
  v_billable := case
    when v_elapsed <= v_free * 60 then 0
    else ceil((v_elapsed - v_free * 60)::numeric / 60)::integer
  end;
  v_fee := round(v_billable * v_rate, 2);

  perform set_config('lotty.internal_ride_update', 'on', true);
  update public.rides
  set status = 'in_progress',
      trip_started_at = clock_timestamp(),
      waiting_fee_amount = v_fee,
      waiting_fee_minutes = v_billable,
      fare = fare + v_fee
  where id = p_ride_id;

  return query select 'in_progress'::text, v_fee, v_billable;
end;
$$;

revoke all on function public.start_ride_trip(uuid) from public, anon;
grant execute on function public.start_ride_trip(uuid) to authenticated;

commit;