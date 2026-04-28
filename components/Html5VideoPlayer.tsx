"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { effectivePlaybackSec } from "@/lib/playback-sync";
import type { YouTubeSyncPlayerHandle } from "@/components/YouTubeHostPlayer";

type Props = {
  /** Direct media URL (mp4/webm/mov/m3u8). `null` clears playback. */
  mediaUrl: string | null;
  remotePaused: boolean;
  anchorSec: number;
  anchorAtIso: string;
  isHost: boolean;
  onHostVideoEnded: () => void;
  onPlaybackScrub?: (seconds: number) => void;
  onIframePausePlay?: (paused: boolean, anchorSeconds: number) => void;
  onAutoResync?: () => void;
  forceResyncToken?: number;
  className?: string;
};

const REMOTE_SYNC_MIN_DIFF = 2;
const SUPPRESS_PROGRAMMATIC_MS = 280;
const NATURAL_END_DEBOUNCE_MS = 900;

function isHlsUrl(url: string): boolean {
  const path = (() => {
    try {
      return new URL(url).pathname.toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  })();
  return path.endsWith(".m3u8");
}

export const Html5VideoPlayer = forwardRef<YouTubeSyncPlayerHandle, Props>(
  function Html5VideoPlayer(
    {
      mediaUrl,
      remotePaused,
      anchorSec,
      anchorAtIso,
      isHost,
      onHostVideoEnded,
      onPlaybackScrub,
      onIframePausePlay,
      onAutoResync,
      forceResyncToken = 0,
      className,
    },
    ref
  ) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const surfaceRef = useRef<HTMLDivElement>(null);
    const onEndedRef = useRef(onHostVideoEnded);
    const onScrubRef = useRef(onPlaybackScrub);
    const onPausePlayRef = useRef(onIframePausePlay);
    const onAutoResyncRef = useRef(onAutoResync);
    const remotePausedRef = useRef(remotePaused);
    const anchorSecRef = useRef(anchorSec);
    const anchorAtRef = useRef(anchorAtIso);
    const suppressProgrammaticRef = useRef(false);
    const lastNaturalEndedAtRef = useRef(0);
    const [guestUnmuted, setGuestUnmuted] = useState(false);

    useEffect(() => {
      onEndedRef.current = onHostVideoEnded;
    }, [onHostVideoEnded]);
    useEffect(() => {
      onScrubRef.current = onPlaybackScrub;
    }, [onPlaybackScrub]);
    useEffect(() => {
      onPausePlayRef.current = onIframePausePlay;
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

    useImperativeHandle(ref, () => ({
      getCurrentTime: () => videoRef.current?.currentTime ?? null,
      getDuration: () => {
        const d = videoRef.current?.duration;
        return d != null && Number.isFinite(d) ? d : null;
      },
      requestFullscreen: () => {
        const v = videoRef.current as
          | (HTMLVideoElement & {
              webkitEnterFullscreen?: () => void;
            })
          | null;
        // iOS Safari only allows fullscreen on the <video> element itself.
        if (v?.webkitEnterFullscreen) {
          try {
            v.webkitEnterFullscreen();
            return;
          } catch {
            /* fall through */
          }
        }
        const el = surfaceRef.current;
        if (!el) return;
        try {
          void el.requestFullscreen?.();
        } catch {
          /* ignore */
        }
      },
    }));

    /** Apply remote anchor: seek and pause/play. Skip tiny diffs to avoid fighting user scrubs. */
    useEffect(() => {
      const v = videoRef.current;
      if (!v || !mediaUrl) return;
      const target = effectivePlaybackSec(anchorSec, anchorAtIso, remotePaused);
      const cur = v.currentTime;
      suppressProgrammaticRef.current = true;
      try {
        if (Math.abs(cur - target) >= REMOTE_SYNC_MIN_DIFF) {
          try {
            v.currentTime = target;
            onAutoResyncRef.current?.();
          } catch {
            /* not seekable yet */
          }
        }
        if (remotePaused) {
          if (!v.paused) v.pause();
        } else {
          if (v.paused) {
            const p = v.play();
            if (p && typeof p.then === "function") p.catch(() => {});
          }
        }
      } finally {
        window.setTimeout(() => {
          suppressProgrammaticRef.current = false;
        }, SUPPRESS_PROGRAMMATIC_MS);
      }
    }, [mediaUrl, anchorSec, anchorAtIso, remotePaused]);

    /** Hard resync trigger. */
    useEffect(() => {
      const v = videoRef.current;
      if (!v || !mediaUrl) return;
      const target = effectivePlaybackSec(
        anchorSecRef.current,
        anchorAtRef.current,
        remotePausedRef.current
      );
      suppressProgrammaticRef.current = true;
      try {
        v.currentTime = target;
        if (remotePausedRef.current) v.pause();
        else {
          const p = v.play();
          if (p && typeof p.then === "function") p.catch(() => {});
        }
      } catch {
        /* ignore */
      } finally {
        window.setTimeout(() => {
          suppressProgrammaticRef.current = false;
        }, SUPPRESS_PROGRAMMATIC_MS);
      }
    }, [forceResyncToken, mediaUrl]);

    /**
     * Attach the source. For HLS (.m3u8): use native if Safari supports it,
     * otherwise dynamically import hls.js so the dependency only loads when needed.
     */
    useEffect(() => {
      const v = videoRef.current;
      if (!v) return;
      let cancelled = false;
      // hls.js exposes type via its module; we keep this typed loosely to avoid
      // pulling its types into the public API of this file.
      let hls: { destroy: () => void } | null = null;

      if (!mediaUrl) {
        v.removeAttribute("src");
        v.load();
        return () => {
          cancelled = true;
        };
      }

      const nativeHls = v.canPlayType("application/vnd.apple.mpegurl");
      if (isHlsUrl(mediaUrl) && !nativeHls) {
        void import("hls.js").then((mod) => {
          if (cancelled) return;
          const Hls = mod.default;
          if (!Hls.isSupported()) {
            // No MSE support — fall back to direct src and let the browser try.
            v.src = mediaUrl;
            return;
          }
          const instance = new Hls({ enableWorker: true });
          hls = instance;
          instance.loadSource(mediaUrl);
          instance.attachMedia(v);
        });
      } else {
        v.src = mediaUrl;
      }

      return () => {
        cancelled = true;
        if (hls) {
          try {
            hls.destroy();
          } catch {
            /* ignore */
          }
        }
      };
    }, [mediaUrl]);

    /** When src changes, seek to current room time once metadata loads. */
    useEffect(() => {
      const v = videoRef.current;
      if (!v) return;
      const onLoaded = () => {
        const target = effectivePlaybackSec(
          anchorSecRef.current,
          anchorAtRef.current,
          remotePausedRef.current
        );
        try {
          v.currentTime = Math.max(0, target);
        } catch {
          /* ignore */
        }
        if (!remotePausedRef.current) {
          const p = v.play();
          if (p && typeof p.then === "function") p.catch(() => {});
        }
      };
      v.addEventListener("loadedmetadata", onLoaded);
      return () => v.removeEventListener("loadedmetadata", onLoaded);
    }, [mediaUrl]);

    const handlePauseEvent = () => {
      if (suppressProgrammaticRef.current) return;
      if (typeof document !== "undefined" && document.hidden) return;
      if (remotePausedRef.current) return;
      const v = videoRef.current;
      const t = v?.currentTime ?? 0;
      onPausePlayRef.current?.(true, Math.max(0, t));
    };

    const handlePlayEvent = () => {
      if (suppressProgrammaticRef.current) return;
      if (!remotePausedRef.current) return;
      const v = videoRef.current;
      const t = v?.currentTime ?? 0;
      onPausePlayRef.current?.(false, Math.max(0, t));
    };

    const handleSeeked = () => {
      if (!isHost) return;
      if (suppressProgrammaticRef.current) return;
      const v = videoRef.current;
      if (!v) return;
      const expected = effectivePlaybackSec(
        anchorSecRef.current,
        anchorAtRef.current,
        remotePausedRef.current
      );
      if (Math.abs(v.currentTime - expected) < 1) return;
      onScrubRef.current?.(Math.max(0, v.currentTime));
    };

    const handleEnded = () => {
      if (!isHost) return;
      const now = Date.now();
      if (now - lastNaturalEndedAtRef.current < NATURAL_END_DEBOUNCE_MS) return;
      lastNaturalEndedAtRef.current = now;
      onEndedRef.current();
    };

    return (
      <div
        ref={surfaceRef}
        className={`ring-primary/25 relative w-full max-h-[min(42vh,22rem)] overflow-hidden rounded-xl bg-black shadow-md ring-2 min-[708px]:max-h-[min(72vh,48rem)] ${className ?? ""}`}
        style={{ aspectRatio: "16 / 9" }}
      >
        {mediaUrl ? (
          <video
            ref={videoRef}
            playsInline
            controls={isHost}
            muted={!isHost && !guestUnmuted}
            preload="auto"
            crossOrigin="anonymous"
            className="h-full w-full bg-black"
            onPause={handlePauseEvent}
            onPlay={handlePlayEvent}
            onSeeked={handleSeeked}
            onEnded={handleEnded}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/60">
            Nothing playing
          </div>
        )}
        {!isHost && mediaUrl ? (
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
  }
);

Html5VideoPlayer.displayName = "Html5VideoPlayer";
