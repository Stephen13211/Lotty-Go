-- Shared in-app chat for approved Lotty Go drivers.
begin;

create or replace function public.is_approved_lotty_driver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.driver_profiles dp
    where dp.user_id = auth.uid()
      and dp.application_status = 'approved'
  );
$$;

revoke all on function public.is_approved_lotty_driver() from public, anon;
grant execute on function public.is_approved_lotty_driver() to authenticated;

create table if not exists public.driver_chat_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  sender_name text not null default 'Driver',
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists driver_chat_messages_created_at_idx
  on public.driver_chat_messages (created_at desc);

alter table public.driver_chat_messages enable row level security;

drop policy if exists "Approved drivers can read driver chat" on public.driver_chat_messages;
create policy "Approved drivers can read driver chat"
  on public.driver_chat_messages for select to authenticated
  using (public.is_approved_lotty_driver());

drop policy if exists "Approved drivers can send driver chat" on public.driver_chat_messages;
create policy "Approved drivers can send driver chat"
  on public.driver_chat_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_approved_lotty_driver()
  );

grant select, insert on public.driver_chat_messages to authenticated;
revoke all on public.driver_chat_messages from anon;

create or replace function public.set_driver_chat_sender_name()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  select coalesce(
    nullif(btrim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(u.email, '@', 1), ''),
    'Driver'
  )
  into new.sender_name
  from auth.users u
  where u.id = auth.uid();

  if new.sender_name is null then
    new.sender_name := 'Driver';
  end if;

  return new;
end;
$$;

drop trigger if exists set_driver_chat_sender_name_before_insert on public.driver_chat_messages;
create trigger set_driver_chat_sender_name_before_insert
  before insert on public.driver_chat_messages
  for each row execute function public.set_driver_chat_sender_name();

commit;