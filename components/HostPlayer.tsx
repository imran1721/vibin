"use client";

import { forwardRef } from "react";
import {
  YouTubeSyncPlayer,
  type YouTubeSyncPlayerHandle,
} from "@/components/YouTubeHostPlayer";
import { Html5VideoPlayer } from "@/components/Html5VideoPlayer";
import { IframeEmbedPlayer } from "@/components/IframeEmbedPlayer";
import type { QueueItem } from "@/lib/types";

type Props = {
  nowPlaying: QueueItem | null;
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

export const HostPlayer = forwardRef<YouTubeSyncPlayerHandle, Props>(
  function HostPlayer(props, ref) {
    const provider = props.nowPlaying?.provider ?? "youtube";

    if (provider === "embed") {
      return (
        <IframeEmbedPlayer
          ref={ref}
          embedUrl={props.nowPlaying?.media_url ?? null}
          className={props.className}
        />
      );
    }

    if (provider === "direct") {
      return (
        <Html5VideoPlayer
          ref={ref}
          mediaUrl={props.nowPlaying?.media_url ?? null}
          remotePaused={props.remotePaused}
          anchorSec={props.anchorSec}
          anchorAtIso={props.anchorAtIso}
          isHost={props.isHost}
          onHostVideoEnded={props.onHostVideoEnded}
          onPlaybackScrub={props.onPlaybackScrub}
          onIframePausePlay={props.onIframePausePlay}
          onAutoResync={props.onAutoResync}
          forceResyncToken={props.forceResyncToken}
          className={props.className}
        />
      );
    }

    return (
      <YouTubeSyncPlayer
        ref={ref}
        videoId={props.nowPlaying?.video_id ?? null}
        remotePaused={props.remotePaused}
        anchorSec={props.anchorSec}
        anchorAtIso={props.anchorAtIso}
        isHost={props.isHost}
        onHostVideoEnded={props.onHostVideoEnded}
        onPlaybackScrub={props.onPlaybackScrub}
        onIframePausePlay={props.onIframePausePlay}
        onAutoResync={props.onAutoResync}
        forceResyncToken={props.forceResyncToken}
        className={props.className}
      />
    );
  }
);

HostPlayer.displayName = "HostPlayer";
