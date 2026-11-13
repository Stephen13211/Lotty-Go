-- Cash riders are never charged cancellation fees. Card cancellation fees are split 75/25.
-- Driver cancellation ends the booking and records a full refund obligation if already paid.
begin;
alter table public.rides
  add column if not exists cancellation_fee_driver_share numeric(10,2) not null default 0,
  add column if not exists cancellation_fee_lotty_share numeric(10,2) not null default 0,
  add column if not exists cancellation_fee_status text not null default 'not_applicable',
  add column if not exists refund_amount numeric(10,2) not null default 0,
  add column if not exists refund_status text not null default 'not_applicable';
alter table public.rides
  drop constraint if exists rides_cancellation_fee_status_check,
  add constraint rides_cancellation_fee_status_check check (cancellation_fee_status in ('not_applicable','due','paid','waived')),
  drop constraint if exists rides_refund_status_check,
  add constraint rides_refund_status_check check (refund_status in ('not_applicable','pending','processing','refunded','failed'));
drop function if exists public.cancel_ride_request(uuid,text);
create function public.cancel_ride_request(p_ride_id uuid,p_reason text)
returns table(cancelled_status text,cancellation_fee numeric,driver_distance_km numeric,driver_fee_share numeric,lotty_fee_share numeric,refund_amount numeric,refund_status text)
language plpgsql security definer set search_path=public as $$
declare
  v_ride public.rides%rowtype;
  v_fee numeric(10,2):=0;
  v_distance numeric;
  v_driver_share numeric(10,2):=0;
  v_lotty_share numeric(10,2):=0;
  v_refund numeric(10,2):=0;
  v_refund_status text:='not_applicable';
begin
  if auth.uid() is null then raise exception 'Sign in required'; end if;
  if p_reason is null or p_reason not in ('Changed my mind','Booked by mistake','Driver taking too long','Pickup location is wrong','Destination or trip details changed','Found another ride','Safety concern','Other') then
    raise exception 'Choose a valid cancellation reason';
  end if;
  select * into v_ride from public.rides
   where id=p_ride_id and auth.uid() in (rider_id,driver_id) and status in ('requested','accepted') for update;
  if not found then raise exception 'This ride can no longer be cancelled. Trips cannot be cancelled after they have started.'; end if;

  if auth.uid()=v_ride.driver_id and v_ride.status='accepted' then
    update public.ride_dispatch_attempts set status='cancelled',responded_at=clock_timestamp()
     where ride_id=p_ride_id and driver_id=auth.uid() and status='accepted';
    if v_ride.payment_method='card' and v_ride.payment_status='paid' then
      v_refund:=round(v_ride.fare,2); v_refund_status:='pending';
    end if;
    perform set_config('lotty.internal_ride_update','on',true);
    update public.rides set status='cancelled',cancellation_reason='Driver cancelled: '||p_reason,
      cancelled_by=auth.uid(),cancelled_at=clock_timestamp(),cancellation_fee_amount=0,
      cancellation_fee_driver_share=0,cancellation_fee_lotty_share=0,cancellation_fee_status='not_applicable',
      refund_amount=v_refund,refund_status=v_refund_status,trip_started_at=null,trip_completed_at=null,
      waiting_fee_amount=0,waiting_fee_minutes=0 where id=p_ride_id;
    update public.driver_availability set is_online=false,updated_at=clock_timestamp() where driver_id=auth.uid();
    return query select 'cancelled'::text,0::numeric,v_distance,0::numeric,0::numeric,v_refund,v_refund_status;
    return;
  end if;

  if auth.uid()=v_ride.rider_id and v_ride.payment_method='card' and v_ride.status='accepted'
     and v_ride.driver_latitude is not null and v_ride.driver_longitude is not null
     and v_ride.driver_location_updated_at>clock_timestamp()-interval '120 seconds' then
    v_distance:=2*6371*asin(sqrt(
      power(sin(radians(v_ride.driver_latitude-v_ride.pickup_lat)/2),2)
      +cos(radians(v_ride.pickup_lat))*cos(radians(v_ride.driver_latitude))
      *power(sin(radians(v_ride.driver_longitude-v_ride.pickup_lng)/2),2)));
    if v_distance<1 then v_fee:=10.00; v_driver_share:=7.50; v_lotty_share:=2.50; end if;
  end if;

  if v_ride.payment_method='card' and v_ride.payment_status='paid' then
    v_refund:=greatest(0,round(v_ride.fare-v_fee,2));
    if v_refund>0 then v_refund_status:='pending'; end if;
  end if;
  perform set_config('lotty.internal_ride_update','on',true);
  update public.rides set status='cancelled',cancellation_reason=p_reason,cancelled_by=auth.uid(),
    cancelled_at=clock_timestamp(),cancellation_fee_amount=v_fee,
    cancellation_fee_driver_share=v_driver_share,cancellation_fee_lotty_share=v_lotty_share,
    cancellation_fee_status=case when v_fee>0 then 'due' else 'not_applicable' end,
    refund_amount=v_refund,refund_status=v_refund_status where id=p_ride_id;
  return query select 'cancelled'::text,v_fee,v_distance,v_driver_share,v_lotty_share,v_refund,v_refund_status;
end; $$;
revoke all on function public.cancel_ride_request(uuid,text) from public,anon;
grant execute on function public.cancel_ride_request(uuid,text) to authenticated;
comment on column public.rides.cancellation_fee_driver_share is 'Driver share of a card cancellation fee; 75% (R7.50 of R10).';
comment on column public.rides.cancellation_fee_lotty_share is 'Lotty Go share of a card cancellation fee; 25% (R2.50 of R10).';
comment on column public.rides.refund_status is 'Pending means the payment provider still needs to process the refund; it is not proof of completion.';
commit;
