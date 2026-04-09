-- Track personalization / RAG indexing status per authenticated user.

create table if not exists public.taste_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'not_started',
  indexed_at timestamptz null,
  error text null,
  updated_at timestamptz not null default now()
);

-- Keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists taste_profiles_touch_updated_at on public.taste_profiles;
create trigger taste_profiles_touch_updated_at
before update on public.taste_profiles
for each row
execute function public.touch_updated_at();

alter table public.taste_profiles enable row level security;

-- Users can read their own status.
drop policy if exists "taste_profiles_select_own" on public.taste_profiles;
create policy "taste_profiles_select_own"
on public.taste_profiles
for select
using (auth.uid() = user_id);

-- Users can upsert their own row (server will do it on their behalf too).
drop policy if exists "taste_profiles_upsert_own" on public.taste_profiles;
create policy "taste_profiles_upsert_own"
on public.taste_profiles
for insert
with check (auth.uid() = user_id);

drop policy if exists "taste_profiles_update_own" on public.taste_profiles;
create policy "taste_profiles_update_own"
on public.taste_profiles
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

