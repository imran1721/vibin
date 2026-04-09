# PRD: Connect Google (Login + YouTube) for Personalization

## Summary
Add a single user-facing **“Connect Google”** flow that works from:

- **Homepage**
- **Inside an active room session** (host view)

The flow chains:

1. **Supabase Google login** (identity across devices)
2. **YouTube OAuth connect** (Data API access + refresh token storage)

Anonymous users can continue using rooms/search/queue as-is, but **AI personalization / RAG profile is not stored** until the user connects Google.

## Problem
We want to curate better suggestions using a user’s YouTube account signals (playlists/subscriptions/likes where available). Supabase anonymous sessions are device-local, so they can’t reliably map the “same person” across devices, and we don’t want to store AI-related profile data for anonymous drive-by usage.

## Goals
- **One-button onboarding**: a single “Connect Google” entry point that feels like one flow.
- **Cross-device identity**: user can sign in on a new device and keep their profile.
- **Opt-in personalization**: do not store AI personalization data unless user connects Google.
- **Keep current product working**: anonymous rooms/search/queue should remain unchanged.
- **Enable future RAG**: once connected, we can ingest YouTube signals and build an embeddings index (Vertex AI Vector Search).

## Non-goals (Phase 1)
- Reproducing YouTube’s Home-feed “recommended” algorithm.
- Blending multiple guests’ profiles into one room.
- Building the full RAG pipeline in Phase 1 (this PRD defines the product surface and gating; indexing/suggest endpoints come next).

## Personas
- **Anonymous user**: wants to start/join quickly; should not be forced to log in.
- **Host**: wants better suggestions and playlist import; willing to connect Google.

## Key user stories
### Anonymous user
- I can start/join a room and queue videos without logging in.
- I see a clear CTA explaining personalization and why login is required.
- If I click “Connect Google,” the app guides me through login and YouTube connect.

### Logged-in user
- I can connect YouTube and browse/import playlists.
- The app can later build a taste profile and generate better suggestions.

### Host in room
- I can trigger “Connect Google” during an active room session and return back to the room.

## UX flows
### Flow A: Homepage “Connect Google”
1. User taps **Connect Google**.
2. If user is anonymous / not logged in:
   - Start **Supabase Auth Google login**.
3. After redirect back, user is logged in:
   - Automatically start **YouTube OAuth connect** (existing playlist flow).
4. After YouTube callback returns with `youtube_connected=1`:
   - Show connected state and load playlists.

### Flow B: In-room “Connect Google”
Same flow as A, but returns user to the room and updates the in-room UI.

### Flow C: Gating AI personalization
- If anonymous or not YouTube-connected:
  - Show CTA: “Log in to curate suggestions from your playlists/subscriptions/likes.”
- If logged-in + YouTube-connected:
  - Enable personalized suggestion entry points (Phase 2+).

## Requirements
### Functional
- **FR1**: Add “Connect Google” CTA on homepage.
- **FR2**: Add “Connect Google” CTA in-room (host view).
- **FR3**: The CTA triggers chained auth:
  - Supabase Google login → YouTube OAuth connect.
- **FR4**: Anonymous users:
  - Rooms/search/queue work as-is.
  - No AI personalization / RAG profile is stored.
- **FR5**: Store a short-lived “connect intent” so redirects resume the flow and avoid loops.
- **FR6**: After success, playlist features work as they do today.

### UX
- **UX1**: Copy clearly explains benefit + privacy:
  - “Connect Google to curate suggestions from your YouTube playlists/subscriptions.”
- **UX2**: Avoid redirect loops; show clear error states (login cancelled, YouTube connect cancelled, token refresh failed).
- **UX3**: Works on desktop + mobile.

### Security & privacy
- **SP1**: Any indexing/query endpoints must require a valid Supabase session and scope data access by `user.id`.
- **SP2**: Do not ingest/store YouTube-derived preference data for anonymous sessions.
- **SP3**: Provide a future path for “Disconnect YouTube” and “Clear personalization profile” (Phase 2).

## Technical approach (Phase 1)
### “Single flow” implementation
Even if the UI is one button, there are two distinct permissions:

- **Supabase Auth Google login**: establishes user identity across devices.
- **YouTube OAuth**: grants YouTube Data API access and yields refresh token stored server-side.

We keep one CTA and chain steps automatically using a client-side “connect intent” flag (e.g. sessionStorage) that survives redirects.

### Connected states
The UI should represent these states:

1. **Anonymous**: show CTA explaining login requirement.
2. **Logged-in, not YouTube-connected**: show CTA “Connect YouTube”.
3. **Logged-in, YouTube-connected**: show playlists; enable personalization entry points later.

## Phase plan
### Phase 1: Connect flow + gating
- Add unified “Connect Google” CTA homepage + in-room.
- Chain Supabase Google login → YouTube OAuth.
- No RAG indexing yet; just ensure we can identify a persistent user.

### Phase 2: Indexing + status
- Add “taste profile” indexing job and status (`not_started | indexing | ready | error`).
- Add “clear profile” + “disconnect” actions.

### Phase 3: Full RAG
- Build documents from playlists/subscriptions (likes best-effort).
- Embed with Vertex embeddings.
- Store/query vectors in Vertex AI Vector Search (filtered by user id).
- Generate YouTube search queries grounded on retrieved docs; resolve via `/api/youtube/search`.

## Open questions
- Should the in-room CTA be host-only (recommended) or visible to guests too?
- Should we auto-start YouTube connect immediately after login, or ask for confirmation?
- Should we require YouTube connect for all personalization (recommended) or allow login-only personalization?

