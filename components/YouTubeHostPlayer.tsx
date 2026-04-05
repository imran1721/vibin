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
  },
  ref
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const onEndedRef = useRef(onHostVideoEnded);
  const onPlaybackScrubRef = useRef(onPlaybackScrub);
  const remotePausedRef = useRef(remotePaused);
  const prevYtStateRef = useRef<number>(-1);
  const lastNaturalEndedAtRef = useRef(0);
  const anchorSecRef = useRef(anchorSec);
  const anchorAtRef = useRef(anchorAtIso);
  const pausedRef = useRef(remotePaused);
  const [playerReady, setPlayerReady] = useState(false);
  const [guestUnmuted, setGuestUnmuted] = useState(false);

  useEffect(() => {
    onEndedRef.current = onHostVideoEnded;
  }, [onHostVideoEnded]);

  useEffect(() => {
    onPlaybackScrubRef.current = onPlaybackScrub;
  }, [onPlaybackScrub]);

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

  useEffect(() => {
    prevYtStateRef.current = window.YT?.PlayerState?.UNSTARTED ?? -1;
  }, [videoId]);

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
            if (!isHost) return;
            const prev = prevYtStateRef.current;
            prevYtStateRef.current = e.data;

            if (e.data !== YT.PlayerState.ENDED) return;

            const wasActive =
              prev === YT.PlayerState.PLAYING ||
              prev === YT.PlayerState.BUFFERING;
            if (!wasActive) return;

            const now = Date.now();
            if (now - lastNaturalEndedAtRef.current < NATURAL_END_DEBOUNCE_MS) {
              return;
            }
            lastNaturalEndedAtRef.current = now;
            onEndedRef.current();
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
    playerRef.current.loadVideoById({
      videoId,
      startSeconds: Math.max(0, start),
    });
    if (pausedRef.current) {
      const t = window.setTimeout(() => {
        playerRef.current?.pauseVideo();
      }, 500);
      return () => window.clearTimeout(t);
    }
  }, [playerReady, videoId]);

  useEffect(() => {
    if (!playerReady || !playerRef.current || !videoId) return;
    if (remotePaused) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
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
    playerRef.current.seekTo(target, true);
    if (remotePaused) playerRef.current.pauseVideo();
  }, [playerReady, videoId, anchorSec, anchorAtIso, remotePaused]);

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
