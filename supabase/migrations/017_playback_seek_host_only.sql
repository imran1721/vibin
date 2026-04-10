-- Only the host may update shared seek position; guests realign locally from host beats.

create or replace function public.playback_seek(
  p_room_id uuid,
  p_seconds double precision,
  p_host_token text
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

  if not exists (
    select 1 from public.room_members m
    where m.room_id = p_room_id
      and m.user_id = auth.uid()
      and m.role = 'host'
  ) then
    raise exception 'Not allowed';
  end if;

  update public.rooms
  set
    playback_anchor_sec = greatest(0::double precision, p_seconds),
    playback_anchor_at = now()
  where id = p_room_id;
end;
$$;
