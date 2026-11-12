-- Correct cash fare allocation: 100% to driver, 0% to Lotty Go.
-- Card allocation remains 75% driver / 25% Lotty Go.
begin;

create or replace function public.set_lotty_payment_split()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.payment_method = 'cash' then
    new.driver_share := new.total_fare;
    new.lotty_share := 0;
  else
    new.driver_share := round(new.total_fare * 0.75, 2);
    new.lotty_share := new.total_fare - new.driver_share;
  end if;
  return new;
end;
$$;

create or replace function public.confirm_cash_payment(p_ride_id uuid)
returns table(payment_id uuid, driver_share numeric, lotty_share numeric, settlement_status text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ride public.rides%rowtype;
  v_payment public.payments%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Sign in required';
  end if;

  select * into v_ride
  from public.rides
  where id = p_ride_id
    and driver_id = auth.uid()
    and status = 'completed'
    and payment_method = 'cash'
  for update;

  if not found then
    raise exception 'Only the assigned driver can confirm cash for a completed cash trip';
  end if;

  if v_ride.cash_collected_at is not null then
    select * into v_payment from public.payments where ride_id = p_ride_id;
    return query select v_payment.id, v_payment.driver_share, v_payment.lotty_share, v_payment.lotty_settlement_status;
    return;
  end if;

  insert into public.payments (
    ride_id, rider_id, driver_id, total_fare, payment_method,
    driver_share, lotty_share, currency, gateway, collection_status,
    driver_payout_status, lotty_settlement_status, paid_at
  ) values (
    v_ride.id, v_ride.rider_id, v_ride.driver_id, v_ride.fare, 'cash',
    v_ride.fare, 0, 'ZAR', 'cash', 'paid',
    'paid', 'not_ready', clock_timestamp()
  )
  on conflict (ride_id) do update set
    total_fare = excluded.total_fare,
    payment_method = 'cash',
    driver_share = excluded.driver_share,
    lotty_share = 0,
    collection_status = 'paid',
    driver_payout_status = 'paid',
    lotty_settlement_status = 'not_ready',
    paid_at = coalesce(payments.paid_at, excluded.paid_at)
  returning * into v_payment;

  update public.rides
  set payment_status = 'paid',
      cash_collected_at = clock_timestamp(),
      cash_collected_by = auth.uid()
  where id = p_ride_id;

  return query select v_payment.id, v_payment.driver_share, v_payment.lotty_share, v_payment.lotty_settlement_status;
end;
$$;

revoke all on function public.confirm_cash_payment(uuid) from public, anon;
grant execute on function public.confirm_cash_payment(uuid) to authenticated;

commit;
