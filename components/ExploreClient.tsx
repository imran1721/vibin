"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureAnonymousSession } from "@/lib/auth";

const REFRESH_INTERVAL_MS = 20_000;

type PublicRoomRow = {
  room_id: string;
  title: string | null;
  watcher_count: number;
  now_playing_video_id: string | null;
  now_playing_title: string | null;
  now_playing_thumb_url: string | null;
  created_at: string;
};

function watcherLabel(n: number): string {
  return `${n} watching`;
}

export function ExploreClient() {
  const [rooms, setRooms] = useState<PublicRoomRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const mountedRef = useRef(true);

  const fetchRooms = useCallback(async () => {
    setRefreshing(true);
    try {
      const supabase = getSupabaseBrowserClient();
      // anon session helps Postgres role detection but list_public_rooms is open to anon too.
      try {
        await ensureAnonymousSession(supabase);
      } catch {
        /* anon-callable RPC; proceed without session */
      }
      const { data, error: rpcError } = await supabase.rpc("list_public_rooms");
      if (rpcError) throw rpcError;
      if (!mountedRef.current) return;
      const rows = Array.isArray(data) ? (data as PublicRoomRow[]) : [];
      setRooms(rows);
      setError(null);
    } catch (e) {
      if (!mountedRef.current) return;
      setError(
        e instanceof Error ? e.message : "Could not load public rooms."
      );
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void fetchRooms();
    const id = window.setInterval(() => {
      void fetchRooms();
    }, REFRESH_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
    };
  }, [fetchRooms]);

  return (
    <main className="vibin-page-bg flex min-h-[100dvh] w-full flex-col items-center px-[clamp(1rem,4vw,1.5rem)] pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] sm:py-8">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm font-semibold"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4" aria-hidden>
                <path d="M15 18l-6-6 6-6" />
              </svg>
              Home
            </Link>
            <button
              type="button"
              onClick={() => void fetchRooms()}
              disabled={refreshing}
              className="border-border bg-card/60 text-foreground hover:bg-muted/70 focus-visible:ring-ring inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} aria-hidden>
                <path d="M3 12a9 9 0 1 1 3 6.7" />
                <path d="M3 21v-6h6" />
              </svg>
              Refresh
            </button>
          </div>
          <h1 className="font-display text-foreground text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
            Explore live rooms
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Public watch parties happening right now. Tap a room to drop in as a guest.
          </p>
        </header>

        {error ? (
          <div className="border-destructive/35 bg-destructive/10 rounded-2xl border px-4 py-3" role="alert">
            <p className="text-destructive text-sm font-medium">{error}</p>
          </div>
        ) : null}

        {rooms == null ? (
          <p className="text-muted-foreground text-sm">Loading rooms…</p>
        ) : rooms.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {rooms.map((room) => (
              <li key={room.room_id}>
                <Link
                  href={`/r/${room.room_id}`}
                  className="border-border/70 bg-card/50 hover:bg-card/80 focus-visible:ring-ring group flex flex-col overflow-hidden rounded-2xl border transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <div className="bg-muted/40 relative aspect-video w-full overflow-hidden">
                    {room.now_playing_thumb_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={room.now_playing_thumb_url}
                        alt={room.now_playing_title ?? "Now playing"}
                        loading="lazy"
                        className="size-full object-cover transition-transform group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="text-muted-foreground flex size-full items-center justify-center text-xs">
                        Nothing playing
                      </div>
                    )}
                    <span className="bg-background/80 text-foreground border-border/60 absolute right-2 top-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold backdrop-blur">
                      <span className="bg-accent inline-block size-1.5 rounded-full" aria-hidden />
                      {watcherLabel(room.watcher_count)}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 px-3 py-3">
                    <p className="text-foreground line-clamp-2 text-sm font-bold leading-snug">
                      {room.title ?? "Untitled room"}
                    </p>
                    {room.now_playing_title ? (
                      <p className="text-muted-foreground line-clamp-1 text-xs">
                        Now playing: {room.now_playing_title}
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="border-border/70 bg-card/40 flex flex-col items-center gap-3 rounded-2xl border px-4 py-10 text-center">
      <div className="bg-primary/12 text-primary flex size-12 items-center justify-center rounded-full">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-6" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" />
        </svg>
      </div>
      <div className="space-y-1">
        <p className="text-foreground text-base font-semibold">No public rooms right now</p>
        <p className="text-muted-foreground text-sm">
          Start a room and switch it to public from room settings to see it here.
        </p>
      </div>
      <Link
        href="/"
        className="bg-primary text-primary-foreground hover:brightness-105 focus-visible:ring-ring inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-bold transition-[filter] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Start a room
      </Link>
    </div>
  );
}
