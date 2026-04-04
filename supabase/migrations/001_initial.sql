-- Jam: rooms, members, queue. Requires Supabase Auth: enable Anonymous sign-ins (Dashboard → Auth → Providers).

-- Rooms ---------------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  title text,
  host_token text not null unique default (gen_random_uuid()::text)
);

create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('host', 'guest')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index room_members_user_id_idx on public.room_members (user_id);

create table public.queue_items (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  video_id text not null,
  title text not null,
  thumb_url text,
  added_by text,
  created_at timestamptz not null default now()
);

create index queue_items_room_created_idx on public.queue_items (room_id, created_at);

-- RPC: create room (caller must be authenticated, including anonymous)
create or replace function public.create_room(p_title text default null)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  r_id uuid;
  h_token text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.rooms (title)
  values (p_title)
  returning id, host_token into r_id, h_token;

  insert into public.room_members (room_id, user_id, role)
  values (r_id, auth.uid(), 'host');

  return json_build_object('id', r_id, 'host_token', h_token);
end;
$$;

grant execute on function public.create_room(text) to authenticated;

-- RPC: join as guest
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

  insert into public.room_members (room_id, user_id, role)
  values (p_room_id, auth.uid(), 'guest')
  on conflict (room_id, user_id) do nothing;
end;
$$;

grant execute on function public.join_room(uuid) to authenticated;

-- RPC: join as host when opening saved host link (?h=token) on a new device
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

  insert into public.room_members (room_id, user_id, role)
  values (p_room_id, auth.uid(), 'host')
  on conflict (room_id, user_id) do update set role = 'host';
end;
$$;

grant execute on function public.join_with_host_token(uuid, text) to authenticated;

-- RPC: verify host token (for clients that lost auth session but have link)
create or replace function public.is_host(p_room_id uuid, p_host_token text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.rooms r
    where r.id = p_room_id and r.host_token = p_host_token
  );
$$;

grant execute on function public.is_host(uuid, text) to authenticated;

-- RPC: advance queue (remove first item) — any room member or valid host_token
-- (Guests may skip; see 002_guest_advance_queue.sql if you already applied v1.)
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

grant execute on function public.advance_queue(uuid, text) to authenticated;

-- RPC: remove specific queue item — host only
create or replace function public.remove_queue_item(p_item_id uuid, p_host_token text)
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
    where m.room_id = r_id and m.user_id = auth.uid() and m.role = 'host'
  );

  if not ok then
    raise exception 'Not allowed';
  end if;

  delete from public.queue_items where id = p_item_id;
end;
$$;

grant execute on function public.remove_queue_item(uuid, text) to authenticated;

-- RLS -----------------------------------------------------------------------
alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.queue_items enable row level security;

create policy "rooms_select_member"
  on public.rooms for select to authenticated
  using (
    exists (
      select 1 from public.room_members m
      where m.room_id = rooms.id and m.user_id = auth.uid()
    )
  );

create policy "room_members_select_self"
  on public.room_members for select to authenticated
  using (user_id = auth.uid());

create policy "queue_select_member"
  on public.queue_items for select to authenticated
  using (
    exists (
      select 1 from public.room_members m
      where m.room_id = queue_items.room_id and m.user_id = auth.uid()
    )
  );

create policy "queue_insert_member"
  on public.queue_items for insert to authenticated
  with check (
    exists (
      select 1 from public.room_members m
      where m.room_id = queue_items.room_id and m.user_id = auth.uid()
    )
  );

create policy "queue_delete_host"
  on public.queue_items for delete to authenticated
  using (
    exists (
      select 1 from public.room_members m
      where m.room_id = queue_items.room_id
        and m.user_id = auth.uid()
        and m.role = 'host'
    )
  );

-- Realtime ------------------------------------------------------------------
alter publication supabase_realtime add table public.queue_items;
alter publication supabase_realtime add table public.rooms;
