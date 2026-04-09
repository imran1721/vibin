import { NextRequest, NextResponse } from "next/server";
import { getBearerToken } from "@/lib/api-auth";
import { createSupabaseUserClient } from "@/lib/supabase/user-client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isAnonymousUser } from "@/lib/supabase/isAnonymousUser";
import { refreshGoogleAccessToken } from "@/lib/youtube/google-access-token";
import { getGcpAccessToken } from "@/lib/gcp-access-token";

type Playlist = { id: string; title: string; itemCount?: number };

function env(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

async function listYouTubePlaylists(accessToken: string): Promise<Playlist[]> {
  const PLAYLISTS = "https://www.googleapis.com/youtube/v3/playlists";
  const out: Playlist[] = [];
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
    if (!res.ok) throw new Error(`YouTube playlists failed: ${res.status}`);
    const data = (await res.json()) as {
      items?: Array<{
        id?: string;
        snippet?: { title?: string };
        contentDetails?: { itemCount?: string };
      }>;
      nextPageToken?: string;
    };
    for (const it of data.items ?? []) {
      if (!it.id) continue;
      out.push({
        id: it.id,
        title: it.snippet?.title ?? "Untitled",
        itemCount: it.contentDetails?.itemCount
          ? parseInt(it.contentDetails.itemCount, 10)
          : undefined,
      });
    }
    pageToken = data.nextPageToken;
  } while (pageToken);
  return out;
}

async function listPlaylistItemTitles(
  accessToken: string,
  playlistId: string,
  limit: number
): Promise<string[]> {
  const ITEMS = "https://www.googleapis.com/youtube/v3/playlistItems";
  const out: string[] = [];
  let pageToken: string | undefined;
  while (out.length < limit) {
    const u = new URL(ITEMS);
    u.searchParams.set("part", "snippet");
    u.searchParams.set("playlistId", playlistId);
    u.searchParams.set("maxResults", "50");
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    const res = await fetch(u.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) break;
    const data = (await res.json()) as {
      items?: Array<{ snippet?: { title?: string } }>;
      nextPageToken?: string;
    };
    for (const it of data.items ?? []) {
      const t = (it.snippet?.title ?? "").trim();
      if (t) out.push(t);
      if (out.length >= limit) break;
    }
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }
  return out.slice(0, limit);
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const project = env("GOOGLE_CLOUD_PROJECT");
  const location = (process.env.VERTEX_LOCATION?.trim() || "us-central1").trim();
  const model = (process.env.VERTEX_EMBEDDINGS_MODEL?.trim() || "text-embedding-004").trim();

  const token = await getGcpAccessToken();
  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${encodeURIComponent(
    model
  )}:predict`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      instances: texts.map((t) => ({ content: t })),
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Embeddings failed: ${res.status} ${txt.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    predictions?: Array<{ embeddings?: { values?: number[] } }>;
  };
  const vectors =
    data.predictions?.map((p) => p.embeddings?.values ?? []).filter((v) => v.length > 0) ??
    [];
  if (vectors.length !== texts.length) {
    throw new Error("Embeddings returned unexpected shape");
  }
  return vectors;
}

async function upsertDatapoints(params: {
  location: string;
  indexId: string;
  userId: string;
  datapoints: Array<{ id: string; vector: number[]; text: string }>;
}): Promise<void> {
  const project = env("GOOGLE_CLOUD_PROJECT");
  const token = await getGcpAccessToken();

  const indexName = `projects/${project}/locations/${params.location}/indexes/${params.indexId}`;
  const url = `https://${params.location}-aiplatform.googleapis.com/v1/${indexName}:upsertDatapoints`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      datapoints: params.datapoints.map((d) => ({
        datapointId: d.id,
        featureVector: d.vector,
        restricts: [{ namespace: "userId", allowList: [params.userId] }],
        embeddingMetadata: { text: d.text.slice(0, 1500) },
      })),
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Vector upsert failed: ${res.status} ${txt.slice(0, 200)}`);
  }
}

export async function POST(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  // Mark indexing.
  await admin.from("taste_profiles").upsert(
    { user_id: user.id, status: "indexing", error: null, indexed_at: null },
    { onConflict: "user_id" }
  );

  try {
    const { data: cred } = await admin
      .from("youtube_credentials")
      .select("refresh_token")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!cred?.refresh_token) {
      return NextResponse.json({ error: "youtube_not_connected" }, { status: 400 });
    }

    const accessToken = await refreshGoogleAccessToken(cred.refresh_token);

    const maxPlaylists = clamp(Number(req.nextUrl.searchParams.get("playlists") ?? 20), 1, 50);
    const itemsPerPlaylist = clamp(
      Number(req.nextUrl.searchParams.get("itemsPer") ?? 20),
      5,
      50
    );

    const playlists = (await listYouTubePlaylists(accessToken)).slice(0, maxPlaylists);
    const texts: Array<{ id: string; text: string }> = [];

    for (const pl of playlists) {
      const titles = await listPlaylistItemTitles(accessToken, pl.id, itemsPerPlaylist);
      const doc = [
        `Playlist: ${pl.title}`,
        ...(titles.length ? ["Examples:"] : []),
        ...titles.map((t) => `- ${t}`),
      ].join("\n");
      texts.push({ id: `pl:${pl.id}`, text: doc });
    }

    const vectors = await embedTexts(texts.map((t) => t.text));

    const vecLocation = (process.env.VERTEX_VECTOR_LOCATION?.trim() || process.env.VERTEX_LOCATION || "us-central1").trim();
    const indexId = env("VERTEX_VECTOR_INDEX_ID");

    await upsertDatapoints({
      location: vecLocation,
      indexId,
      userId: user.id,
      datapoints: texts.map((t, i) => ({
        id: t.id,
        text: t.text,
        vector: vectors[i]!,
      })),
    });

    await admin.from("taste_profiles").upsert(
      {
        user_id: user.id,
        status: "ready",
        indexed_at: new Date().toISOString(),
        error: null,
      },
      { onConflict: "user_id" }
    );

    return NextResponse.json({ ok: true, playlistsIndexed: playlists.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    try {
      await admin.from("taste_profiles").upsert(
        { user_id: user.id, status: "error", error: msg.slice(0, 900) },
        { onConflict: "user_id" }
      );
    } catch {
      /* ignore */
    }
    return NextResponse.json({ error: "index_failed", detail: msg }, { status: 502 });
  }
}

