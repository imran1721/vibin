-- Shared playback controls: pause/play/stop (synced on rooms row), previous (playback_history).
-- Run after 001 and 002.

alter table public.rooms
  add column if not exists playback_paused boolean not null default false;

alter table public.rooms
  add column if not exists playback_stop_seq integer not null default 0;

create table if not exists public.playback_history (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  video_id text not null,
  title text not null,
  thumb_url text,
  created_at timestamptz not null default now()
);

create index if not exists playback_history_room_created_idx
  on public.playback_history (room_id, created_at desc);

alter table public.playback_history enable row level security;

create policy "playback_history_select_member"
  on public.playback_history for select to authenticated
  using (
    exists (
      select 1 from public.room_members m
      where m.room_id = playback_history.room_id and m.user_id = auth.uid()
    )
  );

-- Advance: push current head into history, then remove it
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
    insert into public.playback_history (room_id, video_id, title, thumb_url)
    select q.room_id, q.video_id, q.title, q.thumb_url
    from public.queue_items q
    where q.id = first_id;

    delete from public.queue_items where id = first_id;
  end if;
end;
$$;

-- Previous: restore last history row to front of queue
create or replace function public.playback_previous(p_room_id uuid, p_host_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
  h_id uuid;
  v_video text;
  v_title text;
  v_thumb text;
  min_c timestamptz;
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

  select ph.id, ph.video_id, ph.title, ph.thumb_url
  into h_id, v_video, v_title, v_thumb
  from public.playback_history ph
  where ph.room_id = p_room_id
  order by ph.created_at desc
  limit 1;

  if h_id is null then
    return;
  end if;

  delete from public.playback_history where id = h_id;

  select min(q.created_at) into min_c
  from public.queue_items q
  where q.room_id = p_room_id;

  insert into public.queue_items (room_id, video_id, title, thumb_url, created_at)
  values (
    p_room_id,
    v_video,
    v_title,
    v_thumb,
    coalesce(min_c, now()) - interval '1 millisecond'
  );
end;
$$;

grant execute on function public.playback_previous(uuid, text) to authenticated;

create or replace function public.playback_set_paused(p_room_id uuid, p_paused boolean)
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
  set playback_paused = p_paused
  where id = p_room_id;
end;
$$;

grant execute on function public.playback_set_paused(uuid, boolean) to authenticated;

create or replace function public.playback_request_stop(p_room_id uuid)
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
    playback_stop_seq = playback_stop_seq + 1,
    playback_paused = true
  where id = p_room_id;
end;
$$;

grant execute on function public.playback_request_stop(uuid) to authenticated;
