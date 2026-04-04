-- Keep all queue_items; track "now playing" with rooms.playback_current_item_id.
-- Advance / previous move the pointer only (no deletes, no playback_history for skip).

alter table public.rooms
  add column if not exists playback_current_item_id uuid references public.queue_items (id) on delete set null;

create index if not exists rooms_playback_current_item_idx
  on public.rooms (playback_current_item_id)
  where playback_current_item_id is not null;

-- Backfill: point at earliest queue row per room when null
update public.rooms r
set playback_current_item_id = q.id
from (
  select distinct on (room_id) room_id, id
  from public.queue_items
  order by room_id, created_at asc, id asc
) q
where r.id = q.room_id
  and r.playback_current_item_id is null;

-- First insert in an empty queue (no pointer) becomes current
create or replace function public.queue_items_set_default_pointer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rooms r
  set playback_current_item_id = new.id
  where r.id = new.room_id
    and r.playback_current_item_id is null;
  return new;
end;
$$;

drop trigger if exists queue_items_set_default_pointer on public.queue_items;
create trigger queue_items_set_default_pointer
  after insert on public.queue_items
  for each row
  execute function public.queue_items_set_default_pointer();

-- Advance: move pointer to next row; at end of list, leave pointer (no next)
create or replace function public.advance_queue(p_room_id uuid, p_host_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
  cur_id uuid;
  next_id uuid;
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

  select r.playback_current_item_id into cur_id
  from public.rooms r
  where r.id = p_room_id;

  if cur_id is null or not exists (
    select 1 from public.queue_items q where q.id = cur_id and q.room_id = p_room_id
  ) then
    select q.id into cur_id
    from public.queue_items q
    where q.room_id = p_room_id
    order by q.created_at asc, q.id asc
    limit 1;
  end if;

  if cur_id is null then
    return;
  end if;

  with ord as (
    select
      id,
      lead(id) over (order by created_at asc, id asc) as nid
    from public.queue_items
    where room_id = p_room_id
  )
  select nid into next_id from ord where id = cur_id;

  if next_id is not null then
    update public.rooms
    set playback_current_item_id = next_id
    where id = p_room_id;
  end if;
end;
$$;

-- Previous: move pointer to prior row in queue order
create or replace function public.playback_previous(p_room_id uuid, p_host_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
  cur_id uuid;
  prev_id uuid;
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

  select r.playback_current_item_id into cur_id
  from public.rooms r
  where r.id = p_room_id;

  if cur_id is null or not exists (
    select 1 from public.queue_items q where q.id = cur_id and q.room_id = p_room_id
  ) then
    select q.id into cur_id
    from public.queue_items q
    where q.room_id = p_room_id
    order by q.created_at asc, q.id asc
    limit 1;
  end if;

  if cur_id is null then
    return;
  end if;

  with ord as (
    select
      id,
      lag(id) over (order by created_at asc, id asc) as pid
    from public.queue_items
    where room_id = p_room_id
  )
  select pid into prev_id from ord where id = cur_id;

  if prev_id is not null then
    update public.rooms
    set playback_current_item_id = prev_id
    where id = p_room_id;
  end if;
end;
$$;

-- Jump: set pointer only (no reorder)
create or replace function public.jump_to_queue_item(p_item_id uuid, p_host_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r_id uuid;
  ok boolean;
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

  update public.rooms
  set
    playback_current_item_id = p_item_id,
    playback_paused = false
  where id = r_id;
end;
$$;

-- Remove: if deleting current, move pointer to next row or previous
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
    where m.room_id = r_id and m.user_id = auth.uid() and m.role = 'host'
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

  update public.rooms
  set playback_current_item_id = null
  where id = p_room_id;

  delete from public.queue_items where room_id = p_room_id;
end;
$$;
