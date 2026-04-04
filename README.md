# Vibin


Web app for a Spotify Jam–style YouTube listening party (Vibin): one host plays audio; everyone with the link can search YouTube, add tracks, and **skip to the next song** (updates the queue for everyone; the host’s tab loads the next video via realtime). Realtime updates use Supabase.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **Auth → Providers → Anonymous sign-ins**: enable.
3. **SQL Editor**: run [`001_initial.sql`](supabase/migrations/001_initial.sql), [`002_guest_advance_queue.sql`](supabase/migrations/002_guest_advance_queue.sql) if needed, [`003_playback_controls.sql`](supabase/migrations/003_playback_controls.sql), then [`004_youtube_credentials.sql`](supabase/migrations/004_youtube_credentials.sql) for **host YouTube playlists** (OAuth token storage; server-only).
4. **Project Settings → API**: copy the project URL, **anon** key, and **service_role** key (server-only — never expose to the client; needed for playlist OAuth).

### 2. YouTube Data API v3 + Google OAuth (playlists)

1. In [Google Cloud Console](https://console.cloud.google.com/), enable **YouTube Data API v3**.
2. Create an **API key** for search (restrict to YouTube Data API v3 in production).
3. **OAuth consent screen**: add scope `.../auth/youtube.readonly`.
4. **Credentials → Create OAuth client ID → Web application**:
   - **Authorized redirect URIs**: e.g. `http://localhost:3000/api/youtube/oauth/callback` and your production URL with the same path.
5. Generate a random **state secret** (e.g. `openssl rand -hex 32`) for `YOUTUBE_OAUTH_STATE_SECRET`.

### 3. Environment

Copy [`.env.example`](.env.example) to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (playlists + OAuth callback token storage)
- `YOUTUBE_API_KEY`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `YOUTUBE_OAUTH_REDIRECT_URI` (must match Google Cloud **exactly**)
- `YOUTUBE_OAUTH_STATE_SECRET`

**Host playlists:** in a jam room, open **Connect Google (YouTube)**, pick a playlist, then **Add all to queue** or **Replace queue**.

### 4. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Start a jam, share the guest link (without `?h=`), and open it on another device or browser.

## Deploy (e.g. Vercel)

1. Push the repo to GitHub and import it in [Vercel](https://vercel.com).
2. Add environment variables in Vercel (include **server-only** `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_SECRET`, `YOUTUBE_OAUTH_STATE_SECRET`, and production `YOUTUBE_OAUTH_REDIRECT_URI`).
3. Deploy. Supabase Realtime works over WSS from production as long as your Supabase URL/key are correct.

## iOS / PWA

- Uses `viewport-fit=cover` and safe-area padding for notched devices.
- [`public/manifest.json`](public/manifest.json) supports **Add to Home Screen**; optional icons can be added later.

## Stack

Next.js (App Router), Tailwind CSS, Supabase (Postgres + RLS + Realtime + anonymous auth), YouTube IFrame API (host playback), YouTube Data API v3 (server-side search).
