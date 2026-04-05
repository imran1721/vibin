import { NextRequest, NextResponse } from "next/server";
import { getBearerToken } from "@/lib/api-auth";
import { createSupabaseUserClient } from "@/lib/supabase/user-client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { refreshGoogleAccessToken } from "@/lib/youtube/google-access-token";

const ITEMS = "https://www.googleapis.com/youtube/v3/playlistItems";

type Body = {
  roomId?: string;
  playlistId?: string;
  mode?: "append" | "replace";
  /** Shown on queue rows; omit or empty → "Playlist". */
  addedBy?: string | null;
};

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const roomId = body.roomId?.trim();
  const playlistId = body.playlistId?.trim();
  const mode = body.mode === "replace" ? "replace" : "append";
  const addedByLabel =
    typeof body.addedBy === "string" && body.addedBy.trim().length > 0
      ? body.addedBy.trim().slice(0, 40)
      : "Playlist";

  if (!roomId || !playlistId) {
    return NextResponse.json(
      { error: "roomId and playlistId required" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseUserClient(token);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: member, error: memberError } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", roomId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (memberError || !member) {
    return NextResponse.json(
      { error: "Join the room before importing playlists" },
      { status: 403 }
    );
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

  const rows: Array<{
    room_id: string;
    video_id: string;
    title: string;
    thumb_url: string | null;
    added_by: string;
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
      rows.push({
        room_id: roomId,
        video_id: vid,
        title: it.snippet?.title ?? "Untitled",
        thumb_url: it.snippet?.thumbnails?.medium?.url ?? null,
        added_by: addedByLabel,
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  if (mode === "replace") {
    const { error: delError } = await admin
      .from("queue_items")
      .delete()
      .eq("room_id", roomId);
    if (delError) {
      return NextResponse.json(
        { error: delError.message },
        { status: 500 }
      );
    }
  }

  const chunk = 40;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error: insError } = await supabase
      .from("queue_items")
      .insert(slice);
    if (insError) {
      return NextResponse.json(
        { error: insError.message, imported: i },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ imported: rows.length, mode });
}
