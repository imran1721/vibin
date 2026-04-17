"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const PREVIEW_LIMIT = 3;
const REFRESH_INTERVAL_MS = 30_000;

type PublicRoomRow = {
  room_id: string;
  title: string | null;
  watcher_count: number;
  now_playing_video_id: string | null;
  now_playing_title: string | null;
  now_playing_thumb_url: string | null;
  created_at: string;
};

export function LiveRoomsPreview() {
  const [rooms, setRooms] = useState<PublicRoomRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    const fetchRooms = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.rpc("list_public_rooms");
        if (!mountedRef.current) return;
        if (error) throw error;
        const rows = Array.isArray(data) ? (data as PublicRoomRow[]) : [];
        setRooms(rows.slice(0, PREVIEW_LIMIT));
        setFailed(false);
      } catch {
        if (!mountedRef.current) return;
        setFailed(true);
      }
    };

    void fetchRooms();
    const id = window.setInterval(() => void fetchRooms(), REFRESH_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      window.clearInterval(id);
    };
  }, []);

  // Failed silently — landing page should not show error noise.
  if (failed) return null;

  return (
    <section
      aria-labelledby="live-now-heading"
      className="border-border/70 bg-card/45 flex flex-col gap-3 rounded-2xl border px-4 py-4 sm:px-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="relative flex size-2" aria-hidden>
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-70 motion-reduce:hidden" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
          </span>
          <h2
            id="live-now-heading"
            className="text-foreground text-sm font-bold uppercase tracking-wider"
          >
            Live now
          </h2>
        </div>
        <Link
          href="/explore"
          className="text-accent hover:brightness-110 focus-visible:ring-ring inline-flex items-center gap-1 rounded text-xs font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Browse all
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3.5" aria-hidden>
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      </div>

      {rooms == null ? (
        <ul className="flex flex-col gap-2" aria-hidden>
          {Array.from({ length: 2 }).map((_, i) => (
            <li
              key={i}
              className="bg-muted/40 h-14 animate-pulse rounded-xl"
            />
          ))}
        </ul>
      ) : rooms.length === 0 ? (
        <EmptyHint />
      ) : (
        <ul className="flex flex-col gap-2">
          {rooms.map((room) => (
            <li key={room.room_id}>
              <Link
                href={`/r/${room.room_id}`}
                className="border-border/60 bg-background/60 hover:bg-muted/40 focus-visible:ring-ring flex items-center gap-3 rounded-xl border p-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <div className="bg-muted/40 relative aspect-video w-20 shrink-0 overflow-hidden rounded-lg sm:w-24">
                  {room.now_playing_thumb_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={room.now_playing_thumb_url}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="text-muted-foreground/70 flex size-full items-center justify-center text-[0.6rem]">
                      —
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-foreground line-clamp-1 text-sm font-bold leading-tight">
                    {room.title ?? "Untitled room"}
                  </p>
                  {room.now_playing_title ? (
                    <p className="text-muted-foreground line-clamp-1 mt-0.5 text-xs">
                      {room.now_playing_title}
                    </p>
                  ) : null}
                  <p className="text-muted-foreground mt-0.5 inline-flex items-center gap-1 text-[0.7rem] font-semibold">
                    <span className="bg-accent inline-block size-1.5 rounded-full" aria-hidden />
                    {room.watcher_count} watching
                  </p>
                </div>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-muted-foreground size-4 shrink-0"
                  aria-hidden
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EmptyHint() {
  return (
    <div className="text-muted-foreground text-xs leading-relaxed">
      No public rooms right now. Start one and switch it to public from{" "}
      <span className="text-foreground font-semibold">Room settings</span> to
      land it here.
    </div>
  );
}
