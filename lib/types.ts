export type QueueItem = {
  id: string;
  room_id: string;
  video_id: string;
  title: string;
  thumb_url: string | null;
  added_by: string | null;
  created_at: string;
};

export type YouTubeSearchItem = {
  videoId: string;
  title: string;
  thumbUrl: string;
};
