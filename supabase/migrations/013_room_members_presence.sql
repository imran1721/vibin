-- Let everyone in a room see member rows (count guests, realtime presence).
-- Replaces self-only select so clients can list peers in the same room.
-- SECURITY DEFINER helper avoids infinite recursion in RLS (same-table EXISTS).

create or replace function public.auth_user_is_member_of_room(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.room_members m
    where m.room_id = p_room_id and m.user_id = auth.uid()
  );
$$;

revoke all on function public.auth_user_is_member_of_room(uuid) from public;
grant execute on function public.auth_user_is_member_of_room(uuid) to authenticated;

drop policy if exists "room_members_select_self" on public.room_members;

create policy "room_members_select_fellow_room"
  on public.room_members for select to authenticated
  using (public.auth_user_is_member_of_room(room_id));

alter publication supabase_realtime add table public.room_members;
