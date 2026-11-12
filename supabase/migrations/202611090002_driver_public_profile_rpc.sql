-- Expose only the driver's public trip identity to the rider; never expose payout or review fields.
begin;
drop policy if exists driver_profiles_read_active_rider on public.driver_profiles;

create or replace function public.get_matched_driver_profile(p_ride_id uuid)
returns table(legal_name text,vehicle_make text,vehicle_model text,vehicle_year integer,vehicle_registration text,profile_photo_url text)
language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.rides r where r.id=p_ride_id and r.rider_id=auth.uid()
   and r.status in('accepted','in_progress') and r.driver_id is not null) then
   raise exception 'No active ride found for this rider';
 end if;
 return query select p.legal_name,p.vehicle_make,p.vehicle_model,p.vehicle_year,p.vehicle_registration,p.profile_photo_url
 from public.rides r join public.driver_profiles p on p.user_id=r.driver_id
 where r.id=p_ride_id;
end; $$;

create or replace function public.set_driver_profile_photo(p_photo_url text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_photo_url is null or length(p_photo_url)>2048 or p_photo_url not like 'https://%' then
   raise exception 'Invalid profile photo URL';
 end if;
 update public.driver_profiles set profile_photo_url=p_photo_url,updated_at=now()
 where user_id=auth.uid() and application_status in('pending','approved','rejected');
 if not found then raise exception 'Driver profile not found'; end if;
end; $$;

revoke all on function public.get_matched_driver_profile(uuid) from public;
revoke all on function public.set_driver_profile_photo(text) from public;
grant execute on function public.get_matched_driver_profile(uuid) to authenticated;
grant execute on function public.set_driver_profile_photo(text) to authenticated;
commit;
