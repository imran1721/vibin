import { NextRequest, NextResponse } from "next/server";
import {
  fetchWithYouTubeApiKeyRotation,
  getYouTubeApiKeys,
} from "@/lib/youtube/api-key-rotation";

const YT_VIDEOS = "https://www.googleapis.com/youtube/v3/videos";

export async function GET(req: NextRequest) {
  const keys = getYouTubeApiKeys();
  if (keys.length === 0) {
    return NextResponse.json(
      { error: "YOUTUBE_API_KEYS is not configured" },
      { status: 500 }
    );
  }

  const idsRaw = req.nextUrl.searchParams.get("ids")?.trim() ?? "";
  if (!idsRaw) return NextResponse.json({ items: [] });
  const ids = idsRaw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, 25);
  if (ids.length === 0) return NextResponse.json({ items: [] });

  const { response: res } = await fetchWithYouTubeApiKeyRotation(
    (apiKey) => {
      const url = new URL(YT_VIDEOS);
      url.searchParams.set("part", "snippet");
      url.searchParams.set("id", ids.join(","));
      url.searchParams.set("key", apiKey);
      return url.toString();
    },
    { next: { revalidate: 3600 } }
  );

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: "YouTube API error", detail: text.slice(0, 200) },
      { status: 502 }
    );
  }

  const data = (await res.json()) as {
    items?: Array<{ id?: string; snippet?: { publishedAt?: string } }>;
  };
  const items =
    data.items
      ?.map((it) => ({
        videoId: it.id ?? "",
        publishedAt: it.snippet?.publishedAt ?? "",
      }))
      .filter((it) => it.videoId) ?? [];

  return NextResponse.json({ items });
}
