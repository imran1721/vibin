-- Public rooms: opt-in flag + RPCs for the /explore page (anon-callable list)
-- and host-only mutations (rename, flip visibility). A room must have a title
-- before it can be flipped to public so /explore stays scannable.

alter table public.rooms
  add column if not exists is_public boolean not null default false;

comment on column public.rooms.is_public is
  'When true, room appears on /explore via list_public_rooms() and is readable by anon callers via that RPC.';

create index if not exists rooms_is_public_idx
  on public.rooms (is_public)
  where is_public;

-- Host-only: rename room. Empty/whitespace clears the title back to null.
create or replace function public.set_room_title(
  p_room_id uuid,
  p_host_token text,
  p_title text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
  trimmed text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
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

  trimmed := nullif(trim(coalesce(p_title, '')), '');
  if trimmed is not null and length(trimmed) > 80 then
    raise exception 'Title too long';
  end if;

  -- Going-private side effect: keep current title; host can clear separately.
  if trimmed is null and exists (
    select 1 from public.rooms r where r.id = p_room_id and r.is_public = true
  ) then
    raise exception 'Cannot clear title while room is public';
  end if;

  update public.rooms
  set title = trimmed
  where id = p_room_id;
end;
$$;

grant execute on function public.set_room_title(uuid, text, text) to authenticated;

-- Host-only: flip a room between public and private. Going public requires
-- a non-empty title; going private has no preconditions.
create or replace function public.set_room_visibility(
  p_room_id uuid,
  p_host_token text,
  p_is_public boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
  current_title text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
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

  if p_is_public then
    select title into current_title from public.rooms where id = p_room_id;
    if current_title is null or length(trim(current_title)) = 0 then
      raise exception 'Room needs a title before it can be made public';
    end if;
  end if;

  update public.rooms
  set is_public = p_is_public
  where id = p_room_id;
end;
$$;

grant execute on function public.set_room_visibility(uuid, text, boolean) to authenticated;

-- Anon-callable: rooms with at least one active watcher (heartbeat in last 2 min)
-- and is_public = true. SECURITY DEFINER lets it bypass the member-only RLS.
create or replace function public.list_public_rooms()
returns table (
  room_id uuid,
  title text,
  watcher_count int,
  now_playing_video_id text,
  now_playing_title text,
  now_playing_thumb_url text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  with active as (
    select
      m.room_id,
      count(*)::int as cnt
    from public.room_members m
    where m.last_seen_at > now() - interval '2 minutes'
    group by m.room_id
  )
  select
    r.id,
    r.title,
    a.cnt,
    q.video_id,
    q.title,
    q.thumb_url,
    r.created_at
  from public.rooms r
  join active a on a.room_id = r.id
  left join public.queue_items q on q.id = r.playback_current_item_id
  where r.is_public = true
    and a.cnt > 0
  order by a.cnt desc, r.created_at desc
  limit 100;
$$;

grant execute on function public.list_public_rooms() to anon, authenticated;
