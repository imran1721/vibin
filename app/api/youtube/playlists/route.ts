import { NextRequest, NextResponse } from "next/server";
import { getBearerToken } from "@/lib/api-auth";
import { createSupabaseUserClient } from "@/lib/supabase/user-client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { refreshGoogleAccessToken } from "@/lib/youtube/google-access-token";

const PLAYLISTS = "https://www.googleapis.com/youtube/v3/playlists";

export async function GET(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseUserClient(token);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { error: "Server not configured for playlists" },
      { status: 500 }
    );
  }

  const { data: cred, error: credError } = await admin
    .from("youtube_credentials")
    .select("refresh_token")
    .eq("user_id", user.id)
    .maybeSingle();

  if (credError || !cred?.refresh_token) {
    return NextResponse.json(
      { error: "not_connected", playlists: [] },
      { status: 200 }
    );
  }

  let accessToken: string;
  try {
    accessToken = await refreshGoogleAccessToken(cred.refresh_token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "refresh_failed";
    return NextResponse.json({ error: msg }, { status: 401 });
  }

  const items: Array<{ id: string; title: string; itemCount?: number }> = [];
  let pageToken: string | undefined;

  do {
    const u = new URL(PLAYLISTS);
    u.searchParams.set("part", "snippet,contentDetails");
    u.searchParams.set("mine", "true");
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
        id?: string;
        snippet?: { title?: string };
        contentDetails?: { itemCount?: string };
      }>;
      nextPageToken?: string;
    };

    for (const it of data.items ?? []) {
      if (it.id) {
        items.push({
          id: it.id,
          title: it.snippet?.title ?? "Untitled",
          itemCount: it.contentDetails?.itemCount
            ? parseInt(it.contentDetails.itemCount, 10)
            : undefined,
        });
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return NextResponse.json({ playlists: items });
}
