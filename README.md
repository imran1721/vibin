# Jam

Web app for a Spotify Jam–style YouTube listening party: one host plays audio; everyone with the link can search YouTube and add tracks to a shared queue. Realtime updates use Supabase.

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **Auth → Providers → Anonymous sign-ins**: enable.
3. **SQL Editor**: run the migration in [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql).
4. **Project Settings → API**: copy the project URL and anon public key.

### 2. YouTube Data API v3

1. In [Google Cloud Console](https://console.cloud.google.com/), enable **YouTube Data API v3**.
2. Create an API key (restrict it to YouTube Data API for production).

### 3. Environment

Copy `.env.example` to `.env.local` and fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `YOUTUBE_API_KEY`

### 4. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Start a jam, share the guest link (without `?h=`), and open it on another device or browser.

## Deploy (e.g. Vercel)

1. Push the repo to GitHub and import it in [Vercel](https://vercel.com).
2. Add the same environment variables in the Vercel project settings (including `YOUTUBE_API_KEY` as a server-only secret).
3. Deploy. Supabase Realtime works over WSS from production as long as your Supabase URL/key are correct.

## iOS / PWA

- Uses `viewport-fit=cover` and safe-area padding for notched devices.
- [`public/manifest.json`](public/manifest.json) supports **Add to Home Screen**; optional icons can be added later.

## Stack

Next.js (App Router), Tailwind CSS, Supabase (Postgres + RLS + Realtime + anonymous auth), YouTube IFrame API (host playback), YouTube Data API v3 (server-side search).
