import { NextRequest, NextResponse } from "next/server";

const YT_SEARCH = "https://www.googleapis.com/youtube/v3/search";

function parseYouTubeKeys(): string[] {
  const multi = (process.env.YOUTUBE_API_KEYS ?? "")
    .split(/[,\n]/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const single = (process.env.YOUTUBE_API_KEY ?? "").trim();
  const all = [...multi, ...(single ? [single] : [])];
  return Array.from(new Set(all));
}

function shouldFailover(status: number, bodyText: string): boolean {
  // Only rotate keys for quota / rate limiting style failures.
  if (status === 429) return true;
  if (status !== 403) return false;
  const t = bodyText.toLowerCase();
  return (
    t.includes("quota") ||
    t.includes("dailylimitexceeded") ||
    t.includes("quotaexceeded") ||
    t.includes("rate limit") ||
    t.includes("userratelimitexceeded")
  );
}

export async function GET(req: NextRequest) {
  const keys = parseYouTubeKeys();
  if (keys.length === 0) {
    return NextResponse.json(
      { error: "YOUTUBE_API_KEY(S) is not configured" },
      { status: 500 }
    );
  }

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ items: [] });
  }

  let lastErr: { status: number; detail: string } | null = null;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]!;
    const url = new URL(YT_SEARCH);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    url.searchParams.set("maxResults", "12");
    url.searchParams.set("q", q);
    url.searchParams.set("key", key);

    const res = await fetch(url.toString(), { next: { revalidate: 60 } });
    if (!res.ok) {
      const text = await res.text();
      lastErr = { status: res.status, detail: text.slice(0, 300) };
      const canTryNext = i < keys.length - 1;
      if (canTryNext && shouldFailover(res.status, text)) continue;
      return NextResponse.json(
        {
          error: "YouTube API error",
          status: res.status,
          detail: text.slice(0, 200),
        },
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
      data.items
        ?.map((it) => ({
          videoId: it.id?.videoId ?? "",
          title: it.snippet?.title ?? "Untitled",
          thumbUrl: it.snippet?.thumbnails?.medium?.url ?? "",
        }))
        .filter((it) => it.videoId) ?? [];

    return NextResponse.json({ items });
  }

  return NextResponse.json(
    { error: "YouTube API error", detail: lastErr?.detail ?? "unknown" },
    { status: 502 }
  );
}
