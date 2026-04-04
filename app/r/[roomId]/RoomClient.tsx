"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureAnonymousSession } from "@/lib/auth";
import { getOrCreateDisplayName } from "@/lib/displayName";
import type { QueueItem, YouTubeSearchItem } from "@/lib/types";
import { YouTubeHostPlayer } from "@/components/YouTubeHostPlayer";
import {
  NowPlayingQueueRow,
  QueueList,
  type QueueListHandle,
} from "@/components/QueueList";
import { SearchYouTube } from "@/components/SearchYouTube";
import { HostYoutubePlaylists } from "@/components/HostYoutubePlaylists";
import { GuestInviteDialog } from "@/components/GuestInviteDialog";
import { VibinMark } from "@/components/VibinMark";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { JoinRoomLoader } from "@/components/JoinRoomLoader";

type Props = {
  roomId: string;
  hostToken: string | null;
};

const linkClass =
  "text-accent focus-visible:ring-ring inline-flex min-h-11 items-center rounded-lg text-sm font-semibold underline underline-offset-4 transition-colors hover:brightness-110 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** App wordmark next to logo in room header (tight line-height + slight optical shift vs square mark) */
const headerBrandWordClass =
  "text-accent font-display text-xl font-bold leading-none tracking-normal text-[35px] sm:mb-[-13px] mb-[-6px]";

const headerToolbarClass =
  "border-border/70 bg-card/45 flex shrink-0 items-center gap-0.5 self-center rounded-2xl border p-0.5 shadow-sm backdrop-blur-sm";

const headerToolbarBtnClass =
  "text-foreground hover:bg-muted/80 focus-visible:ring-ring inline-flex min-h-9 shrink-0 items-center justify-center rounded-[0.65rem] px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-10 sm:px-4 sm:text-sm";

const collapsibleTriggerClass =
  "text-foreground hover:bg-muted/50 focus-visible:ring-ring group flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-lg py-1 pl-0.5 pr-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:gap-2 sm:pl-1";

function CollapseChevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`text-muted-foreground size-5 shrink-0 transition-transform duration-300 ease-out motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

const collapsibleEase =
  "transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.33,1,0.68,1)] motion-reduce:transition-none motion-reduce:duration-0";

type CollapsiblePanelProps = {
  id: string;
  open: boolean;
  labelledBy: string;
  /** Applied only while open so collapsed state doesn’t reserve vertical gap. */
  marginClassWhenOpen: string;
  innerClassName: string;
  children: React.ReactNode;
};

function CollapsiblePanel({
  id,
  open,
  labelledBy,
  marginClassWhenOpen,
  innerClassName,
  children,
}: CollapsiblePanelProps) {
  return (
    <div
      id={id}
      role="region"
      aria-labelledby={labelledBy}
      aria-hidden={!open}
      className={`grid min-w-0 w-full overflow-hidden ${collapsibleEase} ${open ? marginClassWhenOpen : ""} ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
    >
      <div className="min-h-0 min-w-0">
        <div
          className={`min-w-0 max-w-full ${innerClassName}`}
          inert={!open}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

export function RoomClient({ roomId, hostToken }: Props) {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [guestInviteUrl, setGuestInviteUrl] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [playbackPaused, setPlaybackPaused] = useState(false);
  const [playbackCurrentItemId, setPlaybackCurrentItemId] = useState<
    string | null
  >(null);
  const [controlsBusy, setControlsBusy] = useState(false);
  const [queueJumpBusy, setQueueJumpBusy] = useState(false);
  const [clearQueueBusy, setClearQueueBusy] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [queueSectionOpen, setQueueSectionOpen] = useState(true);
  const [playlistSectionOpen, setPlaylistSectionOpen] = useState(true);
  /** Whether the now-playing row is inside the queue list’s scroll viewport (any scroll position). */
  const [nowPlayingVisibleInQueueScroll, setNowPlayingVisibleInQueueScroll] =
    useState(true);
  const [queueSectionInView, setQueueSectionInView] = useState(true);

  const queueSectionRef = useRef<HTMLElement | null>(null);
  const queueListRef = useRef<QueueListHandle | null>(null);

  const hostTokenForRpc = hostToken ?? "";

  const onNowPlayingVisibleInQueueChange = useCallback((visible: boolean) => {
    setNowPlayingVisibleInQueueScroll(visible);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const el = queueSectionRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e) return;
        setQueueSectionInView(
          e.isIntersecting && e.intersectionRatio > 0.08
        );
      },
      { threshold: [0, 0.05, 0.08, 0.12, 0.2, 0.35, 0.5] }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [ready]);

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

  const refreshPlaybackState = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("rooms")
      .select("playback_paused, playback_current_item_id")
      .eq("id", roomId)
      .maybeSingle();
    if (error) {
      console.error(error);
      return;
    }
    if (data) {
      setPlaybackPaused(!!data.playback_paused);
      setPlaybackCurrentItemId(data.playback_current_item_id ?? null);
    }
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

    const onQueueEvent = () => {
      void loadQueue();
      void refreshPlaybackState();
    };

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
              ? "This room does not exist or the link is invalid."
              : joinError.message
          );
        }
        return;
      }

      const host = await checkHostRole();
      if (!cancelled) setIsHost(host);

      await loadQueue();
      await refreshPlaybackState();

      channel = supabase
        .channel(`room:${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "queue_items",
            filter: `room_id=eq.${roomId}`,
          },
          onQueueEvent
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "rooms",
            filter: `id=eq.${roomId}`,
          },
          () => {
            void refreshPlaybackState();
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
  }, [
    roomId,
    hostToken,
    loadQueue,
    checkHostRole,
    refreshPlaybackState,
  ]);

  const effectiveNowId = useMemo(() => {
    if (queue.length === 0) return null;
    if (
      playbackCurrentItemId &&
      queue.some((q) => q.id === playbackCurrentItemId)
    ) {
      return playbackCurrentItemId;
    }
    return queue[0]?.id ?? null;
  }, [queue, playbackCurrentItemId]);

  const nowPlaying = useMemo(
    () => queue.find((q) => q.id === effectiveNowId) ?? null,
    [queue, effectiveNowId]
  );
  const nowPlayingId = effectiveNowId;
  const hasNowPlaying = !!nowPlaying;

  const queuedVideoIds = useMemo(
    () => new Set(queue.map((q) => q.video_id)),
    [queue]
  );

  const currentQueueIndex = useMemo(() => {
    if (!effectiveNowId) return -1;
    return queue.findIndex((q) => q.id === effectiveNowId);
  }, [queue, effectiveNowId]);

  const canPrev = currentQueueIndex > 0;

  const handleGoToNowPlaying = useCallback(() => {
    setQueueSectionOpen(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        queueListRef.current?.scrollCurrentToTop();
      });
    });
  }, []);

  const advanceToNextTrack = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.rpc("advance_queue", {
      p_room_id: roomId,
      p_host_token: hostTokenForRpc,
    });
    if (error) console.error(error);
    await loadQueue();
    await refreshPlaybackState();
  }, [roomId, hostTokenForRpc, loadQueue, refreshPlaybackState]);

  const goPrevious = useCallback(async () => {
    setControlsBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("playback_previous", {
        p_room_id: roomId,
        p_host_token: hostTokenForRpc,
      });
      if (error) console.error(error);
      await loadQueue();
      await refreshPlaybackState();
    } finally {
      setControlsBusy(false);
    }
  }, [roomId, hostTokenForRpc, loadQueue, refreshPlaybackState]);

  const goNext = useCallback(async () => {
    setControlsBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("advance_queue", {
        p_room_id: roomId,
        p_host_token: hostTokenForRpc,
      });
      if (error) console.error(error);
      await loadQueue();
      await refreshPlaybackState();
    } finally {
      setControlsBusy(false);
    }
  }, [roomId, hostTokenForRpc, loadQueue, refreshPlaybackState]);

  const setPaused = useCallback(
    async (paused: boolean) => {
      setControlsBusy(true);
      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.rpc("playback_set_paused", {
          p_room_id: roomId,
          p_paused: paused,
        });
        if (error) console.error(error);
        await refreshPlaybackState();
      } finally {
        setControlsBusy(false);
      }
    },
    [roomId, refreshPlaybackState]
  );

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
      await refreshPlaybackState();
    },
    [hostTokenForRpc, loadQueue, refreshPlaybackState]
  );

  const handlePlayQueueItem = useCallback(
    async (itemId: string) => {
      if (itemId === nowPlayingId) return;
      setQueueJumpBusy(true);
      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.rpc("jump_to_queue_item", {
          p_item_id: itemId,
          p_host_token: hostTokenForRpc,
        });
        if (error) console.error(error);
        await loadQueue();
        await refreshPlaybackState();
      } finally {
        setQueueJumpBusy(false);
      }
    },
    [hostTokenForRpc, loadQueue, nowPlayingId, refreshPlaybackState]
  );

  const runClearQueue = useCallback(async () => {
    setClearQueueBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("clear_room_queue", {
        p_room_id: roomId,
        p_host_token: hostTokenForRpc,
      });
      if (error) {
        console.error(error);
        return;
      }
      await loadQueue();
      await refreshPlaybackState();
      setClearConfirmOpen(false);
    } finally {
      setClearQueueBusy(false);
    }
  }, [roomId, hostTokenForRpc, loadQueue, refreshPlaybackState]);

  const openGuestInvite = useCallback(() => {
    if (typeof window !== "undefined") {
      setGuestInviteUrl(
        (u) => u || `${window.location.origin}/r/${roomId}`
      );
    }
    setInviteOpen(true);
  }, [roomId]);

  const shellMainClass =
    "vibin-page-bg mx-auto flex w-full max-w-lg flex-col px-[clamp(1rem,4vw,1.5rem)] pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] lg:max-w-5xl";

  /** Room shell: full-width main so sticky header bar can span the viewport; content is inset below. */
  const shellMainScrollClass =
    "vibin-page-bg relative flex w-full flex-col pb-[max(1.25rem,env(safe-area-inset-bottom))]";

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
        <h1 className="font-display text-xl font-bold">Cannot open room</h1>
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
      <main
        className={`${shellMainClass} min-h-[100dvh] items-center justify-center`}
      >
        <JoinRoomLoader />
      </main>
    );
  }

  const playbackBusy = controlsBusy || queueJumpBusy;

  const queuePlayback = {
    isPaused: playbackPaused,
    busy: playbackBusy,
    canPrevious: canPrev,
    hasNowPlaying,
    onPrevious: () => void goPrevious(),
    onPlay: () => void setPaused(false),
    onPause: () => void setPaused(true),
    onNext: () => void goNext(),
  };

  const showGoToNowPlayingFab =
    hasNowPlaying &&
    queue.length > 0 &&
    (!queueSectionInView ||
      (queueSectionOpen && !nowPlayingVisibleInQueueScroll));

  return (
    <main className={shellMainScrollClass}>
      <header className="border-border/50 bg-background/90 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 w-full border-b pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-3 px-[clamp(1rem,4vw,1.5rem)] sm:gap-4 xl:max-w-3xl">
          <div className="flex min-w-0 flex-1 items-center pr-2">
            {isHost ? (
              <>
                <h1 className="sr-only">Vibin — you are the host</h1>
                <div className="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-1.5 sm:gap-x-2.5">
                  <div className="flex gap-1.5 items-center">
                    <VibinMark className="size-10 sm:size-11" />
                    <span className={`${headerBrandWordClass} shrink-0`}>
                      Vibin
                    </span>
                  </div>
                  <span className="bg-primary/12 text-primary border-primary/20 inline-flex shrink-0 items-center justify-center rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold uppercase leading-none tracking-wider sm:text-[0.65rem] mb-1">
                    Host
                  </span>
                </div>
              </>
            ) : (
              <div className="space-y-1 sm:space-y-1.5">
                <div className="flex min-w-0 flex-wrap items-end gap-x-2 gap-y-1 sm:gap-x-2.5">
                  <div className="flex sm:gap-1.5 items-center">
                    <VibinMark className="size-10 sm:size-11" />
                    <span className={`${headerBrandWordClass} shrink-0`}>
                      Vibin
                    </span>
                  </div>
                  <span className="border-border bg-muted/45 text-muted-foreground inline-flex shrink-0 items-center justify-center rounded-full border px-2.5 py-0.5 text-[0.65rem] font-semibold leading-none sm:px-3 sm:text-xs">
                    Guest
                  </span>
                </div>
                <h1 className="font-display text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
                  You’re in the room
                </h1>
              </div>
            )}
          </div>
          <div className={headerToolbarClass}>
            {isHost && (
              <button
                type="button"
                onClick={openGuestInvite}
                className={headerToolbarBtnClass}
                title="QR code and share link for guests (without host key)"
              >
                Invite
              </button>
            )}
            <Link href="/" className={`${headerToolbarBtnClass} no-underline`}>
              Home
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full min-w-0 max-w-lg px-[clamp(1rem,4vw,1.5rem)] lg:max-w-5xl">
        <div className="mx-auto flex w-full min-w-0 max-w-2xl flex-col gap-3 xl:max-w-3xl">
          <section aria-labelledby="search-heading" className="flex flex-col gap-1">
            <h2 id="search-heading" className="sr-only">
              Search YouTube
            </h2>
            <SearchYouTube
              onAdd={handleAdd}
              queuedVideoIds={queuedVideoIds}
            />
          </section>

          {isHost && (
            <section className="flex flex-col gap-2" aria-label="Playback">
              <YouTubeHostPlayer
                videoId={nowPlaying?.video_id ?? null}
                onEnded={advanceToNextTrack}
                remotePaused={playbackPaused}
              />
              <p className="text-muted-foreground px-1 text-center text-[0.7rem] leading-snug sm:text-xs">
                Playback runs on this device. Keep the tab open for the party.
              </p>
            </section>
          )}

          <section
          ref={queueSectionRef}
          className="border-border min-w-0 border-t pt-3"
          aria-labelledby="queue-section-title"
        >
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <button
              type="button"
              id="queue-section-title"
              className={collapsibleTriggerClass}
              aria-expanded={queueSectionOpen}
              aria-controls="queue-panel"
              onClick={() => setQueueSectionOpen((o) => !o)}
            >
              <CollapseChevron open={queueSectionOpen} />
              <span className="font-display text-base font-bold sm:text-lg">
                Queue
              </span>
            </button>
            {isHost && queueSectionOpen ? (
              <button
                type="button"
                onClick={() => setClearConfirmOpen(true)}
                disabled={
                  queue.length === 0 ||
                  clearQueueBusy ||
                  queueJumpBusy ||
                  clearConfirmOpen
                }
                className="border-destructive/45 text-destructive hover:bg-destructive/10 focus-visible:ring-destructive inline-flex min-h-8 shrink-0 items-center justify-center rounded-md border px-2 py-1 text-[0.65rem] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40 sm:text-xs"
              >
                Clear queue
              </button>
            ) : null}
          </div>
          {!queueSectionOpen && nowPlaying ? (
            <div
              className="vibin-collapsible-strip-in mt-3"
              role="region"
              aria-label="Now playing"
            >
              <NowPlayingQueueRow
                item={nowPlaying}
                playback={hasNowPlaying ? queuePlayback : undefined}
              />
            </div>
          ) : null}
          <CollapsiblePanel
            id="queue-panel"
            open={queueSectionOpen}
            labelledBy="queue-section-title"
            marginClassWhenOpen="mt-3"
            innerClassName="flex flex-col gap-3"
          >
            <QueueList
              ref={queueListRef}
              listPanelOpen={queueSectionOpen}
              items={queue}
              onRemove={handleRemove}
              nowPlayingId={nowPlayingId}
              onPlayItem={(id) => void handlePlayQueueItem(id)}
              playBusy={queueJumpBusy}
              playback={hasNowPlaying ? queuePlayback : undefined}
              onNowPlayingVisibleInQueueChange={
                onNowPlayingVisibleInQueueChange
              }
            />
          </CollapsiblePanel>
          </section>

          <section
          className="border-border min-w-0 border-t pt-3"
          aria-labelledby="yt-pl-section-title"
        >
          <button
            type="button"
            id="yt-pl-section-title"
            className={collapsibleTriggerClass}
            aria-expanded={playlistSectionOpen}
            aria-controls="yt-pl-panel"
            onClick={() => setPlaylistSectionOpen((o) => !o)}
          >
            <CollapseChevron open={playlistSectionOpen} />
            <span className="font-display text-base font-bold sm:text-lg">
              YouTube playlists
            </span>
          </button>
          <CollapsiblePanel
            id="yt-pl-panel"
            open={playlistSectionOpen}
            labelledBy="yt-pl-section-title"
            marginClassWhenOpen="mt-[2px]"
            innerClassName="flex flex-col gap-2.5"
          >
            <p className="text-muted-foreground max-w-prose break-words text-[0.7rem] leading-snug sm:text-xs">
              Connect your Google account to list your playlists. Add tracks,
              add an entire playlist, or replace the queue.
            </p>
            <Suspense
              fallback={
                <p className="text-muted-foreground text-xs">
                  Loading playlists…
                </p>
              }
            >
              <HostYoutubePlaylists
                roomId={roomId}
                omitSectionChrome
                queuedVideoIds={queuedVideoIds}
                onImported={() => {
                  void loadQueue();
                  void refreshPlaybackState();
                }}
              />
            </Suspense>
          </CollapsiblePanel>
          </section>

          {isHost ? (
          <>
            <ConfirmDialog
              open={clearConfirmOpen}
              onOpenChange={setClearConfirmOpen}
              title="Clear queue?"
              description="Remove every track from the queue. This cannot be undone."
              confirmLabel="Clear queue"
              onConfirm={runClearQueue}
              busy={clearQueueBusy}
              destructive
            />
            <GuestInviteDialog
              open={inviteOpen}
              onOpenChange={setInviteOpen}
              url={guestInviteUrl}
            />
          </>
          ) : null}
        </div>
      </div>

      {showGoToNowPlayingFab ? (
        <button
          type="button"
          onClick={handleGoToNowPlaying}
          disabled={queueJumpBusy}
          className="border-primary/35 bg-primary text-primary-foreground hover:brightness-105 focus-visible:ring-ring fixed bottom-[max(0.85rem,env(safe-area-inset-bottom))] left-1/2 z-40 inline-flex min-h-10 -translate-x-1/2 items-center justify-center rounded-full border px-4 py-2 text-xs font-bold shadow-lg shadow-black/20 transition-[filter] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-45 sm:bottom-[max(1.1rem,env(safe-area-inset-bottom))] sm:px-5 sm:text-sm"
        >
          Go to now playing
        </button>
      ) : null}
    </main>
  );
}
