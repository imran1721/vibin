-- App visit analytics (filled via server API + service role only).

create table public.analytics_sessions (
  id uuid primary key default gen_random_uuid(),
  client_session_id text not null,
  user_id uuid references auth.users (id) on delete set null,
  ip text,
  user_agent text,
  timezone text,
  screen_width int,
  screen_height int,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_seconds int
);

create index analytics_sessions_started_at_idx
  on public.analytics_sessions (started_at desc);

create index analytics_sessions_client_session_id_idx
  on public.analytics_sessions (client_session_id);

comment on table public.analytics_sessions is
  'Client session metrics: IP/UA from server; timezone/screen from client; duration on session end.';

alter table public.analytics_sessions enable row level security;

-- No policies: anon/authenticated cannot read/write; service role bypasses RLS for API inserts/updates.
