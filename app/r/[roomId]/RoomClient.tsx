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
  getDisplayAvatarDataUrl,
  getQueueAttributionLabel,
  hasCompletedDisplayProfile,
  shouldBroadcastActivity,
} from "@/lib/displayName";
import type { QueueItem, YouTubeSearchItem } from "@/lib/types";
import {
  YouTubeSyncPlayer,
  type YouTubeSyncPlayerHandle,
} from "@/components/YouTubeHostPlayer";
import { SearchYouTube } from "@/components/SearchYouTube";
import { HostYoutubePlaylists } from "@/components/HostYoutubePlaylists";
import {
  RoomChatPanel,
  type ChatMessage as ChatPanelMessage,
  type ChatPerson,
} from "@/components/RoomChatPanel";
import { RoomChatOverlay } from "@/components/RoomChatOverlay";
import { QuickReactionRail } from "@/components/QuickReactionRail";
import { RoomStage } from "@/components/RoomStage";
import { GuestInviteDialog } from "@/components/GuestInviteDialog";
import { AppBrandLockup } from "@/components/AppBrandLockup";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { JoinRoomLoader } from "@/components/JoinRoomLoader";
import { RoomGuestJoinToast } from "@/components/RoomGuestJoinToast";
import { RoomDisplayNameDialog } from "@/components/RoomDisplayNameDialog";
import {
  GuestListDialog,
  type GuestListEntry,
} from "@/components/GuestListDialog";
import { RoomProfileSettingsDialog } from "@/components/RoomProfileSettingsDialog";
import { RoomSettingsDialog } from "@/components/RoomSettingsDialog";
import { AvatarLightbox } from "@/components/AvatarLightbox";
import {
  clearPartyRoomState,
  GUEST_VIDEO_PREF_KEY,
  readGuestShowSyncedVideoPref,
  setStoredPartyRoomId,
  setStoredHostRoom,
  shouldResetPartySessionForRoom,
} from "@/lib/party-session";
import { useRoomVisualViewport } from "@/hooks/useRoomVisualViewport";

type Props = {
  roomId: string;
  hostToken: string | null;
  /** From `?new=1` after “Start a room” — loader says “Creating” instead of “Joining”. */
  justCreated?: boolean;
};

const linkClass =
  "text-accent focus-visible:ring-ring inline-flex min-h-11 items-center rounded-lg text-sm font-semibold underline underline-offset-4 transition-colors hover:brightness-110 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const headerToolbarClass =
  "border-border/70 bg-card/45 flex shrink-0 items-center gap-0.5 self-center rounded-2xl border p-0.5 shadow-sm backdrop-blur-sm";

const headerToolbarBtnClass =
  "text-foreground hover:bg-muted/80 focus-visible:ring-ring inline-flex min-h-9 shrink-0 items-center justify-center rounded-[0.65rem] px-3.5 py-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-10 sm:px-4 sm:text-sm";

function TabIcon({ name, active }: { name: "now" | "queue" | "search" | "playlists" | "chat"; active: boolean }) {
  const cls = active ? "size-[1.05rem]" : "size-[1.2rem] text-muted-foreground";
  if (name === "now") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls} aria-hidden>
        <path d="M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z" />
      </svg>
    );
  }
  if (name === "queue") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls} aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (name === "search") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls} aria-hidden>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
    );
  }
  if (name === "chat") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls} aria-hidden>
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={cls} aria-hidden>
      <path d="M9 18V5l10-2v13" />
      <circle cx="7" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </svg>
  );
}

const PANEL_TABS = [
  { key: "now", label: "Now Playing", icon: "now" },
  { key: "search", label: "Search", icon: "search" },
  { key: "chat", label: "Chat", icon: "chat" },
  { key: "playlists", label: "Playlists", icon: "playlists" },
] as const;

function VisibilityPill({
  isPublic,
  canEdit,
  onClick,
}: {
  isPublic: boolean;
  canEdit: boolean;
  onClick?: () => void;
}) {
  const label = isPublic ? "Public" : "Private";
  const tone = isPublic
    ? "bg-accent/15 text-accent border-accent/25"
    : "border-border bg-muted/45 text-muted-foreground";
  const cls = `${tone} inline-flex shrink-0 items-center justify-center rounded-full border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase leading-none tracking-wider`;
  if (canEdit) {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Change room visibility"
        aria-label={`Room is ${label}. Tap to change.`}
        className={`${cls} hover:brightness-110 focus-visible:ring-ring transition-[filter] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
      >
        {label}
      </button>
    );
  }
  return <span className={cls}>{label}</span>;
}

/** Throttled server touch so closed tabs go stale and host can prune. */
const ROOM_PRESENCE_HEARTBEAT_MS = 45_000;
/** Host-only cleanup interval (must exceed heartbeat + network slack). */
const HOST_PRUNE_STALE_GUESTS_MS = 90_000;
/** Guests with no heartbeat for this long are removed by prune (host client or cron). */
const STALE_GUEST_MINUTES = 3;
const UPCOMING_QUEUE_INITIAL_RENDER = 60;
const UPCOMING_QUEUE_BATCH_RENDER = 40;

type PostgresChangePayload<T> = {
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Partial<T>;
  old: Partial<T>;
};

type RoomReaction = {
  id: string;
  emoji: string;
  leftPct: number;
};

type RoomChatMessage = {
  id: string;
  senderUserId: string | null;
  senderLabel: string;
  text: string;
  createdAt: string;
  avatarDataUrl: string | null;
  mentions?: string[];
  gif?: string | null;
  pinnedToSec?: number | null;
  reactions?: Record<string, { userIds: string[] }>;
  pending?: boolean;
};

type ReadyCheckState = {
  id: string;
  targetItemId: string;
  targetTitle: string;
  requiredCount: number;
  initiatorId: string;
  readyUserIds: string[];
};

type AmbientTheme = {
  base: string;
  glow: string;
};

function shortTrackTitle(title: string, max = 36): string {
  const t = title.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function formatIsoDate(iso?: string | null): string {
  if (!iso) return "";
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function hashHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 360;
}

function deriveFallbackAmbient(seed: string): AmbientTheme {
  const hue = hashHue(seed || "vibin");
  return {
    base: `hsl(${hue} 30% 8%)`,
    glow: `hsla(${hue} 85% 62% / 0.22)`,
  };
}

function deriveAmbientFromImageData(pixels: Uint8ClampedArray, seed: string): AmbientTheme {
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (let i = 0; i < pixels.length; i += 16) {
    const r = pixels[i];
    const g = pixels[i + 1];
    const b = pixels[i + 2];
    const a = pixels[i + 3];
    if (a < 140) continue;
    sumR += r;
    sumG += g;
    sumB += b;
    count += 1;
  }

  if (count === 0) return deriveFallbackAmbient(seed);

  const avgR = Math.round(sumR / count);
  const avgG = Math.round(sumG / count);
  const avgB = Math.round(sumB / count);

  const max = Math.max(avgR, avgG, avgB);
  const min = Math.min(avgR, avgG, avgB);
  const chroma = max - min;
  const sat = Math.min(88, Math.max(46, Math.round((chroma / Math.max(1, max)) * 100)));
  const hue = chroma === 0 ? hashHue(seed) : Math.round(
    max === avgR
      ? ((avgG - avgB) / chroma) * 60 + (avgG < avgB ? 360 : 0)
      : max === avgG
        ? ((avgB - avgR) / chroma) * 60 + 120
        : ((avgR - avgG) / chroma) * 60 + 240
  );

  return {
    base: `hsl(${hue} 30% 8%)`,
    glow: `hsla(${hue} ${sat}% 62% / 0.24)`,
  };
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
  const [queueJumpBusy, setQueueJumpBusy] = useState(false);
  const [clearQueueBusy, setClearQueueBusy] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  /** Guests only: load/sync YouTube on this device when true (opt-in). */
  const [guestShowSyncedVideo, setGuestShowSyncedVideo] = useState(false);
  const [guestCount, setGuestCount] = useState(0);
  const [guestRoster, setGuestRoster] = useState<GuestListEntry[]>([]);
  const [guestListOpen, setGuestListOpen] = useState(false);
  const [kickGuestBusyId, setKickGuestBusyId] = useState<string | null>(null);
  const [removedFromRoomToast, setRemovedFromRoomToast] = useState<
    string | null
  >(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [joinToastMessage, setJoinToastMessage] = useState<string | null>(
    null
  );
  const [activityToastMessage, setActivityToastMessage] = useState<
    string | null
  >(null);
  const [syncToastMessage, setSyncToastMessage] = useState<string | null>(null);
  const [reactions, setReactions] = useState<RoomReaction[]>([]);
  const [profileGateDone, setProfileGateDone] = useState(false);
  const [forceResyncToken, setForceResyncToken] = useState(0);
  const [readyCheck, setReadyCheck] = useState<ReadyCheckState | null>(null);
  const [activePanel, setActivePanel] = useState<"now" | "search" | "playlists">("now");
  const [chatOverlayOpen, setChatOverlayOpen] = useState(false);
  const [chatHeadOffset, setChatHeadOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const chatHeadDraggedRef = useRef(false);
  const chatHeadBtnRef = useRef<HTMLButtonElement | null>(null);
  const [hasOpenedSearch, setHasOpenedSearch] = useState(false);
  const [hasOpenedPlaylists, setHasOpenedPlaylists] = useState(false);
  const [playlistsRefreshToken, setPlaylistsRefreshToken] = useState(0);
  const [upcomingRenderCount, setUpcomingRenderCount] = useState(
    UPCOMING_QUEUE_INITIAL_RENDER
  );
  const [videoPublishedAtById, setVideoPublishedAtById] = useState<
    Record<string, string>
  >({});
  const [chatMessages, setChatMessages] = useState<RoomChatMessage[]>([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [videoTimeSec, setVideoTimeSec] = useState(0);
  const [videoDurationSec, setVideoDurationSec] = useState<number | null>(null);
  const [typingByUserId, setTypingByUserId] = useState<
    Record<string, { label: string; expiresAt: number }>
  >({});
  const [chatToastMessage, setChatToastMessage] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [roomSettingsOpen, setRoomSettingsOpen] = useState(false);
  const [roomTitle, setRoomTitle] = useState<string | null>(null);
  const [roomIsPublic, setRoomIsPublic] = useState(false);
  const [enlargedAvatar, setEnlargedAvatar] = useState<{
    src: string;
    label: string;
  } | null>(null);
  const [profilePhotoDataUrl, setProfilePhotoDataUrl] = useState<string | null>(
    null
  );
  const [localDisplayLabel, setLocalDisplayLabel] = useState<string>("Anonymous");
  const [ambientTheme, setAmbientTheme] = useState<AmbientTheme>(() =>
    deriveFallbackAmbient(roomId)
  );

  const roomChannelRef = useRef<RealtimeChannel | null>(null);
  const currentUserIdRef = useRef<string | null>(null);
  const videoSectionRef = useRef<HTMLElement | null>(null);
  const videoFrameRef = useRef<HTMLDivElement | null>(null);
  const advanceInFlightRef = useRef(false);
  const syncPlayerRef = useRef<YouTubeSyncPlayerHandle | null>(null);
  const prevJoinKeyRef = useRef<string>("");
  const guestListOpenRef = useRef(false);
  const reactionSeqRef = useRef(0);
  const readyCheckHandledRef = useRef<string | null>(null);
  const playbackReconcileTimerRef = useRef<number | null>(null);
  const activePanelRef = useRef<"now" | "search" | "playlists">("now");
  const chatOverlayOpenRef = useRef(false);
  const typingBroadcastTimerRef = useRef<number | null>(null);
  const typingLastSentAtRef = useRef(0);

  const router = useRouter();
  const hostTokenForRpc = hostToken ?? "";

  const { keyboardOpen } = useRoomVisualViewport();

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


  useEffect(() => {
    setGuestShowSyncedVideo(readGuestShowSyncedVideoPref());
  }, []);

  useEffect(() => {
    guestListOpenRef.current = guestListOpen;
  }, [guestListOpen]);

  useEffect(() => {
    activePanelRef.current = activePanel;
  }, [activePanel]);

  useEffect(() => {
    chatOverlayOpenRef.current = chatOverlayOpen;
  }, [chatOverlayOpen]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem("vibin.chatHeadOffset");
        if (!stored) return;
        const parsed = JSON.parse(stored) as unknown;
        if (
          parsed &&
          typeof parsed === "object" &&
          typeof (parsed as { x?: unknown }).x === "number" &&
          typeof (parsed as { y?: unknown }).y === "number"
        ) {
          setChatHeadOffset({
            x: (parsed as { x: number }).x,
            y: (parsed as { y: number }).y,
          });
        }
      } catch {
        /* ignore */
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--vibin-chat-offset-x", `${chatHeadOffset.x}px`);
    root.style.setProperty("--vibin-chat-offset-y", `${chatHeadOffset.y}px`);
  }, [chatHeadOffset]);

  useEffect(() => {
    setProfilePhotoDataUrl(getDisplayAvatarDataUrl());
    setLocalDisplayLabel(getQueueAttributionLabel() ?? "Anonymous");
  }, []);

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
        clearPartyRoomState();
      } catch {
        /* still navigate */
      }
      router.push("/");
    })();
  }, [router]);

  const leaveToHomeRef = useRef(leaveToHome);
  useEffect(() => {
    leaveToHomeRef.current = leaveToHome;
  }, [leaveToHome]);

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

  const loadRoomPresence = useCallback(async (knownUserId?: string | null) => {
    const supabase = getSupabaseBrowserClient();
    let myId: string | null;
    if (knownUserId !== undefined) {
      myId = knownUserId;
    } else {
      const {
        data: { user: presenceUser },
      } = await supabase.auth.getUser();
      myId = presenceUser?.id ?? null;
    }
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

  const handleKickGuest = useCallback(
    async (guestUserId: string) => {
      if (!guestUserId) return;
      setKickGuestBusyId(guestUserId);
      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.rpc("host_kick_guest", {
          p_room_id: roomId,
          p_guest_user_id: guestUserId,
          p_host_token: hostTokenForRpc,
        });
        if (error) {
          console.error(error);
          return;
        }
        await loadRoomPresence();
      } finally {
        setKickGuestBusyId(null);
      }
    },
    [roomId, hostTokenForRpc, loadRoomPresence]
  );

  const handleProfileSaved = useCallback(() => {
    setProfilePhotoDataUrl(getDisplayAvatarDataUrl());
    setLocalDisplayLabel(getQueueAttributionLabel() ?? "Anonymous");
    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.rpc("touch_room_presence", {
          p_room_id: roomId,
          p_display_name: getQueueAttributionLabel() ?? "",
        });
        if (error) console.error("touch_room_presence (profile):", error.message);
      } catch (e) {
        console.error(e);
      } finally {
        await loadRoomPresence();
      }
    })();
  }, [roomId, loadRoomPresence]);

  const dismissJoinToast = useCallback(() => setJoinToastMessage(null), []);

  const dismissRemovedFromRoomToast = useCallback(
    () => setRemovedFromRoomToast(null),
    []
  );

  const dismissActivityToast = useCallback(
    () => setActivityToastMessage(null),
    []
  );
  const dismissSyncToast = useCallback(() => setSyncToastMessage(null), []);
  const dismissChatToast = useCallback(() => setChatToastMessage(null), []);

  const handleAutoResyncNotice = useCallback(() => {
    setSyncToastMessage("Jumped to stay in sync");
  }, []);

  const sendChatMessage = useCallback(
    async (payload: {
      text: string;
      mentions: string[];
      gif: string | null;
      pinnedToSec: number | null;
    }) => {
      const text = payload.text.trim();
      if (!text && !payload.gif) return;
      const senderLabel = localDisplayLabel.trim() || "Anonymous";
      const senderUserId = currentUserIdRef.current ?? null;
      const createdAt = new Date().toISOString();
      const avatarDataUrl = profilePhotoDataUrl ?? null;
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const localMsg: RoomChatMessage = {
        id: messageId,
        senderUserId,
        senderLabel,
        text,
        createdAt,
        avatarDataUrl,
        mentions: payload.mentions,
        gif: payload.gif ?? null,
        pinnedToSec: payload.pinnedToSec,
        reactions: {},
      };
      setChatMessages((prev) => [...prev, localMsg]);
      const ch = roomChannelRef.current;
      if (!ch) return;
      try {
        await ch.send({
          type: "broadcast",
          event: "room_chat_message",
          payload: {
            messageId,
            text,
            senderUserId,
            senderLabel,
            createdAt,
            avatarDataUrl,
            mentions: payload.mentions,
            gif: payload.gif ?? null,
            pinnedToSec: payload.pinnedToSec,
          },
        });
      } catch (e) {
        console.error("supabase broadcast room_chat_message:", e);
      }
    },
    [localDisplayLabel, profilePhotoDataUrl]
  );

  const toggleMessageReaction = useCallback(
    async (messageId: string, emoji: string) => {
      const senderUserId = currentUserIdRef.current ?? null;
      if (!senderUserId) return;
      let nextMine = false;
      setChatMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== messageId) return msg;
          const reactions: Record<string, { userIds: string[] }> = {
            ...(msg.reactions ?? {}),
          };
          const current = reactions[emoji]?.userIds ?? [];
          const has = current.includes(senderUserId);
          nextMine = !has;
          const nextIds = has
            ? current.filter((id) => id !== senderUserId)
            : [...current, senderUserId];
          if (nextIds.length === 0) {
            delete reactions[emoji];
          } else {
            reactions[emoji] = { userIds: nextIds };
          }
          return { ...msg, reactions };
        })
      );
      const ch = roomChannelRef.current;
      if (!ch) return;
      try {
        await ch.send({
          type: "broadcast",
          event: "room_chat_reaction",
          payload: {
            messageId,
            emoji,
            senderUserId,
            on: nextMine,
          },
        });
      } catch (e) {
        console.error("supabase broadcast room_chat_reaction:", e);
      }
    },
    []
  );

  const broadcastTyping = useCallback(
    (isTyping: boolean) => {
      const ch = roomChannelRef.current;
      if (!ch) return;
      const now = Date.now();
      if (isTyping && now - typingLastSentAtRef.current < 1200) return;
      typingLastSentAtRef.current = now;
      void ch.send({
        type: "broadcast",
        event: "room_typing",
        payload: {
          senderUserId: currentUserIdRef.current,
          senderLabel: localDisplayLabel.trim() || "Anonymous",
          isTyping,
        },
      });
    },
    [localDisplayLabel]
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

  const getParticipantId = useCallback(() => {
    const uid = currentUserIdRef.current ?? sessionUserId;
    if (uid) return uid;
    if (typeof window === "undefined") return "local-anon";
    try {
      const key = "vibin_ready_check_local_id";
      const existing = window.sessionStorage.getItem(key);
      if (existing) return existing;
      const created = `anon-${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(key, created);
      return created;
    } catch {
      return "local-anon";
    }
  }, [sessionUserId]);

  const broadcastReadyCheckEvent = useCallback(
    async (event: string, payload: Record<string, unknown>) => {
      const ch = roomChannelRef.current;
      if (!ch) return;
      try {
        await ch.send({
          type: "broadcast",
          event,
          payload,
        });
      } catch (e) {
        console.error(`supabase broadcast ${event}:`, e);
      }
    },
    []
  );

  const spawnReaction = useCallback((emoji: string) => {
    const id = `${Date.now()}-${reactionSeqRef.current++}`;
    const leftPct = 14 + Math.random() * 72;
    setReactions((prev) => [...prev, { id, emoji, leftPct }]);
    window.setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 2100);
  }, []);

  const sendReaction = useCallback(async (emoji: string) => {
    spawnReaction(emoji);
    const ch = roomChannelRef.current;
    if (!ch) return;
    try {
      await ch.send({
        type: "broadcast",
        event: "room_reaction",
        payload: { emoji, senderUserId: currentUserIdRef.current },
      });
    } catch (e) {
      console.error("supabase broadcast room_reaction:", e);
    }
  }, [spawnReaction]);

  useLayoutEffect(() => {
    if (ready && hasCompletedDisplayProfile()) {
      setProfileGateDone(true);
    }
  }, [ready]);

  useEffect(() => {
    if (!profileGateDone) return;
    setLocalDisplayLabel(getQueueAttributionLabel() ?? "Anonymous");
  }, [profileGateDone]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prevTitle = document.title;
    const nextTitle =
      reactions.length > 0
        ? `${reactions[0]?.emoji ?? "😂"} ${reactions.length} reaction${reactions.length === 1 ? "" : "s"}`
        : playbackPaused
          ? "⏸️ Paused"
          : "▶️ Playing";
    document.title = nextTitle;
    return () => {
      document.title = prevTitle;
    };
  }, [playbackPaused, reactions]);

  const refreshPlaybackState = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from("rooms")
      .select(
        "playback_paused, playback_current_item_id, playback_anchor_sec, playback_anchor_at, title, is_public"
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
      const t = data.title as string | null | undefined;
      setRoomTitle(typeof t === "string" && t.trim().length > 0 ? t : null);
      setRoomIsPublic(!!data.is_public);
    }
  }, [roomId]);

  const schedulePlaybackReconcile = useCallback(
    (delayMs = 420) => {
      if (playbackReconcileTimerRef.current != null) {
        window.clearTimeout(playbackReconcileTimerRef.current);
      }
      playbackReconcileTimerRef.current = window.setTimeout(() => {
        playbackReconcileTimerRef.current = null;
        void refreshPlaybackState();
      }, delayMs);
    },
    [refreshPlaybackState]
  );

  useEffect(() => {
    return () => {
      if (playbackReconcileTimerRef.current != null) {
        window.clearTimeout(playbackReconcileTimerRef.current);
      }
    };
  }, []);

  const forceRoomResync = useCallback(async () => {
    await Promise.all([loadQueue(), refreshPlaybackState()]);
    setForceResyncToken((n) => n + 1);
  }, [loadQueue, refreshPlaybackState]);

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
        clearPartyRoomState();
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
      if (hostToken) setStoredHostRoom(roomId, hostToken);

      const {
        data: { user: joinedUser },
      } = await supabase.auth.getUser();
      const uid = joinedUser?.id ?? null;
      currentUserIdRef.current = uid;
      if (!cancelled) setSessionUserId(uid);

      const hostRolePromise =
        uid != null
          ? supabase
            .from("room_members")
            .select("role")
            .eq("room_id", roomId)
            .eq("user_id", uid)
            .maybeSingle()
            .then(({ data, error }) => {
              if (error) console.error(error);
              return data?.role === "host";
            })
          : Promise.resolve(false);

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
        .on("broadcast", { event: "room_reaction" }, (payload: unknown) => {
          const p = (payload as { payload?: unknown } | null | undefined)
            ?.payload as { emoji?: unknown; senderUserId?: unknown } | undefined;
          if (typeof p?.emoji !== "string" || p.emoji.length === 0) return;
          if (
            typeof p.senderUserId === "string" &&
            p.senderUserId.length > 0 &&
            p.senderUserId === currentUserIdRef.current
          ) {
            return;
          }
          spawnReaction(p.emoji);
        })
        .on("broadcast", { event: "room_chat_message" }, (payload: unknown) => {
          const p = (payload as { payload?: unknown } | null | undefined)
            ?.payload as {
              messageId?: unknown;
              text?: unknown;
              senderUserId?: unknown;
              senderLabel?: unknown;
              createdAt?: unknown;
              avatarDataUrl?: unknown;
              mentions?: unknown;
              gif?: unknown;
              pinnedToSec?: unknown;
            } | undefined;
          const rawText = typeof p?.text === "string" ? p.text.trim() : "";
          const gif =
            typeof p?.gif === "string" && p.gif.length > 0 ? p.gif : null;
          if (rawText.length === 0 && !gif) return;
          const senderUserId =
            typeof p?.senderUserId === "string" ? p.senderUserId : null;
          if (senderUserId && senderUserId === currentUserIdRef.current) return;
          const senderLabel =
            typeof p?.senderLabel === "string" && p.senderLabel.trim().length > 0
              ? p.senderLabel.trim()
              : "Anonymous";
          const createdAt =
            typeof p?.createdAt === "string" &&
              !Number.isNaN(Date.parse(p.createdAt))
              ? p.createdAt
              : new Date().toISOString();
          const avatarDataUrl =
            typeof p?.avatarDataUrl === "string" &&
              p.avatarDataUrl.startsWith("data:image/")
              ? p.avatarDataUrl
              : null;
          const mentions = Array.isArray(p?.mentions)
            ? (p.mentions.filter(
                (v) => typeof v === "string"
              ) as string[])
            : [];
          const pinnedToSec =
            typeof p?.pinnedToSec === "number" && Number.isFinite(p.pinnedToSec)
              ? p.pinnedToSec
              : null;
          const id =
            typeof p?.messageId === "string" && p.messageId.length > 0
              ? p.messageId
              : `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === id)) return prev;
            return [
              ...prev,
              {
                id,
                senderUserId,
                senderLabel,
                text: rawText,
                createdAt,
                avatarDataUrl,
                mentions,
                gif,
                pinnedToSec,
                reactions: {},
              },
            ];
          });
          if (!chatOverlayOpenRef.current) {
            setUnreadChatCount((n) => n + 1);
          }
          setChatToastMessage(
            rawText.length > 0 ? `${senderLabel}: ${rawText}` : `${senderLabel} sent a GIF`
          );
        })
        .on("broadcast", { event: "room_chat_reaction" }, (payload: unknown) => {
          const p = (payload as { payload?: unknown } | null | undefined)
            ?.payload as {
              messageId?: unknown;
              emoji?: unknown;
              senderUserId?: unknown;
              on?: unknown;
            } | undefined;
          if (
            typeof p?.messageId !== "string" ||
            typeof p.emoji !== "string" ||
            typeof p.senderUserId !== "string"
          ) {
            return;
          }
          if (p.senderUserId === currentUserIdRef.current) return;
          const on = p.on !== false;
          setChatMessages((prev) =>
            prev.map((msg) => {
              if (msg.id !== p.messageId) return msg;
              const reactions: Record<string, { userIds: string[] }> = {
                ...(msg.reactions ?? {}),
              };
              const current = reactions[p.emoji as string]?.userIds ?? [];
              const has = current.includes(p.senderUserId as string);
              const nextIds = on
                ? has
                  ? current
                  : [...current, p.senderUserId as string]
                : current.filter((id) => id !== (p.senderUserId as string));
              if (nextIds.length === 0) {
                delete reactions[p.emoji as string];
              } else {
                reactions[p.emoji as string] = { userIds: nextIds };
              }
              return { ...msg, reactions };
            })
          );
        })
        .on("broadcast", { event: "room_typing" }, (payload: unknown) => {
          const p = (payload as { payload?: unknown } | null | undefined)
            ?.payload as {
              senderUserId?: unknown;
              senderLabel?: unknown;
              isTyping?: unknown;
            } | undefined;
          const senderUserId =
            typeof p?.senderUserId === "string" ? p.senderUserId : null;
          if (!senderUserId) return;
          if (senderUserId === currentUserIdRef.current) return;
          const senderLabel =
            typeof p?.senderLabel === "string" && p.senderLabel.trim().length > 0
              ? p.senderLabel.trim()
              : "Someone";
          if (p?.isTyping === false) {
            setTypingByUserId((prev) => {
              if (!prev[senderUserId]) return prev;
              const next = { ...prev };
              delete next[senderUserId];
              return next;
            });
            return;
          }
          setTypingByUserId((prev) => ({
            ...prev,
            [senderUserId]: {
              label: senderLabel,
              expiresAt: Date.now() + 4000,
            },
          }));
        })
        .on(
          "broadcast",
          { event: "room_ready_check_start" },
          (payload: unknown) => {
            const p = (payload as { payload?: unknown } | null | undefined)
              ?.payload as Partial<ReadyCheckState> | undefined;
            if (
              !p ||
              typeof p.id !== "string" ||
              typeof p.targetItemId !== "string" ||
              typeof p.targetTitle !== "string" ||
              typeof p.requiredCount !== "number" ||
              typeof p.initiatorId !== "string"
            ) {
              return;
            }
            setReadyCheck({
              id: p.id,
              targetItemId: p.targetItemId,
              targetTitle: p.targetTitle,
              requiredCount: Math.max(1, Math.floor(p.requiredCount)),
              initiatorId: p.initiatorId,
              readyUserIds: Array.isArray(p.readyUserIds)
                ? p.readyUserIds.filter((v): v is string => typeof v === "string")
                : [],
            });
            readyCheckHandledRef.current = null;
          }
        )
        .on(
          "broadcast",
          { event: "room_ready_check_ready" },
          (payload: unknown) => {
            const p = (payload as { payload?: unknown } | null | undefined)
              ?.payload as { checkId?: unknown; userId?: unknown } | undefined;
            if (
              typeof p?.checkId !== "string" ||
              typeof p?.userId !== "string"
            ) {
              return;
            }
            const readyUserId = p.userId;
            setReadyCheck((cur) => {
              if (!cur || cur.id !== p.checkId) return cur;
              if (cur.readyUserIds.includes(readyUserId)) return cur;
              return { ...cur, readyUserIds: [...cur.readyUserIds, readyUserId] };
            });
          }
        )
        .on(
          "broadcast",
          { event: "room_ready_check_done" },
          (payload: unknown) => {
            const p = (payload as { payload?: unknown } | null | undefined)
              ?.payload as { checkId?: unknown } | undefined;
            if (typeof p?.checkId !== "string") return;
            setReadyCheck((cur) => (cur?.id === p.checkId ? null : cur));
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
              if (leftUserId === currentUserIdRef.current) {
                setRemovedFromRoomToast("The host removed you from this room.");
                window.setTimeout(() => {
                  leaveToHomeRef.current?.();
                }, 2400);
                return;
              }
              setGuestCount((c) => Math.max(0, c - 1));
              setGuestRoster((prev) => prev.filter((g) => g.userId !== leftUserId));
              if (guestListOpenRef.current) void loadRoomPresence();
            }
          }
        )
        .subscribe((status) => {
          if (!cancelled && status === "SUBSCRIBED") {
            roomChannelRef.current = channel;
            void forceRoomResync();
          }
        });

      const [, , isHostResult] = await Promise.all([
        loadQueue(),
        refreshPlaybackState(),
        hostRolePromise,
      ]);
      if (!cancelled) setIsHost(!!isHostResult);

      if (!cancelled) {
        void loadRoomPresence(uid);
        setReady(true);
      }
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
    refreshPlaybackState,
    spawnReaction,
    forceRoomResync,
  ]);

  useEffect(() => {
    if (!ready) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        void forceRoomResync();
      }
    };
    const onOnline = () => {
      void forceRoomResync();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, [ready, forceRoomResync]);

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
  const upcomingQueue = useMemo(() => {
    if (currentQueueIndex < 0) return [];
    return queue.slice(currentQueueIndex + 1);
  }, [queue, currentQueueIndex]);
  const visibleUpcomingQueue = useMemo(
    () => upcomingQueue.slice(0, upcomingRenderCount),
    [upcomingQueue, upcomingRenderCount]
  );

  const canPrev = currentQueueIndex > 0;

  const applyOptimisticPlayback = useCallback(
    (next: { paused: boolean; anchorSec: number; currentItemId?: string | null }) => {
      if (typeof next.currentItemId !== "undefined") {
        setPlaybackCurrentItemId(next.currentItemId);
      }
      setPlaybackPaused(next.paused);
      setPlaybackAnchorSec(Math.max(0, next.anchorSec));
      setPlaybackAnchorAt(new Date().toISOString());
    },
    []
  );

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
    const prevItem = currentQueueIndex > 0 ? queue[currentQueueIndex - 1] : null;
    if (prevItem) {
      applyOptimisticPlayback({
        paused: false,
        anchorSec: 0,
        currentItemId: prevItem.id,
      });
    }
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
      schedulePlaybackReconcile();
    } catch (e) {
      console.error(e);
      schedulePlaybackReconcile(0);
    }
  }, [
    roomId,
    hostTokenForRpc,
    notifyRoomActivity,
    queue,
    currentQueueIndex,
    applyOptimisticPlayback,
    schedulePlaybackReconcile,
  ]);

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

  const jumpToSec = useCallback(
    async (sec: number) => {
      if (!isHost) return;
      await reportIframeSeek(Math.max(0, sec));
    },
    [isHost, reportIframeSeek]
  );

  const togglePlayPause = useCallback(async () => {
    if (!isHost) return;
    const now = syncPlayerRef.current?.getCurrentTime?.() ?? playbackAnchorSec;
    await reportIframePausePlay(!playbackPaused, now ?? 0);
  }, [isHost, playbackPaused, playbackAnchorSec, reportIframePausePlay]);

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

  useEffect(() => {
    if (!ready || !nowPlaying?.video_id) {
      setVideoTimeSec(0);
      setVideoDurationSec(null);
      return;
    }
    const id = window.setInterval(() => {
      const t = syncPlayerRef.current?.getCurrentTime?.();
      const d = syncPlayerRef.current?.getDuration?.();
      if (typeof t === "number" && Number.isFinite(t)) setVideoTimeSec(t);
      if (typeof d === "number" && Number.isFinite(d) && d > 0) {
        setVideoDurationSec(d);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [ready, nowPlaying?.video_id]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setTypingByUserId((prev) => {
        const now = Date.now();
        let changed = false;
        const next: typeof prev = {};
        for (const [uid, v] of Object.entries(prev)) {
          if (v.expiresAt > now) next[uid] = v;
          else changed = true;
        }
        return changed ? next : prev;
      });
    }, 1500);
    return () => {
      window.clearInterval(id);
      if (typingBroadcastTimerRef.current != null) {
        window.clearTimeout(typingBroadcastTimerRef.current);
        typingBroadcastTimerRef.current = null;
      }
    };
  }, []);

  const handleAdd = useCallback(
    async (item: YouTubeSearchItem): Promise<boolean> => {
      const supabase = getSupabaseBrowserClient();
      const label = localDisplayLabel.trim() || "Anonymous";
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
    [roomId, localDisplayLabel, notifyRoomActivity, refreshPlaybackState]
  );

  const handlePlayQueueItem = useCallback(
    async (itemId: string) => {
      if (itemId === nowPlayingId || queueJumpBusy) return;
      const target = queue.find((q) => q.id === itemId);
      if (!target) return;
      setQueueJumpBusy(true);
      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.rpc("jump_to_queue_item", {
          p_item_id: target.id,
          p_host_token: hostTokenForRpc,
        });
        if (error) {
          console.error(error);
          return;
        }
        const { error: playError } = await supabase.rpc("playback_set_paused", {
          p_room_id: roomId,
          p_paused: false,
          p_anchor_sec: 0,
        });
        if (playError) console.error(playError);
        const label = getQueueAttributionLabel();
        if (label) {
          void notifyRoomActivity(`${label} started “${shortTrackTitle(target.title)}”`);
        }
        await refreshPlaybackState();
      } finally {
        setQueueJumpBusy(false);
      }
    },
    [
      nowPlayingId,
      queueJumpBusy,
      queue,
      hostTokenForRpc,
      roomId,
      notifyRoomActivity,
      refreshPlaybackState,
    ]
  );

  const goNext = useCallback(async () => {
    if (queueJumpBusy) return;
    const nextItem = queue[currentQueueIndex + 1];
    if (!nextItem) return;
    await handlePlayQueueItem(nextItem.id);
  }, [
    queueJumpBusy,
    queue,
    currentQueueIndex,
    handlePlayQueueItem,
  ]);

  const tapReadyCheck = useCallback(async () => {
    const current = readyCheck;
    if (!current) return;
    const participantId = getParticipantId();
    if (current.readyUserIds.includes(participantId)) return;
    const next = {
      ...current,
      readyUserIds: [...current.readyUserIds, participantId],
    };
    setReadyCheck(next);
    await broadcastReadyCheckEvent("room_ready_check_ready", {
      checkId: current.id,
      userId: participantId,
    });
  }, [readyCheck, getParticipantId, broadcastReadyCheckEvent]);

  const cancelReadyCheck = useCallback(async () => {
    if (!readyCheck) return;
    const checkId = readyCheck.id;
    setReadyCheck(null);
    readyCheckHandledRef.current = checkId;
    await broadcastReadyCheckEvent("room_ready_check_done", { checkId });
  }, [readyCheck, broadcastReadyCheckEvent]);

  useEffect(() => {
    if (!readyCheck) return;
    const myId = getParticipantId();
    if (readyCheck.initiatorId !== myId) return;
    if (readyCheck.readyUserIds.length < readyCheck.requiredCount) return;
    if (readyCheckHandledRef.current === readyCheck.id) return;
    readyCheckHandledRef.current = readyCheck.id;

    void (async () => {
      setQueueJumpBusy(true);
      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.rpc("jump_to_queue_item", {
          p_item_id: readyCheck.targetItemId,
          p_host_token: hostTokenForRpc,
        });
        if (error) {
          console.error(error);
          return;
        }
        const { error: playError } = await supabase.rpc("playback_set_paused", {
          p_room_id: roomId,
          p_paused: false,
          p_anchor_sec: 0,
        });
        if (playError) console.error(playError);
        const label = getQueueAttributionLabel();
        if (label) {
          void notifyRoomActivity(
            `${label} started “${shortTrackTitle(readyCheck.targetTitle)}” after ready check`
          );
        }
        await refreshPlaybackState();
      } finally {
        setQueueJumpBusy(false);
        setReadyCheck(null);
        await broadcastReadyCheckEvent("room_ready_check_done", {
          checkId: readyCheck.id,
        });
      }
    })();
  }, [
    readyCheck,
    getParticipantId,
    hostTokenForRpc,
    roomId,
    notifyRoomActivity,
    refreshPlaybackState,
    broadcastReadyCheckEvent,
  ]);

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

  const removeQueueItem = useCallback(
    async (item: QueueItem) => {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.from("queue_items").delete().eq("id", item.id);
      if (error) {
        console.error(error);
        return;
      }
      setQueue((prev) => prev.filter((q) => q.id !== item.id));
      const label = getQueueAttributionLabel();
      if (label) {
        void notifyRoomActivity(`${label} removed “${shortTrackTitle(item.title)}”`);
      }
      void refreshPlaybackState();
    },
    [notifyRoomActivity, refreshPlaybackState]
  );

  const openGuestInvite = useCallback(() => {
    if (typeof window !== "undefined") {
      setGuestInviteUrl(
        (u) => u || `${window.location.origin}/r/${roomId}`
      );
    }
    setInviteOpen(true);
  }, [roomId]);

  useEffect(() => {
    const videoId = nowPlaying?.video_id ?? "";
    if (!videoId) {
      setAmbientTheme(deriveFallbackAmbient(roomId));
      return;
    }

    const thumb = nowPlaying?.thumb_url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    let cancelled = false;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";

    image.onload = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 28;
        canvas.height = 28;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("2d context unavailable");
        ctx.drawImage(image, 0, 0, 28, 28);
        const data = ctx.getImageData(0, 0, 28, 28).data;
        setAmbientTheme(deriveAmbientFromImageData(data, videoId));
      } catch {
        setAmbientTheme(deriveFallbackAmbient(videoId));
      }
    };

    image.onerror = () => {
      if (!cancelled) setAmbientTheme(deriveFallbackAmbient(videoId));
    };
    image.src = thumb;

    return () => {
      cancelled = true;
    };
  }, [nowPlaying?.video_id, nowPlaying?.thumb_url, roomId]);

  useEffect(() => {
    if (activePanel === "search") {
      setHasOpenedSearch(true);
    }
  }, [activePanel]);

  useEffect(() => {
    if (activePanel === "playlists") {
      setHasOpenedPlaylists(true);
    }
  }, [activePanel]);

  useEffect(() => {
    if (chatOverlayOpen) {
      setUnreadChatCount(0);
    }
  }, [chatOverlayOpen, chatMessages.length]);

  useEffect(() => {
    setUpcomingRenderCount(UPCOMING_QUEUE_INITIAL_RENDER);
  }, [effectiveNowId, queue.length]);

  const handleUpcomingQueueScroll = useCallback(
    (e: React.UIEvent<HTMLUListElement>) => {
      if (visibleUpcomingQueue.length >= upcomingQueue.length) return;
      const node = e.currentTarget;
      const remaining = node.scrollHeight - node.scrollTop - node.clientHeight;
      if (remaining <= 180) {
        setUpcomingRenderCount((n) =>
          Math.min(n + UPCOMING_QUEUE_BATCH_RENDER, upcomingQueue.length)
        );
      }
    },
    [visibleUpcomingQueue.length, upcomingQueue.length]
  );

  useEffect(() => {
    const missingVideoIds = Array.from(
      new Set(
        upcomingQueue
          .map((item) => item.video_id)
          .filter((id) => id && !videoPublishedAtById[id])
      )
    ).slice(0, 25);
    if (missingVideoIds.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(
          `/api/youtube/videos-meta?ids=${encodeURIComponent(
            missingVideoIds.join(",")
          )}`
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          items?: Array<{ videoId?: string; publishedAt?: string }>;
        };
        if (cancelled) return;
        const mapped = Object.fromEntries(
          (data.items ?? [])
            .filter(
              (it): it is { videoId: string; publishedAt: string } =>
                typeof it.videoId === "string" &&
                it.videoId.length > 0 &&
                typeof it.publishedAt === "string" &&
                it.publishedAt.length > 0
            )
            .map((it) => [it.videoId, it.publishedAt])
        );
        if (Object.keys(mapped).length > 0) {
          setVideoPublishedAtById((prev) => ({ ...prev, ...mapped }));
        }
      } catch {
        /* keep queue usable even if metadata request fails */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [upcomingQueue, videoPublishedAtById]);

  const shellMainClass =
    "vibin-page-bg mx-auto flex w-full max-w-lg flex-col px-[clamp(1rem,4vw,1.5rem)] pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(1.25rem,env(safe-area-inset-bottom))] min-[708px]:max-w-5xl";

  /** Room shell: full-width main so sticky header bar can span the viewport; content is inset below.
   *  Pinned with `position: fixed` so iOS Safari cannot scroll the document up when the chat input
   *  is focused — the player stays put and only the inner panel area adapts to the visual viewport. */
  const shellMainScrollClass =
    "vibin-page-bg fixed inset-x-0 top-0 flex min-h-0 h-[var(--vibin-vv-h,100dvh)] flex-col overflow-hidden";

  if (configError) {
    return (
      <main className={`${shellMainClass} gap-5`}>
        <AppBrandLockup />
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
        <AppBrandLockup />
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
        className={`${shellMainScrollClass} items-center justify-center`}
      >
        {/* Full-width shell like the ready room — `shellMainClass` max-w-lg looked like a centered “box” on wide viewports */}
        {/* Room row exists before this screen; `justCreated` only strips ?new=1 — avoid a second "Creating" pass */}
        <JoinRoomLoader creating={false} />
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

  const playbackBusy = queueJumpBusy;
  const peopleWatchingCount = Math.max(1, guestCount + 1);
  const localParticipantId = getParticipantId();

  const chatPeople: ChatPerson[] = (() => {
    const list: ChatPerson[] = [];
    const selfId = currentUserIdRef.current ?? sessionUserId ?? "self";
    list.push({
      id: selfId,
      name: localDisplayLabel || "You",
      letter: (localDisplayLabel || "?").trim().charAt(0).toUpperCase() || "?",
      avatarDataUrl: profilePhotoDataUrl,
      isHost,
      online: true,
    });
    for (const g of guestRoster) {
      if (g.userId === selfId) continue;
      list.push({
        id: g.userId,
        name: g.label,
        letter: (g.label || "?").trim().charAt(0).toUpperCase() || "?",
        online: Date.now() - Date.parse(g.lastSeenAt) < 75_000,
      });
    }
    return list;
  })();

  const chatPanelMessages: ChatPanelMessage[] = chatMessages.map((m) => ({
    id: m.id,
    authorId: m.senderUserId,
    authorLabel: m.senderLabel,
    text: m.text,
    createdAtIso: m.createdAt,
    avatarDataUrl: m.avatarDataUrl,
    mentions: m.mentions,
    gif: m.gif ?? null,
    pinnedToSec: m.pinnedToSec ?? null,
    reactions: m.reactions,
    pending: m.pending,
  }));

  const typingLabels = Object.values(typingByUserId)
    .filter((v) => v.expiresAt > Date.now())
    .map((v) => v.label);

  const handleTyping = (isTyping: boolean) => {
    broadcastTyping(isTyping);
  };

  const readyCount = readyCheck?.readyUserIds.length ?? 0;
  const readyTotal = readyCheck?.requiredCount ?? 0;
  const isReadyCheckInitiator =
    readyCheck != null && readyCheck.initiatorId === localParticipantId;
  const hasTappedReady =
    readyCheck != null && readyCheck.readyUserIds.includes(localParticipantId);
  return (
    <main
      className={shellMainScrollClass}
      style={{
        backgroundColor: ambientTheme.base,
        transition: "background-color 700ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    >
      <header className="border-border/50 sticky top-0 z-40 w-full shrink-0 border-b pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[min(100%,96rem)] items-center justify-between gap-3 px-[clamp(1rem,4vw,1.5rem)] sm:gap-4">
          <div className="flex min-w-0 flex-1 items-center pr-2">
            {isHost ? (
              <>
                <h1 className="sr-only">vibin.click — you are the host</h1>
                <AppBrandLockup
                  className="min-w-0"
                  hideTagline
                  subtitle={roomTitle}
                  titleRowSuffix={
                    <>
                      <span className="bg-primary/12 text-primary border-primary/20 inline-flex shrink-0 items-center justify-center rounded-full border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase leading-none tracking-wider">
                        Host
                      </span>
                      <VisibilityPill
                        isPublic={roomIsPublic}
                        canEdit
                        onClick={() => setRoomSettingsOpen(true)}
                      />
                    </>
                  }
                />
              </>
            ) : (
              <>
                <h1 className="sr-only">vibin.click — you are a guest</h1>
                <AppBrandLockup
                  className="min-w-0"
                  hideTagline
                  subtitle={roomTitle}
                  titleRowSuffix={
                    <>
                      <span className="border-border bg-muted/45 text-muted-foreground inline-flex shrink-0 items-center justify-center rounded-full border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase leading-none tracking-wider">
                        Guest
                      </span>
                      <VisibilityPill isPublic={roomIsPublic} canEdit={false} />
                    </>
                  }
                />
              </>
            )}
          </div>
          <div className={headerToolbarClass}>
            <button
              type="button"
              onClick={openGuestInvite}
              className="text-foreground hover:bg-muted/80 focus-visible:ring-ring inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-[0.65rem] px-2.5 py-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-10 sm:min-w-10"
              title={
                isHost
                  ? "QR code and guest link (no host controls)"
                  : "QR code and link to invite more guests"
              }
              aria-label="Invite guests"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4.5"
                aria-hidden
              >
                <circle cx="9" cy="8" r="4" />
                <path d="M2 21a7 7 0 0 1 14 0" />
                <path d="M19 8v6" />
                <path d="M22 11h-6" />
              </svg>
            </button>
            {isHost ? (
              <button
                type="button"
                onClick={() => setRoomSettingsOpen(true)}
                className="text-foreground hover:bg-muted/80 focus-visible:ring-ring inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-[0.65rem] px-2.5 py-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-10 sm:min-w-10"
                title="Room settings (title and visibility)"
                aria-label="Open room settings"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="size-4.5"
                  aria-hidden
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.7 1.7 0 0 0 .33 1.88l.03.03a2 2 0 0 1-2.83 2.83l-.03-.03a1.7 1.7 0 0 0-1.88-.33 1.7 1.7 0 0 0-1.02 1.56V21a2 2 0 0 1-4 0v-.04a1.7 1.7 0 0 0-1.02-1.56 1.7 1.7 0 0 0-1.88.33l-.03.03a2 2 0 1 1-2.83-2.83l.03-.03A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1.02H3a2 2 0 0 1 0-4h.04A1.7 1.7 0 0 0 4.6 8.96a1.7 1.7 0 0 0-.33-1.88l-.03-.03a2 2 0 0 1 2.83-2.83l.03.03a1.7 1.7 0 0 0 1.88.33H9a1.7 1.7 0 0 0 1-1.54V3a2 2 0 0 1 4 0v.04a1.7 1.7 0 0 0 1.02 1.56 1.7 1.7 0 0 0 1.88-.33l.03-.03a2 2 0 1 1 2.83 2.83l-.03.03a1.7 1.7 0 0 0-.33 1.88V9c0 .68.4 1.3 1.02 1.56H21a2 2 0 0 1 0 4h-.04A1.7 1.7 0 0 0 19.4 15Z" />
                </svg>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="text-foreground hover:bg-muted/80 focus-visible:ring-ring inline-flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-[0.65rem] px-2.5 py-2 transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-10 sm:min-w-10"
              title="Profile settings"
              aria-label="Open profile settings"
            >
              {profilePhotoDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profilePhotoDataUrl}
                  alt="Your profile"
                  className="size-6 rounded-full object-cover sm:size-7"
                />
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="size-4.5"
                  aria-hidden
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21a8 8 0 0 1 16 0" />
                </svg>
              )}
            </button>
            <button
              type="button"
              onClick={leaveToHome}
              className={headerToolbarBtnClass}
              aria-label="Exit room"
              title="Exit room"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="size-4.5"
                aria-hidden
              >
                <path d="M9 6H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
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
      <RoomGuestJoinToast
        message={syncToastMessage}
        onDismiss={dismissSyncToast}
        variant="stacked2"
      />
      <RoomGuestJoinToast
        message={chatToastMessage}
        onDismiss={dismissChatToast}
        variant="stacked3"
      />
      <RoomGuestJoinToast
        message={removedFromRoomToast}
        onDismiss={dismissRemovedFromRoomToast}
      />
      {reactions.length > 0 ? (
        <div className="pointer-events-none fixed inset-0 z-[72] overflow-hidden" aria-hidden>
          {reactions.map((reaction) => (
            <span
              key={reaction.id}
              className="vibin-reaction-float absolute bottom-[calc(max(7rem,calc(env(safe-area-inset-bottom)+5.75rem))+var(--vibin-keyboard-inset,0px))] text-3xl drop-shadow-[0_6px_10px_rgba(0,0,0,0.28)] sm:bottom-[calc(5.75rem+var(--vibin-keyboard-inset,0px))] min-[708px]:bottom-[calc(1.25rem+var(--vibin-keyboard-inset,0px))]"
              style={{ left: `${reaction.leftPct}%` }}
            >
              {reaction.emoji}
            </span>
          ))}
        </div>
      ) : null}
      <section
        ref={videoSectionRef}
        className={`relative flex min-h-0 flex-1 w-full flex-col overflow-hidden px-4 pt-3 sm:px-6 min-[708px]:pb-6 min-[708px]:px-6 xl:px-10 ${keyboardOpen ? "pb-2" : "pb-[max(6rem,calc(env(safe-area-inset-bottom)+4.8rem))]"}`}
        style={{
          backgroundImage: `radial-gradient(110% 75% at 50% 12%, ${ambientTheme.glow}, rgba(0,0,0,0) 55%)`,
          transition: "background-image 700ms cubic-bezier(0.22, 1, 0.36, 1)",
        }}
      >
        <div className="mx-auto flex min-h-0 w-full max-w-[min(100%,96rem)] flex-1 flex-col gap-3 min-[708px]:flex-row min-[708px]:items-stretch min-[708px]:gap-8">
          <div className="order-1 flex min-h-0 w-full shrink-0 flex-col items-center min-[708px]:order-2 min-[708px]:min-w-0 min-[708px]:flex-1 min-[708px]:items-stretch min-[708px]:pt-0.5">
            <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col items-center justify-start gap-3 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] min-[708px]:mt-0 min-[708px]:max-w-none">
              {isHost || guestShowSyncedVideo ? (
                <div
                  ref={videoFrameRef}
                  className="relative min-w-0 max-w-[100vw] self-stretch -mx-2 w-[calc(100%+1rem)] sm:mx-0 sm:w-full sm:max-w-none"
                >
                  <RoomStage
                    watchers={peopleWatchingCount}
                    progressSec={videoTimeSec}
                    durationSec={videoDurationSec}
                    nowPlayingTitle={nowPlaying?.title ?? null}
                    nowPlayingAddedBy={nowPlaying?.added_by ?? null}
                    isPlaying={!playbackPaused && hasNowPlaying}
                    canPrev={canPrev && !playbackBusy}
                    canNext={hasNowPlaying && !playbackBusy}
                    onPrev={() => void goPrevious()}
                    onNext={() => void goNext()}
                    onTogglePlay={() => void togglePlayPause()}
                    controlsDisabled={!isHost}
                  >
                    <YouTubeSyncPlayer
                      ref={syncPlayerRef}
                      className="rounded-none shadow-lg ring-0 sm:rounded-xl sm:shadow-md sm:ring-2"
                      videoId={nowPlaying?.video_id ?? null}
                      remotePaused={playbackPaused}
                      anchorSec={playbackAnchorSec}
                      anchorAtIso={playbackAnchorAt}
                      isHost={isHost}
                      onHostVideoEnded={advanceToNextTrack}
                      onPlaybackScrub={isHost ? reportIframeSeek : undefined}
                      onIframePausePlay={reportIframePausePlay}
                      onAutoResync={handleAutoResyncNotice}
                      forceResyncToken={forceResyncToken}
                    />
                  </RoomStage>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setGuestVideoPref(true)}
                  className="border-border bg-card/60 inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold"
                >
                  Show synced video
                </button>
              )}
            </div>
          </div>
          <div className="order-2 flex min-h-0 w-full min-w-0 flex-1 flex-col min-[708px]:order-1 min-[708px]:min-h-0 min-[708px]:w-[min(22rem,36vw)] min-[708px]:max-w-sm min-[708px]:shrink-0 min-[708px]:rounded-2xl min-[708px]:border min-[708px]:border-border/70 min-[708px]:bg-card/35 min-[708px]:p-3 xl:w-96 xl:max-w-md">
            <nav
              className="mb-3 hidden grid-cols-2 gap-1.5 min-[708px]:grid"
              aria-label="Room panels"
            >
              {PANEL_TABS.map((tab) => {
                const active = tab.key === "chat" ? chatOverlayOpen : activePanel === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      if (tab.key === "chat") {
                        setChatOverlayOpen((v) => !v);
                      } else {
                        setActivePanel(tab.key);
                      }
                    }}
                    className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] font-semibold transition-all duration-200 sm:min-h-10 sm:gap-2 sm:px-2.5 sm:text-xs ${active ? "bg-primary text-primary-foreground shadow-sm shadow-primary/30" : "text-muted-foreground hover:bg-muted/60"}`}
                    aria-pressed={active}
                    aria-label={tab.label}
                    title={tab.label}
                  >
                    <span className="relative inline-flex shrink-0">
                      <TabIcon name={tab.icon} active={active} />
                      {tab.key === "chat" && unreadChatCount > 0 ? (
                        <span className="bg-primary text-primary-foreground absolute -right-1.5 -top-1.5 inline-flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold leading-4">
                          {unreadChatCount > 99 ? "99+" : unreadChatCount}
                        </span>
                      ) : null}
                    </span>
                    <span className="min-w-0 truncate tracking-tight">{tab.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="flex min-h-0 flex-1 flex-col items-stretch gap-3 overflow-y-auto [-webkit-overflow-scrolling:touch] min-[708px]:min-h-[min(70vh,40rem)]">
              {activePanel === "now" ? (
                <section className="w-full max-w-2xl min-h-0 flex-1 rounded-xl border border-border/70 bg-card/60 px-2.5 py-2.5 sm:rounded-2xl sm:px-3 sm:py-3 min-[708px]:max-w-none">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-foreground text-sm font-semibold">Next in queue</p>
                    <div className="flex items-center gap-2">
                      {upcomingQueue.length > 0 ? (
                        <p className="text-muted-foreground text-xs">
                          {upcomingQueue.length} upcoming
                        </p>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => setGuestListOpen(true)}
                        className="hover:text-foreground focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-full px-1.5 py-0.5 text-xs text-muted-foreground transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        title={isHost ? "Guest list — remove people from the room" : "Who is in the room"}
                        aria-label={isHost ? "Open guest list" : "Who is watching"}
                      >
                        <span className="inline-block size-1.5 rounded-full bg-emerald-400" aria-hidden />
                        <span className="font-semibold">{peopleWatchingCount}</span>
                      </button>
                    </div>
                  </div>
                  {upcomingQueue.length > 0 ? (
                    <ul
                      className="mt-2 flex h-[calc(100%-1.75rem)] min-h-0 flex-col gap-2 overflow-y-auto pr-1"
                      onScroll={handleUpcomingQueueScroll}
                    >
                      {visibleUpcomingQueue.map((item, idx) => (
                        <li
                          key={item.id}
                          className="border-border/70 bg-background/55 rounded-xl border"
                        >
                          <div className="flex items-start gap-2.5 px-2.5 py-2">
                            <button
                              type="button"
                              onClick={() => void handlePlayQueueItem(item.id)}
                              className="hover:bg-muted/55 focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-3 rounded-xl px-0.5 py-0.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                              <span className="text-muted-foreground w-5 shrink-0 text-center text-xs font-semibold">
                                {idx + 1}
                              </span>
                              {item.thumb_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={item.thumb_url}
                                  alt={item.title}
                                  width={48}
                                  height={48}
                                  className="h-10 w-10 shrink-0 rounded-lg object-cover"
                                />
                              ) : (
                                <div className="bg-muted h-10 w-10 shrink-0 rounded-lg" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-foreground line-clamp-2 text-sm font-medium">
                                  {item.title}
                                </p>
                                <p className="text-muted-foreground mt-0.5 text-[11px]">
                                  {`Uploaded ${formatIsoDate(videoPublishedAtById[item.video_id]) || "Unknown"} • Added by ${item.added_by?.trim() || "Anonymous"}`}
                                </p>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => void removeQueueItem(item)}
                              className="text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:ring-ring inline-flex min-h-8 shrink-0 items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                              title="Remove from queue"
                            >
                              Remove
                            </button>
                          </div>
                        </li>
                      ))}
                      {visibleUpcomingQueue.length < upcomingQueue.length ? (
                        <li className="text-muted-foreground py-1 text-center text-xs">
                          Loading more queue items...
                        </li>
                      ) : null}
                    </ul>
                  ) : (
                    <div className="border-border/70 bg-background/40 mt-2 rounded-xl border px-3 py-3">
                      <p className="text-foreground text-sm font-medium">
                        No more videos in queue.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActivePanel("search")}
                        className="text-primary hover:text-primary/90 mt-1.5 text-sm font-semibold underline underline-offset-4"
                      >
                        Search and add more videos
                      </button>
                    </div>
                  )}
                </section>
              ) : null}
              <section
                className={`w-full max-w-2xl min-h-0 flex-1 min-[708px]:max-w-none ${activePanel === "search" ? "" : "hidden"
                  }`}
              >
                {hasOpenedSearch ? (
                  <SearchYouTube onAdd={handleAdd} queuedVideoIds={queuedVideoIds} />
                ) : null}
              </section>
              <section
                className={`w-full max-w-2xl min-h-0 flex-1 rounded-2xl border border-border/70 bg-card/60 px-3 pt-3 pb-0 min-[708px]:max-w-none ${activePanel === "playlists" ? "" : "hidden"
                  }`}
              >
                {hasOpenedPlaylists ? (
                  <Suspense
                    fallback={
                      <div className="flex h-full min-h-0 items-center justify-center">
                        <p className="text-muted-foreground text-sm">
                          Loading playlists…
                        </p>
                      </div>
                    }
                  >
                    <HostYoutubePlaylists
                      key={playlistsRefreshToken}
                      roomId={roomId}
                      queueAttributionLabel={localDisplayLabel}
                      onQueueActivity={(msg) => void notifyRoomActivity(msg)}
                      omitSectionChrome
                      queuedVideoIds={queuedVideoIds}
                      onRequestRefresh={() => setPlaylistsRefreshToken((n) => n + 1)}
                      onImported={() => {
                        void loadQueue();
                        void refreshPlaybackState();
                      }}
                    />
                  </Suspense>
                ) : null}
              </section>
            </div>
          </div>
        </div>
      </section>

      <div
        className={`pointer-events-none fixed inset-x-0 z-50 px-4 pb-[max(0.7rem,env(safe-area-inset-bottom))] pt-2.5 min-[708px]:hidden ${keyboardOpen ? "hidden" : ""}`}
        style={{ bottom: "var(--vibin-keyboard-inset, 0px)" }}
        aria-hidden={keyboardOpen}
      >
        <div className="pointer-events-auto mx-auto flex w-full max-w-md items-center justify-between rounded-2xl border border-border/75 bg-background/92 p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.35)] backdrop-blur-md">
          {PANEL_TABS.filter((t) => t.key !== "chat").map((tab) => {
            const active = activePanel === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActivePanel(tab.key)}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 transition-all duration-200 ${active ? "bg-primary text-primary-foreground font-semibold shadow-sm shadow-primary/30" : "text-muted-foreground hover:bg-muted/60"}`}
                aria-label={tab.label}
                title={tab.label}
              >
                <TabIcon name={tab.icon} active={active} />
                <span className="text-xs tracking-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!chatOverlayOpen && !keyboardOpen ? (
        <QuickReactionRail onReact={(emoji) => void sendReaction(emoji)} />
      ) : null}

      {!chatOverlayOpen && !keyboardOpen ? (
        <button
          ref={chatHeadBtnRef}
          type="button"
          onClick={() => {
            if (chatHeadDraggedRef.current) {
              chatHeadDraggedRef.current = false;
              return;
            }
            setChatOverlayOpen(true);
          }}
          onPointerDown={(e) => {
            if (e.pointerType === "mouse" && e.button !== 0) return;
            const startClientX = e.clientX;
            const startClientY = e.clientY;
            const start = { ...chatHeadOffset };
            let moved = false;
            const root = document.documentElement;
            const onMove = (ev: PointerEvent) => {
              const dx = ev.clientX - startClientX;
              const dy = ev.clientY - startClientY;
              if (!moved && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
                moved = true;
              }
              if (!moved) return;
              root.style.setProperty(
                "--vibin-chat-offset-x",
                `${start.x + dx}px`,
              );
              root.style.setProperty(
                "--vibin-chat-offset-y",
                `${start.y + dy}px`,
              );
            };
            const onUp = (ev: PointerEvent) => {
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", onUp);
              window.removeEventListener("pointercancel", onUp);
              if (!moved) return;
              chatHeadDraggedRef.current = true;
              const dx = ev.clientX - startClientX;
              const dy = ev.clientY - startClientY;
              let finalX = start.x + dx;
              let finalY = start.y + dy;
              const btn = chatHeadBtnRef.current;
              if (btn) {
                const rect = btn.getBoundingClientRect();
                const margin = 8;
                const railSpace = 64;
                if (rect.left < margin) finalX += margin - rect.left;
                if (rect.right > window.innerWidth - margin) {
                  finalX -= rect.right - (window.innerWidth - margin);
                }
                if (rect.top - railSpace < margin) {
                  finalY -= margin + railSpace - rect.top;
                }
                if (rect.bottom > window.innerHeight - margin) {
                  finalY -= rect.bottom - (window.innerHeight - margin);
                }
              }
              const next = { x: finalX, y: finalY };
              setChatHeadOffset(next);
              try {
                window.localStorage.setItem(
                  "vibin.chatHeadOffset",
                  JSON.stringify(next),
                );
              } catch {
                /* ignore */
              }
            };
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
            window.addEventListener("pointercancel", onUp);
          }}
          aria-label="Open chat"
          className="vibin-chat-head focus-visible:ring-ring focus-visible:ring-offset-background fixed z-[60] grid size-14 cursor-grab touch-none place-items-center rounded-full border-0 text-primary-foreground shadow-[0_14px_32px_-10px_rgba(0,0,0,0.55)] transition-transform hover:-translate-y-0.5 hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-offset-2 active:cursor-grabbing"
          style={{
            background:
              "linear-gradient(135deg, var(--primary), var(--accent))",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-6"
            aria-hidden
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {unreadChatCount > 0 ? (
            <span
              className="bg-destructive text-destructive-foreground absolute -right-1 -top-1 grid min-w-5 h-5 place-items-center rounded-full px-1 text-[11px] font-bold shadow-sm"
              style={{ border: "2px solid var(--bg-shell)" }}
            >
              {unreadChatCount > 99 ? "99+" : unreadChatCount}
            </span>
          ) : null}
        </button>
      ) : null}

      <RoomChatOverlay
        open={chatOverlayOpen}
        anchorRef={videoFrameRef}
        onDismiss={() => setChatOverlayOpen(false)}
      >
        <RoomChatPanel
          mobile
          people={chatPeople}
          messages={chatPanelMessages}
          currentUserId={currentUserIdRef.current ?? sessionUserId}
          currentUserLabel={localDisplayLabel}
          typingLabels={typingLabels}
          videoTime={videoTimeSec}
          presenceCount={peopleWatchingCount}
          onSend={(payload) => void sendChatMessage(payload)}
          onToggleReaction={(messageId, emoji) =>
            void toggleMessageReaction(messageId, emoji)
          }
          onJumpTo={isHost ? (sec) => void jumpToSec(sec) : undefined}
          onQuickReaction={(emoji) => void sendReaction(emoji)}
          onTyping={handleTyping}
          onClose={() => setChatOverlayOpen(false)}
          onOpenPresence={() => setGuestListOpen(true)}
        />
      </RoomChatOverlay>

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
        isHost={isHost}
        onKickGuest={handleKickGuest}
        kickBusyUserId={kickGuestBusyId}
      />
      <RoomProfileSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSaved={handleProfileSaved}
      />
      {enlargedAvatar ? (
        <AvatarLightbox
          src={enlargedAvatar.src}
          label={enlargedAvatar.label}
          onClose={() => setEnlargedAvatar(null)}
        />
      ) : null}
      {isHost && hostTokenForRpc ? (
        <RoomSettingsDialog
          open={roomSettingsOpen}
          onOpenChange={setRoomSettingsOpen}
          roomId={roomId}
          hostToken={hostTokenForRpc}
          initialTitle={roomTitle}
          initialIsPublic={roomIsPublic}
          onSaved={(next) => {
            setRoomTitle(next.title);
            setRoomIsPublic(next.isPublic);
          }}
        />
      ) : null}
      {readyCheck ? (
        <div className="border-primary/35 bg-card/95 fixed bottom-[max(0.85rem,calc(env(safe-area-inset-bottom)+0.5rem))] left-1/2 z-[65] w-[min(100vw-1rem,28rem)] -translate-x-1/2 rounded-2xl border px-3 py-3 shadow-xl shadow-black/20 backdrop-blur-md sm:bottom-4 sm:px-4">
          <p className="text-foreground text-sm font-semibold">
            Ready check: {shortTrackTitle(readyCheck.targetTitle, 34)}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {readyCount}/{readyTotal} ready
          </p>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void tapReadyCheck()}
              disabled={hasTappedReady}
              className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex min-h-10 flex-1 items-center justify-center rounded-xl px-3 text-sm font-bold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
            >
              {hasTappedReady ? "Ready ✓" : "Tap when ready"}
            </button>
            {isReadyCheckInitiator ? (
              <button
                type="button"
                onClick={() => void cancelReadyCheck()}
                className="border-border text-foreground focus-visible:ring-ring inline-flex min-h-10 items-center justify-center rounded-xl border px-3 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      <style jsx global>{`
        @keyframes vibin-reaction-float {
          0% {
            transform: translate3d(0, 0, 0) scale(0.82);
            opacity: 0;
          }
          12% {
            opacity: 1;
          }
          100% {
            transform: translate3d(0, -36vh, 0) scale(1.15) rotate(-5deg);
            opacity: 0;
          }
        }
        .vibin-reaction-float {
          animation: vibin-reaction-float 2.1s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          will-change: transform, opacity;
        }
        .vibin-chat-head {
          right: calc(max(1rem, env(safe-area-inset-right)) - var(--vibin-chat-offset-x, 0px));
          bottom: calc(var(--vibin-keyboard-inset, 0px) + max(5.75rem, calc(env(safe-area-inset-bottom) + 5.25rem)) - var(--vibin-chat-offset-y, 0px));
          animation: vibin-chat-head-pop 280ms cubic-bezier(0.22, 1.2, 0.36, 1);
        }
        .vibin-react-rail {
          right: calc(max(1rem, env(safe-area-inset-right)) - var(--vibin-chat-offset-x, 0px));
          bottom: calc(var(--vibin-keyboard-inset, 0px) + max(5.75rem, calc(env(safe-area-inset-bottom) + 5.25rem)) + 4rem - var(--vibin-chat-offset-y, 0px));
          animation: vibin-chat-head-pop 280ms cubic-bezier(0.22, 1.2, 0.36, 1);
        }
        @keyframes vibin-chat-head-pop {
          0% {
            transform: translateY(8px) scale(0.7);
            opacity: 0;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        @media (min-width: 708px) {
          .vibin-chat-head {
            bottom: calc(var(--vibin-keyboard-inset, 0px) + 1.25rem - var(--vibin-chat-offset-y, 0px));
          }
          .vibin-react-rail {
            bottom: calc(var(--vibin-keyboard-inset, 0px) + 1.25rem + 4rem - var(--vibin-chat-offset-y, 0px));
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .vibin-chat-head,
          .vibin-react-rail {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}
