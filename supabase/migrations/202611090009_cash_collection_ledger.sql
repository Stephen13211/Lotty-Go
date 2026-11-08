-- Cash ride confirmation and auditable 75/25 cash commission ledger.
begin;

alter table public.rides
 add column if not exists cash_collected_at timestamptz,
 add column if not exists cash_collected_by uuid references auth.users(id);

do $$
declare c record;
begin
 for c in select conname from pg_constraint
  where conrelid='public.payments'::regclass and contype='c'
    and pg_get_constraintdef(oid) ilike '%payment_method%'
 loop
  execute format('alter table public.payments drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.payments add constraint payments_payment_method_allowed
 check (payment_method in ('card','cash'));

create or replace function public.confirm_cash_payment(p_ride_id uuid)
returns table(payment_id uuid,driver_share numeric,lotty_share numeric,settlement_status text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_ride public.rides%rowtype; v_payment public.payments%rowtype;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 select * into v_ride from public.rides
  where id=p_ride_id and driver_id=auth.uid() and status='completed' and payment_method='cash'
  for update;
 if not found then raise exception 'Only the assigned driver can confirm cash for a completed cash trip'; end if;
 if v_ride.cash_collected_at is not null then
  select * into v_payment from public.payments where ride_id=p_ride_id;
  return query select v_payment.id,v_payment.driver_share,v_payment.lotty_share,v_payment.lotty_settlement_status;
  return;
 end if;
 insert into public.payments(
  ride_id,rider_id,driver_id,total_fare,payment_method,driver_share,lotty_share,
  currency,gateway,collection_status,driver_payout_status,lotty_settlement_status,paid_at
 ) values(
  v_ride.id,v_ride.rider_id,v_ride.driver_id,v_ride.fare,'cash',
  round(v_ride.fare*0.75,2),v_ride.fare-round(v_ride.fare*0.75,2),
  'ZAR','cash', 'paid','paid','pending',clock_timestamp()
 ) on conflict(ride_id) do update set
  total_fare=excluded.total_fare,payment_method='cash',collection_status='paid',
  driver_payout_status='paid',lotty_settlement_status=case when payments.lotty_settlement_status='paid' then 'paid' else 'pending' end,
  paid_at=coalesce(payments.paid_at,excluded.paid_at)
 returning * into v_payment;
 update public.rides set payment_status='paid',cash_collected_at=clock_timestamp(),cash_collected_by=auth.uid()
  where id=p_ride_id;
 return query select v_payment.id,v_payment.driver_share,v_payment.lotty_share,v_payment.lotty_settlement_status;
end;
$$;
revoke all on function public.confirm_cash_payment(uuid) from public,anon;
grant execute on function public.confirm_cash_payment(uuid) to authenticated;

create or replace function public.admin_mark_cash_commission_received(p_payment_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if auth.uid() is null or (auth.jwt()->'app_metadata'->>'role') <> 'admin' then
  raise exception 'Administrator access required';
 end if;
 update public.payments set lotty_settlement_status='paid'
 where id=p_payment_id and payment_method='cash' and collection_status='paid' and lotty_settlement_status='pending';
 if not found then raise exception 'Cash commission not found or already settled'; end if;
end;
$$;
revoke all on function public.admin_mark_cash_commission_received(uuid) from public,anon;
grant execute on function public.admin_mark_cash_commission_received(uuid) to authenticated;

commit;