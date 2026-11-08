-- Four-digit pickup PIN: visible only to the rider, verified by the assigned driver.
begin;
create table if not exists public.ride_pickup_pins(
 ride_id uuid primary key references public.rides(id) on delete cascade,
 rider_id uuid not null references auth.users(id) on delete cascade,
 pin_hash text not null,
 pin_value text not null,
 created_at timestamptz not null default now(),
 verified_at timestamptz
);
alter table public.ride_pickup_pins enable row level security;
drop policy if exists ride_pickup_pins_rider_read on public.ride_pickup_pins;
create policy ride_pickup_pins_rider_read on public.ride_pickup_pins
 for select to authenticated using(rider_id=auth.uid());
revoke all on public.ride_pickup_pins from anon,authenticated;
grant select on public.ride_pickup_pins to authenticated;

create or replace function public.create_ride_pickup_pin()
returns trigger language plpgsql security definer set search_path=public,extensions as $$
declare v_pin text;
begin
 v_pin:=lpad((1000+floor(random()*9000)::integer)::text,4,'0');
 insert into public.ride_pickup_pins(ride_id,rider_id,pin_hash,pin_value)
 values(new.id,new.rider_id,encode(digest(v_pin,'sha256'),'hex'),v_pin);
 return new;
end; $$;
drop trigger if exists rides_create_pickup_pin on public.rides;
create trigger rides_create_pickup_pin after insert on public.rides
 for each row execute function public.create_ride_pickup_pin();

create or replace function public.verify_ride_pickup_pin(p_ride_id uuid,p_pin text)
returns boolean language plpgsql security definer set search_path=public,extensions as $$
declare v_ok boolean;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_pin is null or p_pin !~ '^[0-9]{4}$' then raise exception 'Enter the four-digit pickup PIN'; end if;
 select encode(digest(p_pin,'sha256'),'hex')=pin_hash into v_ok
 from public.ride_pickup_pins p join public.rides r on r.id=p.ride_id
 where p.ride_id=p_ride_id and r.driver_id=auth.uid() and r.status='accepted' and r.driver_arrived_at is not null
 for update of p;
 if v_ok is distinct from true then raise exception 'Pickup PIN is incorrect or this ride is not ready'; end if;
 update public.ride_pickup_pins set verified_at=coalesce(verified_at,clock_timestamp()) where ride_id=p_ride_id;
 return true;
end; $$;

create or replace function public.start_ride_trip(p_ride_id uuid)
returns table(ride_status text,final_waiting_fee numeric,billable_waiting_minutes integer)
language plpgsql security definer set search_path=public as $$
declare v_ride public.rides%rowtype; v_free integer; v_rate numeric; v_elapsed integer; v_billable integer; v_fee numeric;
begin
 select * into v_ride from public.rides where id=p_ride_id and driver_id=auth.uid() and status='accepted' for update;
 if not found then raise exception 'Ride not found or not assigned to this driver'; end if;
 if v_ride.driver_arrived_at is null then raise exception 'Mark your arrival before starting the trip'; end if;
 if not exists(select 1 from public.ride_pickup_pins where ride_id=p_ride_id and verified_at is not null) then
   raise exception 'Verify the rider pickup PIN before starting';
 end if;
 select waiting_free_minutes,waiting_fee_per_minute into v_free,v_rate from public.platform_settings where id=true;
 v_elapsed:=greatest(0,floor(extract(epoch from(clock_timestamp()-v_ride.driver_arrived_at)))::integer);
 v_billable:=case when v_elapsed<=v_free*60 then 0 else ceil((v_elapsed-v_free*60)::numeric/60)::integer end;
 v_fee:=round(v_billable*v_rate,2);
 perform set_config('lotty.internal_ride_update','on',true);
 update public.rides set status='in_progress',trip_started_at=clock_timestamp(),waiting_fee_amount=v_fee,
 waiting_fee_minutes=v_billable,fare=fare+v_fee where id=p_ride_id;
 return query select 'in_progress'::text,v_fee,v_billable;
end; $$;
revoke all on function public.verify_ride_pickup_pin(uuid,text) from public;
grant execute on function public.verify_ride_pickup_pin(uuid,text) to authenticated;
revoke all on function public.create_ride_pickup_pin() from public;
commit;
