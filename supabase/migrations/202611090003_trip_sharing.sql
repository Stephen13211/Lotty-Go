-- Secure, expiring bearer links for sharing an active trip outside Lotty Go.
begin;
create table if not exists public.trip_share_links (
  token text primary key,
  ride_id uuid not null references public.rides(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index if not exists trip_share_links_ride_id_idx on public.trip_share_links(ride_id);
alter table public.trip_share_links enable row level security;
revoke all on public.trip_share_links from anon, authenticated;
grant all on public.trip_share_links to service_role;

create or replace function public.create_trip_share_link(p_ride_id uuid)
returns text language plpgsql security definer set search_path=public as $$
declare v_token text;
begin
  if auth.uid() is null or not exists (
    select 1 from public.rides r where r.id=p_ride_id
      and auth.uid() in (r.rider_id,r.driver_id)
      and r.status in ('accepted','in_progress')
  ) then raise exception 'Only trip participants can share an active trip'; end if;
  v_token := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
  insert into public.trip_share_links(token,ride_id,created_by,expires_at)
  values(v_token,p_ride_id,auth.uid(),now()+interval '12 hours');
  return v_token;
end; $$;
revoke all on function public.create_trip_share_link(uuid) from public;
grant execute on function public.create_trip_share_link(uuid) to authenticated;
create or replace function public.revoke_trip_share_links(p_ride_id uuid)
returns void language plpgsql security definer set search_path=public as $revoke$
begin
  if auth.uid() is null or not exists (
    select 1 from public.rides r
    where r.id=p_ride_id and auth.uid() in (r.rider_id,r.driver_id)
  ) then raise exception 'Only trip participants can revoke trip links'; end if;
  update public.trip_share_links set revoked_at=now()
  where ride_id=p_ride_id and revoked_at is null;
end; $revoke$;
revoke all on function public.revoke_trip_share_links(uuid) from public;
grant execute on function public.revoke_trip_share_links(uuid) to authenticated;
commit;
