-- Restrict exposed RPCs to signed-in users. Every callable SECURITY DEFINER
-- function still performs its own auth.uid()/admin checks internally.
begin;

revoke execute on all functions in schema public from public, anon;

grant execute on function public.admin_set_waiting_fee(integer,numeric) to authenticated;
grant execute on function public.cancel_ride_request(uuid,text) to authenticated;
grant execute on function public.claim_ride_request(uuid) to authenticated;
grant execute on function public.complete_ride_trip(uuid) to authenticated;
grant execute on function public.create_trip_share_link(uuid) to authenticated;
grant execute on function public.driver_arrive_at_pickup(uuid) to authenticated;
grant execute on function public.get_matched_driver_profile(uuid) to authenticated;
grant execute on function public.get_ride_waiting_quote(uuid) to authenticated;
grant execute on function public.revoke_trip_share_links(uuid) to authenticated;
grant execute on function public.set_driver_availability(boolean,double precision,double precision) to authenticated;
grant execute on function public.set_driver_profile_photo(text) to authenticated;
grant execute on function public.set_driver_women_preference(boolean) to authenticated;
grant execute on function public.start_ride_trip(uuid) to authenticated;
grant execute on function public.update_active_ride_location(uuid,double precision,double precision) to authenticated;
grant execute on function public.verify_ride_pickup_pin(uuid,text) to authenticated;

-- Trigger-only functions must not be callable as API RPCs.
revoke execute on function public.create_ride_pickup_pin() from public, anon, authenticated;
revoke execute on function public.guard_driver_profile_privileged_fields() from public, anon, authenticated;
revoke execute on function public.guard_ride_acceptance_changes() from public, anon, authenticated;
revoke execute on function public.lotty_guard_ride_lifecycle() from public, anon, authenticated;
revoke execute on function public.set_lotty_payment_split() from public, anon, authenticated;

-- Pin down the trigger function search_path flagged by the Supabase advisor.
create or replace function public.set_lotty_payment_split()
returns trigger language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.driver_share := round(new.total_fare * 0.75, 2);
  new.lotty_share := new.total_fare - new.driver_share;
  return new;
end;
$$;
revoke execute on function public.set_lotty_payment_split() from public, anon, authenticated;

commit;