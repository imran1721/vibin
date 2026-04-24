"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ThumbArt } from "@/components/HomeHeroArt";
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

type ThumbVariant = "sunset" | "lofi" | "movie" | "stage" | "stream" | "concert";
const THUMB_POOL: ThumbVariant[] = [
  "sunset",
  "lofi",
  "movie",
  "stage",
  "stream",
  "concert",
];

function pickThumbVariant(seed: string): ThumbVariant {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return THUMB_POOL[h % THUMB_POOL.length];
}

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

  if (failed) return null;

  return (
    <section aria-labelledby="live-now-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 px-1">
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
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="size-3.5"
            aria-hidden
          >
            <path d="M9 6l6 6-6 6" />
          </svg>
        </Link>
      </div>

      {rooms == null ? (
        <ul className="flex flex-col gap-1" aria-hidden>
          {Array.from({ length: 2 }).map((_, i) => (
            <li key={i} className="bg-muted/30 h-16 animate-pulse rounded-xl" />
          ))}
        </ul>
      ) : rooms.length === 0 ? (
        <EmptyHint />
      ) : (
        <ul className="flex flex-col">
          {rooms.map((room) => (
            <LiveRow key={room.room_id} room={room} />
          ))}
        </ul>
      )}
    </section>
  );
}

function LiveRow({ room }: { room: PublicRoomRow }) {
  const variant = useMemo(
    () => pickThumbVariant(room.now_playing_video_id ?? room.room_id),
    [room.now_playing_video_id, room.room_id]
  );
  const hasReal = !!room.now_playing_thumb_url;
  return (
    <li className="border-border/50 border-b last:border-b-0">
      <Link
        href={`/r/${room.room_id}`}
        className="hover:bg-muted/30 focus-visible:ring-ring group flex items-center gap-3 rounded-lg px-1 py-2.5 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="relative shrink-0">
          {hasReal ? (
            <div
              className="bg-muted relative aspect-video w-24 overflow-hidden rounded-lg"
              style={{ boxShadow: "inset 0 0 0 1px rgba(0,0,0,.05)" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={room.now_playing_thumb_url as string}
                alt=""
                loading="lazy"
                className="size-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div
                  className="grid size-6 place-items-center rounded-full"
                  style={{
                    background: "rgba(0,0,0,.45)",
                    backdropFilter: "blur(2px)",
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff" aria-hidden>
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            <ThumbArt variant={variant} width={96} height={54} duration="live" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-foreground line-clamp-1 text-sm font-bold leading-tight">
            {room.title ?? "Untitled room"}
          </p>
          {room.now_playing_title ? (
            <p className="text-muted-foreground line-clamp-1 mt-0.5 text-xs leading-snug">
              {room.now_playing_title}
            </p>
          ) : (
            <p className="text-muted-foreground/80 mt-0.5 text-xs italic leading-snug">
              Queuing next vibe…
            </p>
          )}
          <p className="text-muted-foreground mt-1 inline-flex items-center gap-1.5 text-[0.7rem] font-semibold">
            <span
              className="inline-block size-1.5 rounded-full"
              style={{
                background: "#34d399",
                boxShadow: "0 0 8px rgba(52,211,153,.6)",
              }}
              aria-hidden
            />
            {room.watcher_count} watching
          </p>
        </div>

        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-muted-foreground/70 group-hover:text-foreground size-4 shrink-0 transition-colors"
          aria-hidden
        >
          <path d="M9 6l6 6-6 6" />
        </svg>
      </Link>
    </li>
  );
}

function EmptyHint() {
  return (
    <div className="border-border/60 bg-card/35 text-muted-foreground rounded-xl border px-4 py-3 text-xs leading-relaxed">
      No public rooms right now. Start one and switch it to public from{" "}
      <span className="text-foreground font-semibold">Room settings</span> to
      land it here.
    </div>
  );
}
