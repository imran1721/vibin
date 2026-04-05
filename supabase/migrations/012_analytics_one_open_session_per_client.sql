-- At most one “open” analytics row per browser client id (ended_at is null).

create unique index if not exists analytics_sessions_one_open_per_client_idx
  on public.analytics_sessions (client_session_id)
  where ended_at is null;
