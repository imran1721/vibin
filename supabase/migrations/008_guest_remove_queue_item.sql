-- Guests may remove individual queue items (same room membership check, any role).

create or replace function public.remove_queue_item(p_item_id uuid, p_host_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r_id uuid;
  ok boolean;
  replacement uuid;
begin
  select room_id into r_id from public.queue_items where id = p_item_id;
  if r_id is null then
    return;
  end if;

  ok := exists (
    select 1 from public.rooms r
    where r.id = r_id and r.host_token = p_host_token
  ) or exists (
    select 1 from public.room_members m
    where m.room_id = r_id and m.user_id = auth.uid()
  );

  if not ok then
    raise exception 'Not allowed';
  end if;

  if exists (
    select 1 from public.rooms r
    where r.id = r_id and r.playback_current_item_id = p_item_id
  ) then
    with ord as (
      select
        id,
        lead(id) over (order by created_at asc, id asc) as nid,
        lag(id) over (order by created_at asc, id asc) as pid
      from public.queue_items
      where room_id = r_id
    )
    select coalesce(
      (select nid from ord where id = p_item_id),
      (select pid from ord where id = p_item_id)
    ) into replacement;

    update public.rooms
    set playback_current_item_id = replacement
    where id = r_id;
  end if;

  delete from public.queue_items where id = p_item_id;
end;
$$;
