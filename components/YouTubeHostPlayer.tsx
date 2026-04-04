"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  videoId: string | null;
  onEnded: () => void;
  /** Synced from DB — guests use RPC; host uses YouTube’s own play/pause UI */
  remotePaused: boolean;
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

export function YouTubeHostPlayer({
  videoId,
  onEnded,
  remotePaused,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const onEndedRef = useRef(onEnded);
  const remotePausedRef = useRef(remotePaused);
  const [playerReady, setPlayerReady] = useState(false);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    remotePausedRef.current = remotePaused;
  }, [remotePaused]);

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

      const player = new window.YT.Player(el, {
        height: "100%",
        width: "100%",
        playerVars: { playsinline: 1, rel: 0, modestbranding: 1 },
        events: {
          onReady: () => {
            if (cancelled) return;
            playerRef.current = player;
            setPlayerReady(true);
          },
          onStateChange: (e) => {
            if (e.data === window.YT.PlayerState.ENDED) {
              onEndedRef.current();
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
  }, []);

  useEffect(() => {
    if (!playerReady || !playerRef.current) return;
    if (videoId) {
      playerRef.current.loadVideoById(videoId);
      if (remotePausedRef.current) {
        const t = window.setTimeout(() => {
          playerRef.current?.pauseVideo();
        }, 400);
        return () => window.clearTimeout(t);
      }
    } else {
      playerRef.current.stopVideo();
    }
  }, [playerReady, videoId]);

  useEffect(() => {
    if (!playerReady || !playerRef.current || !videoId) return;
    if (remotePaused) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  }, [playerReady, videoId, remotePaused]);

  return (
    <div
      className="ring-primary/25 relative w-full overflow-hidden rounded-xl bg-black shadow-md ring-2"
      style={{
        aspectRatio: "16 / 9",
        maxHeight: "min(42vh, 22rem)",
      }}
    >
      <div className="h-full w-full" ref={containerRef} />
    </div>
  );
}
