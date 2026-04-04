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

export function RoomClient({ roomId, hostToken }: Props) {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

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
  }, []);

  if (configError) {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-10">
        <h1 className="text-xl font-semibold">Configuration</h1>
        <p className="text-foreground/70 text-sm">{configError}</p>
        <p className="text-foreground/50 text-xs">
          Copy <code className="text-foreground/80">.env.example</code> to{" "}
          <code className="text-foreground/80">.env.local</code> and add your
          Supabase URL and anon key.
        </p>
        <Link href="/" className="text-amber-400 text-sm underline">
          Back home
        </Link>
      </main>
    );
  }

  if (bootError) {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-10">
        <h1 className="text-xl font-semibold">Cannot open jam</h1>
        <p className="text-foreground/70 text-sm">{bootError}</p>
        <Link href="/" className="text-amber-400 text-sm underline">
          Back home
        </Link>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-foreground/60 animate-pulse text-sm">Joining jam…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-lg flex-col gap-6 px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex items-start justify-between gap-2">
        <div>
          <p className="text-foreground/50 text-xs uppercase tracking-wide">
            Jam
          </p>
          <h1 className="text-lg font-semibold">
            {isHost ? "You’re hosting" : "You’re in the room"}
          </h1>
        </div>
        <Link
          href="/"
          className="text-foreground/60 hover:text-foreground text-sm underline"
        >
          Home
        </Link>
      </header>

      {isHost && (
        <section className="flex flex-col gap-2">
          <YouTubeHostPlayer
            videoId={nowPlaying?.video_id ?? null}
            onEnded={handleEnded}
          />
          <p className="text-foreground/50 text-center text-xs">
            Playback runs on this device. Keep the tab open.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyGuestLink}
              className="border-foreground/20 hover:bg-foreground/5 rounded-lg border px-3 py-2 text-xs"
            >
              Copy guest link
            </button>
            {nowPlaying && (
              <button
                type="button"
                onClick={() => void handleEnded()}
                className="bg-foreground/10 hover:bg-foreground/15 rounded-lg px-3 py-2 text-xs font-medium"
              >
                Skip
              </button>
            )}
            <span className="text-foreground/40 text-xs">
              Don’t share the URL with <code className="text-foreground/60">?h=</code> — that’s your host key.
            </span>
          </div>
        </section>
      )}

      {!isHost && nowPlaying && (
        <section className="border-foreground/15 rounded-xl border p-4">
          <p className="text-foreground/50 mb-1 text-xs">Now playing</p>
          <p className="font-medium">{nowPlaying.title}</p>
          <p className="text-foreground/50 mt-1 text-xs">
            Audio plays on the host’s device.
          </p>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-semibold">Queue</h2>
        <QueueList
          items={queue}
          isHost={isHost}
          onRemove={handleRemove}
          nowPlayingId={nowPlayingId}
        />
      </section>

      <section className="border-foreground/10 border-t pt-4">
        <SearchYouTube onAdd={handleAdd} />
      </section>
    </main>
  );
}
