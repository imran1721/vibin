import { NextRequest, NextResponse } from "next/server";
import { getBearerToken } from "@/lib/api-auth";
import { createSupabaseUserClient } from "@/lib/supabase/user-client";
import { isAnonymousUser } from "@/lib/supabase/isAnonymousUser";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { refreshGoogleAccessToken } from "@/lib/youtube/google-access-token";

const ITEMS = "https://www.googleapis.com/youtube/v3/playlistItems";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: playlistId } = await context.params;
  if (!playlistId) {
    return NextResponse.json({ error: "Missing playlist id" }, { status: 400 });
  }

  const supabase = createSupabaseUserClient(token);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }
  if (isAnonymousUser(user)) {
    return NextResponse.json({ error: "login_required" }, { status: 401 });
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    );
  }

  const { data: cred } = await admin
    .from("youtube_credentials")
    .select("refresh_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!cred?.refresh_token) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  let accessToken: string;
  try {
    accessToken = await refreshGoogleAccessToken(cred.refresh_token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "refresh_failed";
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  const out: Array<{
    videoId: string;
    title: string;
    thumbUrl: string;
  }> = [];
  let pageToken: string | undefined;

  do {
    const u = new URL(ITEMS);
    u.searchParams.set("part", "snippet,contentDetails");
    u.searchParams.set("playlistId", playlistId);
    u.searchParams.set("maxResults", "50");
    if (pageToken) u.searchParams.set("pageToken", pageToken);

    const res = await fetch(u.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "YouTube API error", detail: text.slice(0, 200) },
        { status: 502 }
      );
    }

    const data = (await res.json()) as {
      items?: Array<{
        snippet?: {
          title?: string;
          resourceId?: { videoId?: string };
          thumbnails?: { medium?: { url?: string } };
        };
        contentDetails?: { videoId?: string };
      }>;
      nextPageToken?: string;
    };

    for (const it of data.items ?? []) {
      const vid =
        it.contentDetails?.videoId ?? it.snippet?.resourceId?.videoId ?? "";
      if (!vid) continue;
      out.push({
        videoId: vid,
        title: it.snippet?.title ?? "Untitled",
        thumbUrl: it.snippet?.thumbnails?.medium?.url ?? "",
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return NextResponse.json({ items: out });
}
