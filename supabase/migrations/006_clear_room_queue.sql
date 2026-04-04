-- Host-only: delete all queue items for a room (same auth as remove_queue_item).

create or replace function public.clear_room_queue(p_room_id uuid, p_host_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
begin
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

  delete from public.queue_items where room_id = p_room_id;
end;
$$;

grant execute on function public.clear_room_queue(uuid, text) to authenticated;
