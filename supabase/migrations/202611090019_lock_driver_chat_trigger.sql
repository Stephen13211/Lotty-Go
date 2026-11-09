-- Keep the trigger-only helper out of the public RPC surface and apply a basic chat rate limit.
begin;

create or replace function public.set_driver_chat_sender_name()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_recent_count integer;
begin
  select count(*) into v_recent_count
  from public.driver_chat_messages
  where sender_id = auth.uid()
    and created_at > clock_timestamp() - interval '1 minute';

  if v_recent_count >= 12 then
    raise exception 'Please slow down. You can send up to 12 messages per minute.';
  end if;

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

revoke all on function public.set_driver_chat_sender_name() from public, anon, authenticated;

commit;