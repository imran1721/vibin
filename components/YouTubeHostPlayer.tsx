"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { effectivePlaybackSec } from "@/lib/playback-sync";

export type YouTubeSyncPlayerHandle = {
  getCurrentTime: () => number | null;
};

type Props = {
  videoId: string | null;
  remotePaused: boolean;
  anchorSec: number;
  /** ISO timestamp from `rooms.playback_anchor_at`. */
  anchorAtIso: string;
  /** Only the host advances the queue when a video ends naturally. */
  isHost: boolean;
  onHostVideoEnded: () => void;
  /**
   * When someone uses the YouTube iframe timeline and drifts from the shared
   * clock, publish the new time (debounced). Same callback for host and guests.
   */
  onPlaybackScrub?: (seconds: number) => void;
  /**
   * Host or guest used the iframe play/pause control; sync room state + anchor time.
   */
  onIframePausePlay?: (paused: boolean, anchorSeconds: number) => void;
  /** Called when the client auto-seeks to realign with room playback. */
  onAutoResync?: () => void;
  /** Increment to force a hard seek to current room timeline. */
  forceResyncToken?: number;
};

let iframeApiPromise: Promise<void> | null = null;

function loadIframeApi(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (!iframeApiPromise) {
    iframeApiPromise = new Promise((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const first = document.getElementsByTagName("script")[0];
      first.parentNode?.insertBefore(tag, first);
    });
  }
  return iframeApiPromise;
}

const NATURAL_END_DEBOUNCE_MS = 900;
/** Apply remote timeline updates when anchor changes; skip tiny diffs (heartbeat noise). */
const REMOTE_SYNC_MIN_DIFF = 2.5;
/** In-iframe scrub vs shared timeline — playing (wall clock adds slack). */
const IFRAME_SCRUB_PLAYING = 3.5;
const IFRAME_SCRUB_PAUSED = 1.5;
const IFRAME_SCRUB_DEBOUNCE_MS = 320;
const GUEST_DRIFT_INTERVAL_MS = 900;
const GUEST_DRIFT_THRESHOLD = 2;
/** Ignore iframe pause/play callbacks right after we drive the player from DB. */
const SUPPRESS_IFRAME_PAUSE_MS = 280;
/** YouTube often ignores startSeconds until after cue; re-seek after load (guest opt-in, track change). */
const POST_LOAD_SYNC_MS = [380, 1100] as const;

export const YouTubeSyncPlayer = forwardRef<
  YouTubeSyncPlayerHandle,
  Props
>(function YouTubeSyncPlayer(
  {
    videoId,
    remotePaused,
    anchorSec,
    anchorAtIso,
    isHost,
    onHostVideoEnded,
    onPlaybackScrub,
    onIframePausePlay,
    onAutoResync,
    forceResyncToken = 0,
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const onEndedRef = useRef(onHostVideoEnded);
  const onPlaybackScrubRef = useRef(onPlaybackScrub);
  const onIframePausePlayRef = useRef(onIframePausePlay);
  const onAutoResyncRef = useRef(onAutoResync);
  const suppressProgrammaticPausePlayRef = useRef(false);
  const iframeIgnoreUntilRef = useRef(0);
  const remotePausedRef = useRef(remotePaused);
  const prevYtStateRef = useRef<number>(-1);
  const lastNaturalEndedAtRef = useRef(0);
  const anchorSecRef = useRef(anchorSec);
  const anchorAtRef = useRef(anchorAtIso);
  const pausedRef = useRef(remotePaused);
  const [playerReady, setPlayerReady] = useState(false);
  const [guestUnmuted, setGuestUnmuted] = useState(false);
  const [syncState, setSyncState] = useState<"synced" | "resyncing">("synced");
  const resyncToastCooldownUntilRef = useRef(0);
  const resyncIndicatorTimerRef = useRef<number | null>(null);

  useEffect(() => {
    onEndedRef.current = onHostVideoEnded;
  }, [onHostVideoEnded]);

  useEffect(() => {
    onPlaybackScrubRef.current = onPlaybackScrub;
  }, [onPlaybackScrub]);

  useEffect(() => {
    onIframePausePlayRef.current = onIframePausePlay;
  }, [onIframePausePlay]);

  useEffect(() => {
    onAutoResyncRef.current = onAutoResync;
  }, [onAutoResync]);

  useEffect(() => {
    remotePausedRef.current = remotePaused;
  }, [remotePaused]);

  useEffect(() => {
    anchorSecRef.current = anchorSec;
  }, [anchorSec]);

  useEffect(() => {
    anchorAtRef.current = anchorAtIso;
  }, [anchorAtIso]);

  useEffect(() => {
    pausedRef.current = remotePaused;
  }, [remotePaused]);

  useImperativeHandle(ref, () => ({
    getCurrentTime: () => playerRef.current?.getCurrentTime?.() ?? null,
  }));

  const triggerResyncUi = () => {
    setSyncState("resyncing");
    if (resyncIndicatorTimerRef.current != null) {
      window.clearTimeout(resyncIndicatorTimerRef.current);
    }
    resyncIndicatorTimerRef.current = window.setTimeout(() => {
      setSyncState("synced");
      resyncIndicatorTimerRef.current = null;
    }, 1500);

    const now = Date.now();
    if (now >= resyncToastCooldownUntilRef.current) {
      resyncToastCooldownUntilRef.current = now + 4200;
      onAutoResyncRef.current?.();
    }
  };

  useEffect(() => {
    prevYtStateRef.current = window.YT?.PlayerState?.UNSTARTED ?? -1;
  }, [videoId]);

  useEffect(() => {
    return () => {
      if (resyncIndicatorTimerRef.current != null) {
        window.clearTimeout(resyncIndicatorTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const outer = containerRef.current;
    if (!outer) return;

    const mount = async () => {
      await loadIframeApi();
      if (cancelled || !containerRef.current) return;

      const el = document.createElement("div");
      el.className = "h-full w-full";
      containerRef.current.appendChild(el);

      const YT = window.YT;
      const origin =
        typeof window !== "undefined" ? window.location.origin : undefined;

      const player = new YT.Player(el, {
        height: "100%",
        width: "100%",
        playerVars: {
          playsinline: 1,
          rel: 0,
          modestbranding: 1,
          ...(isHost ? {} : { mute: 1 }),
          ...(origin ? { origin } : {}),
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            playerRef.current = player;
            setPlayerReady(true);
          },
          onStateChange: (e) => {
            if (isHost) {
              const prev = prevYtStateRef.current;
              prevYtStateRef.current = e.data;

              if (e.data === YT.PlayerState.ENDED) {
                const wasActive =
                  prev === YT.PlayerState.PLAYING ||
                  prev === YT.PlayerState.BUFFERING;
                if (wasActive) {
                  const now = Date.now();
                  if (
                    now - lastNaturalEndedAtRef.current >=
                    NATURAL_END_DEBOUNCE_MS
                  ) {
                    lastNaturalEndedAtRef.current = now;
                    onEndedRef.current();
                  }
                }
              }
            } else {
              prevYtStateRef.current = e.data;
            }

            const cb = onIframePausePlayRef.current;
            if (!cb) return;
            if (Date.now() < iframeIgnoreUntilRef.current) return;
            if (suppressProgrammaticPausePlayRef.current) return;

            const pl = playerRef.current;
            const t = pl?.getCurrentTime?.() ?? 0;

            if (e.data === YT.PlayerState.PAUSED) {
              if (!remotePausedRef.current) {
                cb(true, Math.max(0, t));
              }
            } else if (e.data === YT.PlayerState.PLAYING) {
              if (remotePausedRef.current) {
                cb(false, Math.max(0, t));
              }
            }
          },
        },
      });
    };

    void mount();

    return () => {
      cancelled = true;
      setPlayerReady(false);
      playerRef.current?.destroy();
      playerRef.current = null;
      if (outer) outer.innerHTML = "";
    };
  }, [isHost]);

  useEffect(() => {
    if (!playerReady || !playerRef.current) return;
    if (!videoId) {
      playerRef.current.stopVideo();
      return;
    }
    const start = Math.floor(
      effectivePlaybackSec(
        anchorSecRef.current,
        anchorAtRef.current,
        pausedRef.current
      )
    );
    iframeIgnoreUntilRef.current = Date.now() + 900;
    playerRef.current.loadVideoById({
      videoId,
      startSeconds: Math.max(0, start),
    });

    /** `playVideo()` right after load often snaps to 0; fix once the player has cued. */
    const syncToRoomTimeline = () => {
      const p = playerRef.current;
      if (!p) return;
      const target = effectivePlaybackSec(
        anchorSecRef.current,
        anchorAtRef.current,
        pausedRef.current
      );
      const cur = p.getCurrentTime?.() ?? 0;
      if (Math.abs(cur - target) < 0.85) return;
      suppressProgrammaticPausePlayRef.current = true;
      try {
        p.seekTo(target, true);
        if (pausedRef.current) p.pauseVideo();
        else p.playVideo();
        triggerResyncUi();
      } finally {
        window.setTimeout(() => {
          suppressProgrammaticPausePlayRef.current = false;
        }, SUPPRESS_IFRAME_PAUSE_MS);
      }
    };

    const postLoadTimers = POST_LOAD_SYNC_MS.map((ms) =>
      window.setTimeout(syncToRoomTimeline, ms)
    );

    if (pausedRef.current) {
      const t = window.setTimeout(() => {
        const p = playerRef.current;
        if (!p) return;
        const target = effectivePlaybackSec(
          anchorSecRef.current,
          anchorAtRef.current,
          true
        );
        suppressProgrammaticPausePlayRef.current = true;
        p.seekTo(target, true);
        p.pauseVideo();
        triggerResyncUi();
        window.setTimeout(() => {
          suppressProgrammaticPausePlayRef.current = false;
        }, SUPPRESS_IFRAME_PAUSE_MS);
      }, 520);
      return () => {
        for (const id of postLoadTimers) window.clearTimeout(id);
        window.clearTimeout(t);
      };
    }
    return () => {
      for (const id of postLoadTimers) window.clearTimeout(id);
    };
  }, [playerReady, videoId]);

  useEffect(() => {
    if (!playerReady || !playerRef.current || !videoId) return;
    suppressProgrammaticPausePlayRef.current = true;
    try {
      if (remotePaused) playerRef.current.pauseVideo();
      else playerRef.current.playVideo();
    } finally {
      window.setTimeout(() => {
        suppressProgrammaticPausePlayRef.current = false;
      }, SUPPRESS_IFRAME_PAUSE_MS);
    }
  }, [playerReady, videoId, remotePaused]);

  const prevAnchorKeyRef = useRef("");
  useEffect(() => {
    if (!videoId) prevAnchorKeyRef.current = "";
  }, [videoId]);

  /** Follow remote anchor changes (guest/host seek, heartbeat). Skips tiny diffs so host iframe seeks are not snapped back. */
  useEffect(() => {
    if (!playerReady || !playerRef.current || !videoId) return;
    const key = `${videoId}|${anchorSec}|${anchorAtIso}|${remotePaused}`;
    if (key === prevAnchorKeyRef.current) return;
    prevAnchorKeyRef.current = key;
    const target = effectivePlaybackSec(anchorSec, anchorAtIso, remotePaused);
    const cur = playerRef.current.getCurrentTime?.() ?? 0;
    if (Math.abs(cur - target) < REMOTE_SYNC_MIN_DIFF) return;
    suppressProgrammaticPausePlayRef.current = true;
    try {
      playerRef.current.seekTo(target, true);
      if (remotePaused) playerRef.current.pauseVideo();
      triggerResyncUi();
    } finally {
      window.setTimeout(() => {
        suppressProgrammaticPausePlayRef.current = false;
      }, SUPPRESS_IFRAME_PAUSE_MS);
    }
  }, [playerReady, videoId, anchorSec, anchorAtIso, remotePaused]);

  /** Hard resync hook for reconnect/foreground/boot edge cases. */
  useEffect(() => {
    if (!playerReady || !playerRef.current || !videoId) return;
    const target = effectivePlaybackSec(
      anchorSecRef.current,
      anchorAtRef.current,
      pausedRef.current
    );
    suppressProgrammaticPausePlayRef.current = true;
    try {
      playerRef.current.seekTo(target, true);
      if (pausedRef.current) playerRef.current.pauseVideo();
      else playerRef.current.playVideo();
      triggerResyncUi();
    } finally {
      window.setTimeout(() => {
        suppressProgrammaticPausePlayRef.current = false;
      }, SUPPRESS_IFRAME_PAUSE_MS);
    }
  }, [forceResyncToken, playerReady, videoId]);

  /** Detect seeks via the embedded YouTube progress bar (not exposed as events). */
  useEffect(() => {
    if (!playerReady || !playerRef.current || !videoId || !onPlaybackScrub) return;
    let debounceTimer: number | null = null;
    const id = window.setInterval(() => {
      const paused = pausedRef.current;
      const exp = effectivePlaybackSec(
        anchorSecRef.current,
        anchorAtRef.current,
        paused
      );
      const act = playerRef.current?.getCurrentTime?.() ?? 0;
      const th = paused ? IFRAME_SCRUB_PAUSED : IFRAME_SCRUB_PLAYING;
      if (Math.abs(act - exp) < th) return;
      if (debounceTimer != null) return;
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        const p = pausedRef.current;
        const exp2 = effectivePlaybackSec(
          anchorSecRef.current,
          anchorAtRef.current,
          p
        );
        const act2 = playerRef.current?.getCurrentTime?.() ?? 0;
        const th2 = p ? IFRAME_SCRUB_PAUSED : IFRAME_SCRUB_PLAYING;
        if (Math.abs(act2 - exp2) < th2) return;
        onPlaybackScrubRef.current?.(act2);
      }, IFRAME_SCRUB_DEBOUNCE_MS);
    }, 420);
    return () => {
      window.clearInterval(id);
      if (debounceTimer != null) window.clearTimeout(debounceTimer);
    };
  }, [playerReady, videoId, onPlaybackScrub]);

  /** Guests only: nudge toward shared clock when slightly off (not a full iframe scrub). */
  useEffect(() => {
    if (
      isHost ||
      !playerReady ||
      !playerRef.current ||
      !videoId ||
      remotePaused
    )
      return;
    const id = window.setInterval(() => {
      const target = effectivePlaybackSec(
        anchorSecRef.current,
        anchorAtRef.current,
        false
      );
      const cur = playerRef.current?.getCurrentTime?.() ?? 0;
      const d = Math.abs(cur - target);
      if (d >= IFRAME_SCRUB_PLAYING) return;
      if (d > GUEST_DRIFT_THRESHOLD) {
        playerRef.current?.seekTo(target, true);
        triggerResyncUi();
      }
    }, GUEST_DRIFT_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isHost, playerReady, videoId, remotePaused]);

  useEffect(() => {
    if (!playerReady || !playerRef.current || isHost) return;
    try {
      if (guestUnmuted) playerRef.current.unMute();
      else playerRef.current.mute();
    } catch {
      /* ignore */
    }
  }, [playerReady, guestUnmuted, isHost, videoId]);

  return (
    <div
      className="ring-primary/25 relative w-full overflow-hidden rounded-xl bg-black shadow-md ring-2"
      style={{
        aspectRatio: "16 / 9",
        maxHeight: "min(42vh, 22rem)",
      }}
    >
      <div className="h-full w-full" ref={containerRef} />
      <div className="border-border/70 bg-background/80 text-foreground absolute left-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.65rem] font-semibold shadow-sm backdrop-blur-sm sm:text-xs">
        <span
          aria-hidden
          className={`inline-block size-2 rounded-full ${syncState === "resyncing" ? "bg-amber-400" : "bg-emerald-400"}`}
        />
        {syncState === "resyncing" ? "Resyncing..." : "Synced"}
      </div>
      {!isHost && videoId ? (
        <button
          type="button"
          onClick={() => setGuestUnmuted((u) => !u)}
          className="border-border/80 bg-background/85 text-foreground hover:bg-background focus-visible:ring-ring absolute bottom-2 right-2 z-10 rounded-lg border px-2.5 py-1 text-[0.65rem] font-semibold shadow-sm backdrop-blur-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-xs"
        >
          {guestUnmuted ? "Mute preview" : "Unmute preview"}
        </button>
      ) : null}
    </div>
  );
});

YouTubeSyncPlayer.displayName = "YouTubeSyncPlayer";

/** @deprecated Prefer `YouTubeSyncPlayer`; name kept for imports. */
export const YouTubeHostPlayer = YouTubeSyncPlayer;
