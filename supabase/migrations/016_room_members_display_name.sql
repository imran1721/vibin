-- Optional label shown in guest list (synced from client heartbeats).

alter table public.room_members
  add column if not exists display_name text;

comment on column public.room_members.display_name is
  'Shown in room guest list; empty means anonymous. Updated by touch_room_presence.';

-- Replace single-arg touch with version that syncs display name (empty string = clear).
drop function if exists public.touch_room_presence(uuid);

create or replace function public.touch_room_presence(
  p_room_id uuid,
  p_display_name text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.room_members
  set
    last_seen_at = now(),
    display_name = nullif(trim(p_display_name), '')
  where room_id = p_room_id and user_id = auth.uid();
end;
$$;

grant execute on function public.touch_room_presence(uuid, text) to authenticated;
