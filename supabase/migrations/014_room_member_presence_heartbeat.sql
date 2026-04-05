-- Guest activity: last_seen_at + heartbeat RPC. Host can remove guests with no recent heartbeat.

alter table public.room_members
  add column if not exists last_seen_at timestamptz;

update public.room_members set last_seen_at = joined_at where last_seen_at is null;

alter table public.room_members
  alter column last_seen_at set not null,
  alter column last_seen_at set default now();

create index if not exists room_members_room_guest_last_seen_idx
  on public.room_members (room_id, last_seen_at)
  where role = 'guest';

-- Caller refreshes presence while in the room (throttle on client, e.g. 30–60s).
create or replace function public.touch_room_presence(p_room_id uuid)
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
  set last_seen_at = now()
  where room_id = p_room_id and user_id = auth.uid();
end;
$$;

grant execute on function public.touch_room_presence(uuid) to authenticated;

-- Host (or valid host token): delete guests whose last_seen_at is older than p_inactive_minutes.
create or replace function public.prune_stale_room_guests(
  p_room_id uuid,
  p_host_token text,
  p_inactive_minutes int default 3
)
returns int
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

  if p_inactive_minutes < 1 or p_inactive_minutes > 10080 then
    raise exception 'Invalid inactive window';
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
    and role = 'guest'
    and last_seen_at < now() - make_interval(mins => p_inactive_minutes);

  get diagnostics removed = row_count;
  return removed;
end;
$$;

grant execute on function public.prune_stale_room_guests(uuid, text, int) to authenticated;

-- Re-join bumps last_seen for returning members.
create or replace function public.join_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (select 1 from public.rooms where id = p_room_id) then
    raise exception 'Room not found';
  end if;

  insert into public.room_members (room_id, user_id, role, last_seen_at)
  values (p_room_id, auth.uid(), 'guest', now())
  on conflict (room_id, user_id) do update
    set last_seen_at = now();
end;
$$;

create or replace function public.join_with_host_token(p_room_id uuid, p_host_token text)
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
    select 1 from public.rooms r
    where r.id = p_room_id and r.host_token = p_host_token
  ) then
    raise exception 'Invalid host link';
  end if;

  insert into public.room_members (room_id, user_id, role, last_seen_at)
  values (p_room_id, auth.uid(), 'host', now())
  on conflict (room_id, user_id) do update
    set role = 'host', last_seen_at = now();
end;
$$;
