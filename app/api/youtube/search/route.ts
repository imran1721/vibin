import { NextRequest, NextResponse } from "next/server";
import {
  fetchWithYouTubeApiKeyRotation,
  getYouTubeApiKeys,
} from "@/lib/youtube/api-key-rotation";

const YT_SEARCH = "https://www.googleapis.com/youtube/v3/search";

export async function GET(req: NextRequest) {
  const keys = getYouTubeApiKeys();
  if (keys.length === 0) {
    return NextResponse.json(
      { error: "YOUTUBE_API_KEYS is not configured" },
      { status: 500 }
    );
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  const { response: res } = await fetchWithYouTubeApiKeyRotation(
    (apiKey) => {
      const url = new URL(YT_SEARCH);
      url.searchParams.set("part", "snippet");
      url.searchParams.set("type", "video");
      url.searchParams.set("maxResults", "12");
      url.searchParams.set("q", q);
      url.searchParams.set("key", apiKey);
      return url.toString();
    },
    { next: { revalidate: 60 } }
  );
  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "YouTube API error", detail: text.slice(0, 200) },
      { status: 502 }
    );
  }

  const data = (await res.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: { title?: string; thumbnails?: { medium?: { url?: string } } };
    }>;
  };

  const items =
    data.items?.map((it) => ({
      videoId: it.id?.videoId ?? "",
      title: it.snippet?.title ?? "Untitled",
      thumbUrl: it.snippet?.thumbnails?.medium?.url ?? "",
    })).filter((it) => it.videoId) ?? [];

  return NextResponse.json({ items });
}
