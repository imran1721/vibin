-- Let any room member (host or guest) advance the queue to the next track.
-- Host token still works for callers who aren’t in room_members.

create or replace function public.advance_queue(p_room_id uuid, p_host_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  first_id uuid;
  ok boolean;
begin
  ok := exists (
    select 1 from public.rooms r
    where r.id = p_room_id and r.host_token = p_host_token
  ) or exists (
    select 1 from public.room_members m
    where m.room_id = p_room_id and m.user_id = auth.uid()
  );

  if not ok then
    raise exception 'Not allowed';
  end if;

  select q.id into first_id
  from public.queue_items q
  where q.room_id = p_room_id
  order by q.created_at asc
  limit 1;

  if first_id is not null then
    delete from public.queue_items where id = first_id;
  end if;
end;
$$;
