"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  videoId: string | null;
  onEnded: () => void;
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

export function YouTubeHostPlayer({ videoId, onEnded }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const onEndedRef = useRef(onEnded);
  const [playerReady, setPlayerReady] = useState(false);

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

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
    } else {
      playerRef.current.stopVideo();
    }
  }, [playerReady, videoId]);

  return (
    <div
      className="ring-primary/25 overflow-hidden rounded-2xl bg-black shadow-lg ring-2"
      ref={containerRef}
      style={{
        aspectRatio: "16 / 9",
        maxHeight: "min(50vh, 28rem)",
        width: "100%",
      }}
    />
  );
}
