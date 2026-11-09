-- Keep the driver eligibility helper outside exposed API schemas and optimize chat policy lookups.
begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_approved_lotty_driver()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.driver_profiles dp
    where dp.user_id = (select auth.uid())
      and dp.application_status = 'approved'
  );
$$;

revoke all on function private.is_approved_lotty_driver() from public, anon;
grant execute on function private.is_approved_lotty_driver() to authenticated;
drop function if exists public.is_approved_lotty_driver();

drop policy if exists "Approved drivers can read driver chat" on public.driver_chat_messages;
create policy "Approved drivers can read driver chat"
  on public.driver_chat_messages for select to authenticated
  using ((select private.is_approved_lotty_driver()));

drop policy if exists "Approved drivers can send driver chat" on public.driver_chat_messages;
create policy "Approved drivers can send driver chat"
  on public.driver_chat_messages for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and (select private.is_approved_lotty_driver())
  );

create index if not exists driver_chat_messages_sender_created_idx
  on public.driver_chat_messages (sender_id, created_at desc);

commit;