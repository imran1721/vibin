"use client";

import { useCallback, useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureAnonymousSession } from "@/lib/auth";
import { getOrCreateDisplayName } from "@/lib/displayName";
import type { QueueItem, YouTubeSearchItem } from "@/lib/types";
import { YouTubeHostPlayer } from "@/components/YouTubeHostPlayer";
import { QueueList } from "@/components/QueueList";
import { SearchYouTube } from "@/components/SearchYouTube";

type Props = {
  roomId: string;
  hostToken: string | null;
};

const linkClass =
  "text-accent focus-visible:ring-ring inline-flex min-h-11 items-center rounded-lg text-sm font-semibold underline underline-offset-4 transition-colors hover:brightness-110 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const ghostBtnClass =
  "border-border text-foreground hover:bg-muted focus-visible:ring-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const primaryGhostBtnClass =
  "bg-primary/15 text-primary hover:bg-primary/25 focus-visible:ring-ring inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function RoomClient({ roomId, hostToken }: Props) {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const hostTokenForRpc = hostToken ?? "";

  const loadQueue = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("queue_items")
      .select("*")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    setQueue((data ?? []) as QueueItem[]);
  }, [roomId]);

  const checkHostRole = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase
      .from("room_members")
      .select("role")
      .eq("room_id", roomId)
      .eq("user_id", user.id)
      .maybeSingle();
    return data?.role === "host";
  }, [roomId]);

  useEffect(() => {
    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    (async () => {
      let supabase: ReturnType<typeof getSupabaseBrowserClient>;
      try {
        supabase = getSupabaseBrowserClient();
      } catch (e) {
        setConfigError(
          e instanceof Error ? e.message : "Missing Supabase configuration"
        );
        return;
      }

      try {
        await ensureAnonymousSession(supabase);
      } catch (e) {
        if (!cancelled) {
          setBootError(
            e instanceof Error
              ? e.message
              : "Could not start session. Enable Anonymous sign-in in Supabase."
          );
        }
        return;
      }

      if (cancelled) return;

      const joinError = hostToken
        ? (
            await supabase.rpc("join_with_host_token", {
              p_room_id: roomId,
              p_host_token: hostToken,
            })
          ).error
        : (await supabase.rpc("join_room", { p_room_id: roomId })).error;

      if (joinError) {
        if (!cancelled) {
          setBootError(
            /not found|invalid/i.test(joinError.message)
              ? "This jam does not exist or the link is invalid."
              : joinError.message
          );
        }
        return;
      }

      const host = await checkHostRole();
      if (!cancelled) setIsHost(host);

      await loadQueue();

      channel = supabase
        .channel(`queue:${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "queue_items",
            filter: `room_id=eq.${roomId}`,
          },
          () => {
            void loadQueue();
          }
        )
        .subscribe();

      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
      if (channel) {
        try {
          getSupabaseBrowserClient().removeChannel(channel);
        } catch {
          /* client may be unavailable during teardown */
        }
      }
    };
  }, [roomId, hostToken, loadQueue, checkHostRole]);

  const nowPlaying = queue[0] ?? null;
  const nowPlayingId = nowPlaying?.id ?? null;

  const handleEnded = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("advance_queue", {
      p_room_id: roomId,
      p_host_token: hostTokenForRpc,
    });
    if (error) console.error(error);
    await loadQueue();
  }, [roomId, hostTokenForRpc, loadQueue]);

  const handleAdd = useCallback(
    async (item: YouTubeSearchItem) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("queue_items").insert({
        room_id: roomId,
        video_id: item.videoId,
        title: item.title,
        thumb_url: item.thumbUrl || null,
        added_by: getOrCreateDisplayName(),
      });
      if (error) console.error(error);
      await loadQueue();
    },
    [roomId, loadQueue]
  );

  const handleRemove = useCallback(
    async (itemId: string) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("remove_queue_item", {
        p_item_id: itemId,
        p_host_token: hostTokenForRpc,
      });
      if (error) console.error(error);
      await loadQueue();
    },
    [hostTokenForRpc, loadQueue]
  );

  const copyGuestLink = useCallback(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    u.searchParams.delete("h");
    void navigator.clipboard.writeText(u.toString());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }, []);

  const shellMainClass =
    "jam-page-bg mx-auto flex w-full max-w-lg flex-col px-[clamp(1rem,4vw,1.75rem)] pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))] lg:max-w-5xl";

  if (configError) {
    return (
      <main className={`${shellMainClass} gap-5`}>
        <h1 className="font-display text-xl font-bold">Configuration</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {configError}
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          Copy <code className="text-foreground bg-muted rounded px-1.5 py-0.5 text-[0.8rem]">.env.example</code>{" "}
          to{" "}
          <code className="text-foreground bg-muted rounded px-1.5 py-0.5 text-[0.8rem]">.env.local</code>{" "}
          and add your Supabase URL and anon key.
        </p>
        <Link href="/" className={linkClass}>
          Back home
        </Link>
      </main>
    );
  }

  if (bootError) {
    return (
      <main className={`${shellMainClass} gap-5`}>
        <h1 className="font-display text-xl font-bold">Cannot open jam</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {bootError}
        </p>
        <Link href="/" className={linkClass}>
          Back home
        </Link>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className={`${shellMainClass} items-center justify-center py-24`}>
        <p className="text-muted-foreground animate-pulse text-sm motion-reduce:animate-none">
          Joining jam…
        </p>
      </main>
    );
  }

  return (
    <main className={shellMainClass}>
      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_min(100%,22rem)] lg:items-start lg:gap-12 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="flex flex-col gap-6 lg:gap-8">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <p className="text-accent text-xs font-semibold tracking-wide uppercase">
                Jam
              </p>
              <h1 className="font-display text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
                {isHost ? "You’re hosting" : "You’re in the room"}
              </h1>
              {isHost ? (
                <span className="bg-primary/15 text-primary inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold">
                  Host
                </span>
              ) : (
                <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold">
                  Guest
                </span>
              )}
            </div>
            <Link href="/" className={`${linkClass} shrink-0`}>
              Home
            </Link>
          </header>

          {isHost && (
            <section className="flex flex-col gap-3" aria-label="Playback">
              <YouTubeHostPlayer
                videoId={nowPlaying?.video_id ?? null}
                onEnded={handleEnded}
              />
              <p className="text-muted-foreground text-center text-xs leading-relaxed">
                Playback runs on this device. Keep the tab open for the party.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <button
                  type="button"
                  onClick={copyGuestLink}
                  className={ghostBtnClass}
                  aria-live="polite"
                >
                  {copied ? "Copied link" : "Copy guest link"}
                </button>
                {nowPlaying && (
                  <button
                    type="button"
                    onClick={() => void handleEnded()}
                    className={primaryGhostBtnClass}
                  >
                    Skip track
                  </button>
                )}
              </div>
              <p className="text-muted-foreground text-xs leading-relaxed">
                Share the URL <strong className="text-foreground font-semibold">without</strong>{" "}
                <code className="text-foreground bg-muted rounded px-1 py-0.5 text-[0.7rem]">
                  ?h=
                </code>
                —that parameter is your private host key.
              </p>
            </section>
          )}

          {!isHost && nowPlaying && (
            <section
              className="border-border bg-card rounded-2xl border p-5 shadow-sm"
              aria-label="Now playing"
            >
              <p className="text-accent text-xs font-bold tracking-wide uppercase">
                Now playing
              </p>
              <p className="text-foreground mt-2 font-display text-lg font-bold leading-snug">
                {nowPlaying.title}
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                Sound comes from the host’s device—add songs below to queue up.
              </p>
            </section>
          )}
        </div>

        <div className="border-border flex flex-col gap-8 border-t pt-8 lg:sticky lg:top-[max(1rem,env(safe-area-inset-top))] lg:border-t-0 lg:border-l lg:pt-0 lg:pl-10">
          <section aria-labelledby="queue-heading">
            <h2
              id="queue-heading"
              className="font-display text-foreground mb-4 text-lg font-bold"
            >
              Queue
            </h2>
            <QueueList
              items={queue}
              isHost={isHost}
              onRemove={handleRemove}
              nowPlayingId={nowPlayingId}
            />
          </section>

          <section
            className="border-border border-t pt-8 lg:pt-6"
            aria-labelledby="search-heading"
          >
            <h2 id="search-heading" className="sr-only">
              Add to queue
            </h2>
            <SearchYouTube onAdd={handleAdd} />
          </section>
        </div>
      </div>
    </main>
  );
}
