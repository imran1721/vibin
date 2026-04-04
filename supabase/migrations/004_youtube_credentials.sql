-- Stores Google OAuth refresh tokens for YouTube Data API (playlists). Server-only via service role.

create table if not exists public.youtube_credentials (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);

alter table public.youtube_credentials enable row level security;

-- Intentionally no policies: only the Supabase service role (Next.js server) reads/writes.
