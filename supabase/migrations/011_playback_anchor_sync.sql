-- Shared playback position: anchor + wall clock while playing; everyone stays in sync.

alter table public.rooms
  add column if not exists playback_anchor_sec double precision not null default 0;

alter table public.rooms
  add column if not exists playback_anchor_at timestamptz not null default now();

drop function if exists public.playback_set_paused(uuid, boolean);

-- Optional anchor snapshot on pause/play (pass current YouTube time).
create or replace function public.playback_set_paused(
  p_room_id uuid,
  p_paused boolean,
  p_anchor_sec double precision default null
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
    where m.room_id = p_room_id and m.user_id = auth.uid()
  ) then
    raise exception 'Not allowed';
  end if;

  update public.rooms
  set
    playback_paused = p_paused,
    playback_anchor_sec = coalesce(p_anchor_sec, playback_anchor_sec),
    playback_anchor_at = case
      when p_anchor_sec is null then playback_anchor_at
      else now()
    end
  where id = p_room_id;
end;
$$;

grant execute on function public.playback_set_paused(uuid, boolean, double precision) to authenticated;

-- Jump to a position in the current video (any room member).
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
declare
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

  update public.rooms
  set
    playback_anchor_sec = greatest(0::double precision, p_seconds),
    playback_anchor_at = now()
  where id = p_room_id;
end;
$$;

grant execute on function public.playback_seek(uuid, double precision, text) to authenticated;

-- Host-only: publish current player time so guests stay aligned with real playback.
create or replace function public.playback_host_beat(
  p_room_id uuid,
  p_seconds double precision
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
  where id = p_room_id
    and playback_paused = false;
end;
$$;

grant execute on function public.playback_host_beat(uuid, double precision) to authenticated;

create or replace function public.queue_items_set_default_pointer()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rooms r
  set
    playback_current_item_id = new.id,
    playback_paused = false,
    playback_anchor_sec = 0,
    playback_anchor_at = now()
  where r.id = new.room_id
    and r.playback_current_item_id is null;
  return new;
end;
$$;

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
    set
      playback_current_item_id = next_id,
      playback_anchor_sec = 0,
      playback_anchor_at = now()
    where id = p_room_id;
  end if;
end;
$$;

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
    set
      playback_current_item_id = prev_id,
      playback_anchor_sec = 0,
      playback_anchor_at = now()
    where id = p_room_id;
  end if;
end;
$$;

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
    playback_paused = false,
    playback_anchor_sec = 0,
    playback_anchor_at = now()
  where id = r_id;
end;
$$;

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
    set
      playback_current_item_id = replacement,
      playback_anchor_sec = 0,
      playback_anchor_at = now()
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
  set
    playback_current_item_id = null,
    playback_anchor_sec = 0,
    playback_anchor_at = now()
  where id = p_room_id;

  delete from public.queue_items where room_id = p_room_id;
end;
$$;
