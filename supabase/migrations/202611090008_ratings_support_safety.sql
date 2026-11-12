-- Ratings, support/reporting, and rider/driver emergency contacts.
begin;

create table if not exists public.ride_ratings (
  id uuid primary key default gen_random_uuid(),
  ride_id uuid not null references public.rides(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewee_id uuid not null references auth.users(id) on delete cascade,
  score integer not null check (score between 1 and 5),
  comment text check (comment is null or char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  constraint ride_ratings_one_per_reviewer unique (ride_id, reviewer_id),
  constraint ride_ratings_not_self check (reviewer_id <> reviewee_id)
);
create index if not exists ride_ratings_reviewee_created_idx on public.ride_ratings(reviewee_id, created_at desc);
alter table public.ride_ratings enable row level security;
drop policy if exists ride_ratings_read_own on public.ride_ratings;
create policy ride_ratings_read_own on public.ride_ratings
 for select to authenticated using (reviewer_id = (select auth.uid()) or reviewee_id = (select auth.uid()) or (auth.jwt()->'app_metadata'->>'role')='admin');
revoke all on public.ride_ratings from anon, authenticated;
grant select on public.ride_ratings to authenticated;

create or replace function public.submit_ride_rating(p_ride_id uuid,p_score integer,p_comment text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_ride public.rides%rowtype; v_reviewee uuid; v_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_score is null or p_score < 1 or p_score > 5 then raise exception 'Choose a rating from 1 to 5'; end if;
 if p_comment is not null and char_length(trim(p_comment)) > 500 then raise exception 'Comment must be 500 characters or fewer'; end if;
 select * into v_ride from public.rides where id=p_ride_id and status='completed';
 if not found then raise exception 'Only completed trips can be rated'; end if;
 if auth.uid()=v_ride.rider_id then v_reviewee:=v_ride.driver_id;
 elsif auth.uid()=v_ride.driver_id then v_reviewee:=v_ride.rider_id;
 else raise exception 'You are not a participant in this trip'; end if;
 if v_reviewee is null then raise exception 'The other trip participant is unavailable'; end if;
 insert into public.ride_ratings(ride_id,reviewer_id,reviewee_id,score,comment)
 values(p_ride_id,auth.uid(),v_reviewee,p_score,nullif(trim(p_comment),''))
 returning id into v_id;
 return v_id;
exception when unique_violation then
 raise exception 'You have already rated this trip';
end;
$$;
revoke all on function public.submit_ride_rating(uuid,integer,text) from public,anon;
grant execute on function public.submit_ride_rating(uuid,integer,text) to authenticated;

create table if not exists public.ride_support_reports (
 id uuid primary key default gen_random_uuid(),
 ride_id uuid references public.rides(id) on delete set null,
 reporter_id uuid not null references auth.users(id) on delete cascade,
 category text not null check (category in ('trip_issue','driver_conduct','rider_conduct','fare_or_fee','lost_item','safety','emergency','other')),
 details text not null check (char_length(trim(details)) between 5 and 3000),
 priority text not null default 'normal' check (priority in ('normal','high','urgent')),
 status text not null default 'open' check (status in ('open','in_review','resolved','closed')),
 admin_notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 resolved_at timestamptz
);
create index if not exists ride_support_reports_status_created_idx on public.ride_support_reports(status,created_at desc);
create index if not exists ride_support_reports_reporter_created_idx on public.ride_support_reports(reporter_id,created_at desc);
alter table public.ride_support_reports enable row level security;
drop policy if exists ride_support_reports_read_own_or_admin on public.ride_support_reports;
create policy ride_support_reports_read_own_or_admin on public.ride_support_reports
 for select to authenticated using (reporter_id=(select auth.uid()) or (auth.jwt()->'app_metadata'->>'role')='admin');
drop policy if exists ride_support_reports_admin_update on public.ride_support_reports;
create policy ride_support_reports_admin_update on public.ride_support_reports
 for update to authenticated using ((auth.jwt()->'app_metadata'->>'role')='admin')
 with check ((auth.jwt()->'app_metadata'->>'role')='admin');
revoke all on public.ride_support_reports from anon,authenticated;
grant select,update on public.ride_support_reports to authenticated;

create or replace function public.submit_ride_support_report(p_ride_id uuid,p_category text,p_details text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if p_category not in ('trip_issue','driver_conduct','rider_conduct','fare_or_fee','lost_item','safety','other') then raise exception 'Choose a valid support category'; end if;
 if p_details is null or char_length(trim(p_details)) not between 5 and 3000 then raise exception 'Describe the issue in 5 to 3000 characters'; end if;
 if p_ride_id is not null and not exists(select 1 from public.rides where id=p_ride_id and (rider_id=auth.uid() or driver_id=auth.uid())) then
   raise exception 'You are not a participant in this trip';
 end if;
 insert into public.ride_support_reports(ride_id,reporter_id,category,details)
 values(p_ride_id,auth.uid(),p_category,trim(p_details)) returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.submit_ride_support_report(uuid,text,text) from public,anon;
grant execute on function public.submit_ride_support_report(uuid,text,text) to authenticated;

create or replace function public.submit_ride_emergency_alert(p_ride_id uuid,p_details text default 'Emergency assistance requested from the active trip')
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required'; end if;
 if not exists(select 1 from public.rides where id=p_ride_id and status in ('accepted','in_progress') and (rider_id=auth.uid() or driver_id=auth.uid())) then
   raise exception 'This is not your active trip';
 end if;
 insert into public.ride_support_reports(ride_id,reporter_id,category,details,priority)
 values(p_ride_id,auth.uid(),'emergency',left(coalesce(nullif(trim(p_details),''),'Emergency assistance requested from the active trip'),3000),'urgent')
 returning id into v_id;
 return v_id;
end;
$$;
revoke all on function public.submit_ride_emergency_alert(uuid,text) from public,anon;
grant execute on function public.submit_ride_emergency_alert(uuid,text) to authenticated;

create table if not exists public.user_emergency_contacts (
 user_id uuid primary key references auth.users(id) on delete cascade,
 contact_name text not null check (char_length(trim(contact_name)) between 2 and 100),
 contact_phone text not null check (char_length(trim(contact_phone)) between 7 and 30),
 relationship text,
 updated_at timestamptz not null default now()
);
alter table public.user_emergency_contacts enable row level security;
drop policy if exists user_emergency_contacts_own on public.user_emergency_contacts;
create policy user_emergency_contacts_own on public.user_emergency_contacts
 for all to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
revoke all on public.user_emergency_contacts from anon,authenticated;
grant select,insert,update,delete on public.user_emergency_contacts to authenticated;

commit;