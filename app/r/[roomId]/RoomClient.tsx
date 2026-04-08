"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureAnonymousSession } from "@/lib/auth";
import {
  getQueueAttributionLabel,
  hasCompletedDisplayProfile,
  shouldBroadcastActivity,
} from "@/lib/displayName";
import type { QueueItem, YouTubeSearchItem } from "@/lib/types";
import {
  YouTubeSyncPlayer,
  type YouTubeSyncPlayerHandle,
} from "@/components/YouTubeHostPlayer";
import { effectivePlaybackSec } from "@/lib/playback-sync";
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
import { RoomGuestJoinToast } from "@/components/RoomGuestJoinToast";
import { RoomDisplayNameDialog } from "@/components/RoomDisplayNameDialog";
import {
  GuestListDialog,
  type GuestListEntry,
} from "@/components/GuestListDialog";
import {
  clearPartySession,
  GUEST_VIDEO_PREF_KEY,
  readGuestShowSyncedVideoPref,
  setStoredPartyRoomId,
  shouldResetPartySessionForRoom,
} from "@/lib/party-session";

type Props = {
  roomId: string;
  hostToken: string | null;
  /** From `?new=1` after “Start a room” — loader says “Creating” instead of “Joining”. */
  justCreated?: boolean;
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

/** Throttled server touch so closed tabs go stale and host can prune. */
const ROOM_PRESENCE_HEARTBEAT_MS = 45_000;
/** Host-only cleanup interval (must exceed heartbeat + network slack). */
const HOST_PRUNE_STALE_GUESTS_MS = 90_000;
/** Guests with no heartbeat for this long are removed by prune (host client or cron). */
const STALE_GUEST_MINUTES = 3;

type PostgresChangePayload<T> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Partial<T>;
  old: Partial<T>;
};

function shortTrackTitle(title: string, max = 36): string {
  const t = title.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

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

export function RoomClient({ roomId, hostToken, justCreated = false }: Props) {
  const [ready, setReady] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [guestInviteUrl, setGuestInviteUrl] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [playbackPaused, setPlaybackPaused] = useState(false);
  const [playbackAnchorSec, setPlaybackAnchorSec] = useState(0);
  const [playbackAnchorAt, setPlaybackAnchorAt] = useState(() =>
    new Date().toISOString()
  );
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
  /** Guests only: load/sync YouTube on this device when true (opt-in). */
  const [guestShowSyncedVideo, setGuestShowSyncedVideo] = useState(false);
  const [guestCount, setGuestCount] = useState(0);
  const [guestRoster, setGuestRoster] = useState<GuestListEntry[]>([]);
  const [guestListOpen, setGuestListOpen] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [joinToastMessage, setJoinToastMessage] = useState<string | null>(
    null
  );
  const [activityToastMessage, setActivityToastMessage] = useState<
    string | null
  >(null);
  const [profileGateDone, setProfileGateDone] = useState(false);

  const queueSectionRef = useRef<HTMLElement | null>(null);
  const roomChannelRef = useRef<RealtimeChannel | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const queueListRef = useRef<QueueListHandle | null>(null);
  const advanceInFlightRef = useRef(false);
  const syncPlayerRef = useRef<YouTubeSyncPlayerHandle | null>(null);
  const prevJoinKeyRef = useRef<string>("");
  const guestListOpenRef = useRef(false);

  const router = useRouter();
  const hostTokenForRpc = hostToken ?? "";

  useEffect(() => {
    if (!justCreated || typeof window === "undefined") return;
    const u = new URL(window.location.href);
    if (u.searchParams.get("new") !== "1") return;
    u.searchParams.delete("new");
    const qs = u.searchParams.toString();
    window.history.replaceState(
      {},
      "",
      `${u.pathname}${qs ? `?${qs}` : ""}${u.hash}`
    );
  }, [justCreated]);

  const onNowPlayingVisibleInQueueChange = useCallback((visible: boolean) => {
    setNowPlayingVisibleInQueueScroll(visible);
  }, []);

  useEffect(() => {
    setGuestShowSyncedVideo(readGuestShowSyncedVideoPref());
  }, []);

  useEffect(() => {
    guestListOpenRef.current = guestListOpen;
  }, [guestListOpen]);

  const setGuestVideoPref = useCallback((show: boolean) => {
    setGuestShowSyncedVideo(show);
    try {
      window.sessionStorage.setItem(GUEST_VIDEO_PREF_KEY, show ? "1" : "0");
    } catch {
      /* private mode */
    }
  }, []);

  const leaveToHome = useCallback(() => {
    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        await clearPartySession(supabase);
      } catch {
        /* still navigate */
      }
      router.push("/");
    })();
  }, [router]);

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

  const loadRoomPresence = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { user: presenceUser },
    } = await supabase.auth.getUser();
    const myId = presenceUser?.id ?? null;
    const localDisplayName = getQueueAttributionLabel();

    const { data, error } = await supabase
      .from("room_members")
      .select("user_id, role, display_name, last_seen_at, joined_at")
      .eq("room_id", roomId)
      .order("joined_at", { ascending: true });
    if (error) {
      console.error(error);
      return;
    }
    const rows = (data ?? []) as Array<{
      user_id: string;
      role: string;
      display_name: string | null;
      last_seen_at: string;
      joined_at: string;
    }>;
    const guests = rows.filter((r) => r.role === "guest");
    setGuestCount(guests.length);
    setGuestRoster(
      guests.map((g) => {
        const fromDb = g.display_name?.trim() ?? "";
        const useLocal =
          !fromDb && myId != null && g.user_id === myId && localDisplayName;
        return {
          userId: g.user_id,
          label: fromDb || (useLocal ? localDisplayName : "") || "Anonymous",
          lastSeenAt: g.last_seen_at,
        };
      })
    );
  }, [roomId]);

  const dismissJoinToast = useCallback(() => setJoinToastMessage(null), []);

  const dismissActivityToast = useCallback(
    () => setActivityToastMessage(null),
    []
  );

  const notifyRoomActivity = useCallback(async (message: string) => {
    if (!shouldBroadcastActivity()) return;
    const ch = roomChannelRef.current;
    if (!ch) return;
    try {
      await ch.send({
        type: "broadcast",
        event: "room_activity",
        payload: { text: message, senderUserId: currentUserIdRef.current },
      });
    } catch (e) {
      console.error("supabase broadcast room_activity:", e);
    }
  }, []);

  useLayoutEffect(() => {
    if (ready && hasCompletedDisplayProfile()) {
      setProfileGateDone(true);
    }
  }, [ready]);

  const refreshPlaybackState = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("rooms")
      .select(
        "playback_paused, playback_current_item_id, playback_anchor_sec, playback_anchor_at"
      )
      .eq("id", roomId)
      .maybeSingle();
    if (error) {
      console.error(error);
      return;
    }
    if (data) {
      setPlaybackPaused(!!data.playback_paused);
      setPlaybackCurrentItemId(data.playback_current_item_id ?? null);
      setPlaybackAnchorSec(Number(data.playback_anchor_sec ?? 0));
      const at = data.playback_anchor_at as string | null;
      setPlaybackAnchorAt(
        at && !Number.isNaN(Date.parse(at))
          ? at
          : new Date().toISOString()
      );
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
    const joinKey = `${roomId}|${hostToken ?? ""}`;
    const prevJoinKey = prevJoinKeyRef.current;
    const joinTargetChanged =
      prevJoinKey !== "" && prevJoinKey !== joinKey;
    prevJoinKeyRef.current = joinKey;

    if (joinTargetChanged) {
      setReady(false);
      setBootError(null);
      setProfileGateDone(false);
    }

    let cancelled = false;
    let channel: RealtimeChannel | null = null;

    const sortQueue = (items: QueueItem[]) => {
      return [...items].sort((a, b) => {
        const ta = Date.parse(String(a.created_at ?? ""));
        const tb = Date.parse(String(b.created_at ?? ""));
        if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb) return ta - tb;
        return String(a.id).localeCompare(String(b.id));
      });
    };

    const applyQueueChange = (payload: PostgresChangePayload<QueueItem>) => {
      if (payload.eventType === "INSERT") {
        const row = payload.new;
        if (!row?.id) return;
        setQueue((prev) => {
          if (prev.some((q) => q.id === row.id)) return prev;
          return sortQueue([...prev, row as QueueItem]);
        });
        return;
      }

      if (payload.eventType === "UPDATE") {
        const row = payload.new;
        if (!row?.id) return;
        setQueue((prev) => {
          const idx = prev.findIndex((q) => q.id === row.id);
          if (idx === -1) return prev;
          const next = [...prev];
          next[idx] = row as QueueItem;
          return sortQueue(next);
        });
        return;
      }

      if (payload.eventType === "DELETE") {
        const id = payload.old?.id;
        if (!id) return;
        setQueue((prev) => prev.filter((q) => q.id !== id));
        // Current item might have been removed (or pointer auto-updated) — refresh rooms row.
        void refreshPlaybackState();
      }
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

      if (shouldResetPartySessionForRoom(roomId)) {
        await clearPartySession(supabase);
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

      setStoredPartyRoomId(roomId);

      const host = await checkHostRole();
      if (!cancelled) setIsHost(host);

      const {
        data: { user: joinedUser },
      } = await supabase.auth.getUser();
      const uid = joinedUser?.id ?? null;
      currentUserIdRef.current = uid;
      if (!cancelled) setSessionUserId(uid);

      await loadQueue();
      await refreshPlaybackState();
      await loadRoomPresence();

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
          (payload) =>
            applyQueueChange(payload as unknown as PostgresChangePayload<QueueItem>)
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
        .on(
          "broadcast",
          { event: "room_activity" },
          (payload: unknown) => {
            const p = (payload as { payload?: unknown } | null | undefined)
              ?.payload as { text?: unknown; senderUserId?: unknown } | undefined;
            if (typeof p?.text !== "string" || p.text.length === 0) return;
            if (
              typeof p.senderUserId === "string" &&
              p.senderUserId.length > 0 &&
              p.senderUserId === currentUserIdRef.current
            ) {
              return;
            }
            setActivityToastMessage(p.text);
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "room_members",
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            // Heartbeats only UPDATE last_seen_at — refetching on every tick would spam the room.
            if (payload.eventType === "INSERT") {
              const row = payload.new as {
                user_id?: string;
                role?: string;
                display_name?: string | null;
                last_seen_at?: string;
              };
              if (row.role !== "guest" || !row.user_id) return;

              const joinedUserId = row.user_id;
              const isMe = joinedUserId === currentUserIdRef.current;

              setGuestCount((c) => c + 1);
              setGuestRoster((prev) => {
                if (prev.some((g) => g.userId === joinedUserId)) return prev;
                const label = (row.display_name?.trim() ?? "") || "Anonymous";
                return [
                  ...prev,
                  {
                    userId: joinedUserId,
                    label,
                    lastSeenAt:
                      (row.last_seen_at as string | undefined) ??
                      new Date().toISOString(),
                  },
                ];
              });

              if (!isMe) setJoinToastMessage("A guest joined the room");
              if (guestListOpenRef.current) void loadRoomPresence();
              return;
            }

            if (payload.eventType === "DELETE") {
              const row = payload.old as { user_id?: string; role?: string };
              if (row.role !== "guest" || !row.user_id) return;
              const leftUserId = row.user_id;
              setGuestCount((c) => Math.max(0, c - 1));
              setGuestRoster((prev) => prev.filter((g) => g.userId !== leftUserId));
              if (guestListOpenRef.current) void loadRoomPresence();
            }
          }
        )
        .subscribe((status) => {
          if (!cancelled && status === "SUBSCRIBED") {
            roomChannelRef.current = channel;
          }
        });

      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
      roomChannelRef.current = null;
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
    loadRoomPresence,
    checkHostRole,
    refreshPlaybackState,
  ]);

  /** Push display name to `room_members` right after the name gate (don’t wait for heartbeat). */
  useEffect(() => {
    if (!ready || !profileGateDone) return;
    let cancelled = false;
    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.rpc("touch_room_presence", {
          p_room_id: roomId,
          p_display_name: getQueueAttributionLabel() ?? "",
        });
        if (error) {
          console.error(
            "touch_room_presence (sync):",
            error.message,
            "— apply migration 016_room_members_display_name if this persists."
          );
          return;
        }
        if (!cancelled) await loadRoomPresence();
      } catch (e) {
        console.error(e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, profileGateDone, roomId, loadRoomPresence]);

  useEffect(() => {
    if (!ready || !profileGateDone) return;
    const supabase = getSupabaseBrowserClient();
    const touch = () => {
      void supabase
        .rpc("touch_room_presence", {
          p_room_id: roomId,
          p_display_name: getQueueAttributionLabel() ?? "",
        })
        .then(({ error }) => {
          if (error) console.error("touch_room_presence:", error.message);
        });
    };
    touch();
    const interval = window.setInterval(touch, ROOM_PRESENCE_HEARTBEAT_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") touch();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [ready, profileGateDone, roomId]);

  useEffect(() => {
    if (!ready || !guestListOpen) return;
    void loadRoomPresence();
  }, [guestListOpen, ready, loadRoomPresence]);

  useEffect(() => {
    if (!ready || !isHost) return;
    const supabase = getSupabaseBrowserClient();
    const prune = async () => {
      const { error } = await supabase.rpc("prune_stale_room_guests", {
        p_room_id: roomId,
        p_host_token: hostToken ?? "",
        p_inactive_minutes: STALE_GUEST_MINUTES,
      });
      if (error) console.error(error);
      await loadRoomPresence();
    };
    void prune();
    const interval = window.setInterval(() => void prune(), HOST_PRUNE_STALE_GUESTS_MS);
    return () => window.clearInterval(interval);
  }, [ready, roomId, isHost, hostToken, loadRoomPresence]);

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
    if (advanceInFlightRef.current) return;
    advanceInFlightRef.current = true;
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("advance_queue", {
        p_room_id: roomId,
        p_host_token: hostTokenForRpc,
      });
      if (error) console.error(error);
      await refreshPlaybackState();
    } finally {
      advanceInFlightRef.current = false;
    }
  }, [roomId, hostTokenForRpc, refreshPlaybackState]);

  const goPrevious = useCallback(async () => {
    setControlsBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("playback_previous", {
        p_room_id: roomId,
        p_host_token: hostTokenForRpc,
      });
      if (error) console.error(error);
      else {
        const label = getQueueAttributionLabel();
        if (label) {
          void notifyRoomActivity(`${label} went to the previous track`);
        }
      }
      await refreshPlaybackState();
    } finally {
      setControlsBusy(false);
    }
  }, [roomId, hostTokenForRpc, notifyRoomActivity, refreshPlaybackState]);

  const goNext = useCallback(async () => {
    setControlsBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("advance_queue", {
        p_room_id: roomId,
        p_host_token: hostTokenForRpc,
      });
      if (error) console.error(error);
      else {
        const label = getQueueAttributionLabel();
        if (label) {
          void notifyRoomActivity(`${label} skipped to the next track`);
        }
      }
      await refreshPlaybackState();
    } finally {
      setControlsBusy(false);
    }
  }, [roomId, hostTokenForRpc, notifyRoomActivity, refreshPlaybackState]);

  const setPaused = useCallback(
    async (paused: boolean) => {
      setControlsBusy(true);
      try {
        const fromPlayer = syncPlayerRef.current?.getCurrentTime();
        const fromClock = effectivePlaybackSec(
          playbackAnchorSec,
          playbackAnchorAt,
          playbackPaused
        );
        const anchor =
          fromPlayer != null && Number.isFinite(fromPlayer)
            ? fromPlayer
            : fromClock;
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.rpc("playback_set_paused", {
          p_room_id: roomId,
          p_paused: paused,
          p_anchor_sec: anchor,
        });
        if (error) console.error(error);
        await refreshPlaybackState();
      } finally {
        setControlsBusy(false);
      }
    },
    [
      roomId,
      refreshPlaybackState,
      playbackAnchorSec,
      playbackAnchorAt,
      playbackPaused,
    ]
  );

  const seekBy = useCallback(
    async (deltaSec: number) => {
      setControlsBusy(true);
      try {
        const fromPlayer = syncPlayerRef.current?.getCurrentTime();
        const fromClock = effectivePlaybackSec(
          playbackAnchorSec,
          playbackAnchorAt,
          playbackPaused
        );
        const base =
          fromPlayer != null && Number.isFinite(fromPlayer)
            ? fromPlayer
            : fromClock;
        const next = Math.max(0, base + deltaSec);
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.rpc("playback_seek", {
          p_room_id: roomId,
          p_seconds: next,
          p_host_token: hostTokenForRpc,
        });
        if (error) console.error(error);
        await refreshPlaybackState();
      } finally {
        setControlsBusy(false);
      }
    },
    [
      roomId,
      hostTokenForRpc,
      refreshPlaybackState,
      playbackAnchorSec,
      playbackAnchorAt,
      playbackPaused,
    ]
  );

  const reportIframeSeek = useCallback(
    async (seconds: number) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("playback_seek", {
        p_room_id: roomId,
        p_seconds: Math.max(0, seconds),
        p_host_token: hostTokenForRpc,
      });
      if (error) console.error(error);
      await refreshPlaybackState();
    },
    [roomId, hostTokenForRpc, refreshPlaybackState]
  );

  const reportIframePausePlay = useCallback(
    async (paused: boolean, anchorSeconds: number) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("playback_set_paused", {
        p_room_id: roomId,
        p_paused: paused,
        p_anchor_sec: Math.max(0, anchorSeconds),
      });
      if (error) console.error(error);
      await refreshPlaybackState();
    },
    [roomId, refreshPlaybackState]
  );

  useEffect(() => {
    if (!ready || !isHost) return;
    if (!nowPlaying?.video_id || playbackPaused) return;
    let supabase: ReturnType<typeof getSupabaseBrowserClient>;
    try {
      supabase = getSupabaseBrowserClient();
    } catch {
      return;
    }
    const id = window.setInterval(() => {
      const t = syncPlayerRef.current?.getCurrentTime?.();
      if (t == null || !Number.isFinite(t)) return;
      void supabase.rpc("playback_host_beat", {
        p_room_id: roomId,
        p_seconds: t,
      });
    }, 2500);
    return () => window.clearInterval(id);
  }, [ready, isHost, nowPlaying?.video_id, playbackPaused, roomId]);

  const handleAdd = useCallback(
    async (item: YouTubeSearchItem): Promise<boolean> => {
      const supabase = getSupabaseBrowserClient();
      const label = getQueueAttributionLabel();
      const { data, error } = await supabase
        .from("queue_items")
        .insert({
          room_id: roomId,
          video_id: item.videoId,
          title: item.title,
          thumb_url: item.thumbUrl || null,
          added_by: label,
        })
        .select("*")
        .single();
      if (error) {
        console.error(error);
        return false;
      } else {
        if (data?.id) {
          setQueue((prev) => {
            if (prev.some((q) => q.id === data.id)) return prev;
            return [...prev, data as QueueItem].sort((a, b) => {
              const ta = Date.parse(String(a.created_at ?? ""));
              const tb = Date.parse(String(b.created_at ?? ""));
              if (!Number.isNaN(ta) && !Number.isNaN(tb) && ta !== tb)
                return ta - tb;
              return String(a.id).localeCompare(String(b.id));
            });
          });
        }
        if (label) {
          void notifyRoomActivity(
            `${label} added “${shortTrackTitle(item.title)}”`
          );
        }
        void refreshPlaybackState();
        return true;
      }
    },
    [roomId, notifyRoomActivity, refreshPlaybackState]
  );

  const handleRemove = useCallback(
    async (itemId: string) => {
      const removed = queue.find((q) => q.id === itemId);
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.rpc("remove_queue_item", {
        p_item_id: itemId,
        p_host_token: hostTokenForRpc,
      });
      if (error) console.error(error);
      else {
        setQueue((prev) => prev.filter((q) => q.id !== itemId));
        const label = getQueueAttributionLabel();
        if (label) {
          void notifyRoomActivity(
            removed
              ? `${label} removed “${shortTrackTitle(removed.title)}”`
              : `${label} removed a track from the queue`
          );
        }
      }
      void refreshPlaybackState();
    },
    [hostTokenForRpc, notifyRoomActivity, queue, refreshPlaybackState]
  );

  const handlePlayQueueItem = useCallback(
    async (itemId: string) => {
      if (itemId === nowPlayingId) return;
      const target = queue.find((q) => q.id === itemId);
      setQueueJumpBusy(true);
      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.rpc("jump_to_queue_item", {
          p_item_id: itemId,
          p_host_token: hostTokenForRpc,
        });
        if (error) console.error(error);
        else {
          const label = getQueueAttributionLabel();
          if (label) {
            void notifyRoomActivity(
              target
                ? `${label} jumped to “${shortTrackTitle(target.title)}”`
                : `${label} changed the track`
            );
          }
        }
        void refreshPlaybackState();
      } finally {
        setQueueJumpBusy(false);
      }
    },
    [
      hostTokenForRpc,
      notifyRoomActivity,
      nowPlayingId,
      queue,
      refreshPlaybackState,
    ]
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
      setQueue([]);
      const label = getQueueAttributionLabel();
      if (label) {
        void notifyRoomActivity(`${label} cleared the queue`);
      }
      void refreshPlaybackState();
      setClearConfirmOpen(false);
    } finally {
      setClearQueueBusy(false);
    }
  }, [roomId, hostTokenForRpc, notifyRoomActivity, refreshPlaybackState]);

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
        <button type="button" onClick={leaveToHome} className={linkClass}>
          Back home
        </button>
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
        <button type="button" onClick={leaveToHome} className={linkClass}>
          Back home
        </button>
      </main>
    );
  }

  if (!ready) {
    return (
      <main
        className={`${shellMainClass} min-h-[100dvh] items-center justify-center`}
      >
        <JoinRoomLoader creating={justCreated} />
      </main>
    );
  }

  if (!profileGateDone) {
    return (
      <main
        className={`${shellMainScrollClass} flex min-h-[100dvh] flex-col items-center justify-center px-4 py-10`}
      >
        <RoomDisplayNameDialog
          open
          isHost={isHost}
          onComplete={() => setProfileGateDone(true)}
        />
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
    onSeekDelta: (d: number) => void seekBy(d),
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
              </div>
            )}
          </div>
          <div className={headerToolbarClass}>
            {ready ? (
              <button
                type="button"
                onClick={() => setGuestListOpen(true)}
                className="text-muted-foreground border-border/60 hover:bg-muted/50 focus-visible:ring-ring max-w-[4.75rem] shrink-0 truncate border-r px-1.5 text-center text-[0.6rem] font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:max-w-none sm:px-3 sm:text-xs"
                title={`${guestCount} guest${guestCount === 1 ? "" : "s"} — tap to see who is here`}
              >
                {guestCount}&nbsp;{guestCount === 1 ? "guest" : "guests"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={openGuestInvite}
              className={headerToolbarBtnClass}
              title={
                isHost
                  ? "QR code and guest link (no host controls)"
                  : "QR code and link to invite more guests"
              }
            >
              Invite
            </button>
            <button
              type="button"
              onClick={leaveToHome}
              className={headerToolbarBtnClass}
            >
              Home
            </button>
          </div>
        </div>
      </header>

      <RoomGuestJoinToast
        message={joinToastMessage}
        onDismiss={dismissJoinToast}
      />
      <RoomGuestJoinToast
        message={activityToastMessage}
        onDismiss={dismissActivityToast}
        variant="stacked"
      />

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

          {isHost ? (
            <section className="flex flex-col gap-2" aria-label="Playback">
              <YouTubeSyncPlayer
                ref={syncPlayerRef}
                videoId={nowPlaying?.video_id ?? null}
                remotePaused={playbackPaused}
                anchorSec={playbackAnchorSec}
                anchorAtIso={playbackAnchorAt}
                isHost
                onHostVideoEnded={advanceToNextTrack}
                onPlaybackScrub={reportIframeSeek}
                onIframePausePlay={reportIframePausePlay}
              />
              <p className="text-muted-foreground px-1 text-center text-[0.7rem] leading-snug sm:text-xs">
                Playback runs on this device. Everyone sees the same video in sync;
                keep this tab open for the party.
              </p>
            </section>
          ) : hasNowPlaying ? (
            <section
              className="flex flex-col gap-2"
              aria-labelledby="guest-playback-heading"
            >
              <h2 id="guest-playback-heading" className="sr-only">
                {guestShowSyncedVideo
                  ? "Synced video on this device"
                  : "Now playing"}
              </h2>
              {guestShowSyncedVideo ? (
                <>
                  <YouTubeSyncPlayer
                    videoId={nowPlaying.video_id}
                    remotePaused={playbackPaused}
                    anchorSec={playbackAnchorSec}
                    anchorAtIso={playbackAnchorAt}
                    isHost={false}
                    onHostVideoEnded={() => { }}
                    onPlaybackScrub={reportIframeSeek}
                    onIframePausePlay={reportIframePausePlay}
                  />
                  <p className="text-muted-foreground px-1 text-center text-[0.7rem] leading-snug sm:text-xs">
                    Same video as the host, kept in sync. Prefer the host’s
                    speaker for audio; preview is muted by default.
                  </p>
                  <button
                    type="button"
                    onClick={() => setGuestVideoPref(false)}
                    className="text-muted-foreground hover:text-foreground focus-visible:ring-ring mx-auto min-h-10 rounded-lg px-3 py-2 text-center text-xs font-semibold underline underline-offset-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-sm"
                  >
                    Hide video on this device
                  </button>
                </>
              ) : (
                <div className="border-border bg-card/70 flex flex-col gap-2.5 rounded-2xl border px-4 py-3.5">
                  <p className="text-foreground text-sm font-semibold">
                    Now playing
                  </p>
                  <p className="text-foreground line-clamp-2 text-base font-medium leading-snug">
                    {nowPlaying.title}
                  </p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    Watching here is optional. Use the queue controls below to
                    skip or seek for everyone, or turn on video if you want the
                    synced picture on this phone (uses more data and battery).
                  </p>
                  <button
                    type="button"
                    onClick={() => setGuestVideoPref(true)}
                    className="bg-primary text-primary-foreground focus-visible:ring-ring hover:brightness-105 active:brightness-95 mt-1 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition-[filter] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    Show synced video on this device
                  </button>
                </div>
              )}
            </section>
          ) : null}

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
                  queueAttributionLabel={getQueueAttributionLabel()}
                  onQueueActivity={(msg) => void notifyRoomActivity(msg)}
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
          ) : null}
          <GuestInviteDialog
            open={inviteOpen}
            onOpenChange={setInviteOpen}
            url={guestInviteUrl}
          />
          <GuestListDialog
            open={guestListOpen}
            onOpenChange={setGuestListOpen}
            guests={guestRoster}
            currentUserId={sessionUserId}
            onRefresh={() => void loadRoomPresence()}
          />
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
