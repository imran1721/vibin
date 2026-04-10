-- Host may remove a single guest from the room (membership row).

create or replace function public.host_kick_guest(
  p_room_id uuid,
  p_guest_user_id uuid,
  p_host_token text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
  removed int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_guest_user_id is null or p_guest_user_id = auth.uid() then
    raise exception 'Not allowed';
  end if;

  ok := exists (
    select 1 from public.rooms r
    where r.id = p_room_id and r.host_token = p_host_token
  ) or exists (
    select 1 from public.room_members m
    where m.room_id = p_room_id and m.user_id = auth.uid() and m.role = 'host'
  );

  if not ok then
    raise exception 'Not allowed';
  end if;

  delete from public.room_members
  where room_id = p_room_id
    and user_id = p_guest_user_id
    and role = 'guest';

  get diagnostics removed = row_count;
  if removed = 0 then
    raise exception 'Guest not found';
  end if;
end;
$$;

grant execute on function public.host_kick_guest(uuid, uuid, text) to authenticated;
