-- Restrict Lotty Women ride requests to authenticated female rider accounts.
-- The client greys out the option; this trigger is the authoritative database guard.
create or replace function public.guard_lotty_women_rider_gender()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_gender text;
begin
  if new.ride_type = 'lotty_xl' then
    if auth.uid() is null or new.rider_id <> auth.uid() then
      raise exception 'Sign in as the rider who is requesting this ride';
    end if;

    select lower(coalesce(raw_user_meta_data ->> 'gender', ''))
      into v_gender
      from auth.users
     where id = auth.uid();

    if v_gender <> 'female' then
      raise exception 'Lotty Women is only available to female riders';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists rides_guard_lotty_women_rider_gender on public.rides;
create trigger rides_guard_lotty_women_rider_gender
before insert on public.rides
for each row execute function public.guard_lotty_women_rider_gender();

revoke all on function public.guard_lotty_women_rider_gender() from public, anon, authenticated;
