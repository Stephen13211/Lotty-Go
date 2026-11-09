-- Pin the search path on the payment split trigger function.
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
commit;