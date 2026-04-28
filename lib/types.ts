export type QueueItemProvider = "youtube" | "direct" | "embed";

export type QueueItem = {
  id: string;
  room_id: string;
  provider: QueueItemProvider;
  video_id: string | null;
  media_url: string | null;
  title: string;
  thumb_url: string | null;
  added_by: string | null;
  created_at: string;
};

export type YouTubeSearchItem = {
  videoId: string;
  title: string;
  thumbUrl: string;
  publishedAt?: string;
};

/** Anything addable to the queue — YouTube search hit OR pasted URL. */
export type AddQueueItem =
  | { provider: "youtube"; videoId: string; title: string; thumbUrl: string }
  | {
      provider: "direct";
      mediaUrl: string;
      title: string;
      thumbUrl: string | null;
    }
  | {
      provider: "embed";
      embedUrl: string;
      title: string;
      thumbUrl: string | null;
    };
