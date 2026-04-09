import { NextRequest, NextResponse } from "next/server";
import { getBearerToken } from "@/lib/api-auth";
import { createSupabaseUserClient } from "@/lib/supabase/user-client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { isAnonymousUser } from "@/lib/supabase/isAnonymousUser";
import { getGcpAccessToken } from "@/lib/gcp-access-token";
import { embedTextVertex } from "@/lib/vertex-text-embeddings";
import { VertexAI } from "@google-cloud/vertexai";
import { vertexGoogleAuthOptions } from "@/lib/vertex-google-auth-options";

function env(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

type Neighbor = { datapointId: string; distance?: number; text?: string };

async function findNeighbors(params: {
  location: string;
  project: string;
  publicDomain: string;
  indexEndpointId: string;
  deployedIndexId: string;
  userId: string;
  queryVector: number[];
  neighborCount: number;
}): Promise<Neighbor[]> {
  const token = await getGcpAccessToken();
  const base = `https://${params.publicDomain}`;
  const url = `${base}/v1/projects/${params.project}/locations/${params.location}/indexEndpoints/${params.indexEndpointId}:findNeighbors`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      deployed_index_id: params.deployedIndexId,
      queries: [
        {
          datapoint: {
            datapoint_id: "q",
            feature_vector: params.queryVector,
            restricts: [{ namespace: "userId", allow_list: [params.userId] }],
          },
          neighbor_count: params.neighborCount,
        },
      ],
      return_full_datapoint: true,
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Vector query failed: ${res.status} ${txt.slice(0, 200)}`);
  }

  const data = (await res.json()) as {
    nearestNeighbors?: Array<{
      neighbors?: Array<{
        datapoint?: { datapointId?: string; embeddingMetadata?: { text?: string } };
        distance?: number;
      }>;
    }>;
  };

  const ns = data.nearestNeighbors?.[0]?.neighbors ?? [];
  return ns
    .map((n) => ({
      datapointId: n.datapoint?.datapointId ?? "",
      distance: n.distance,
      text: n.datapoint?.embeddingMetadata?.text ?? "",
    }))
    .filter((n) => n.datapointId && n.text);
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = null;
  }
  const bodyObj =
    body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  const message = norm(typeof bodyObj?.message === "string" ? bodyObj.message : "");
  if (!message) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  const projectId = env("GOOGLE_CLOUD_PROJECT");
  const vecLocation =
    (process.env.VERTEX_VECTOR_LOCATION?.trim() ||
      process.env.VERTEX_LOCATION?.trim() ||
      "us-central1").trim();
  const indexEndpointId = env("VERTEX_VECTOR_INDEX_ENDPOINT_ID");
  const deployedIndexId = env("VERTEX_VECTOR_DEPLOYED_INDEX_ID");
  const publicDomain = env("VERTEX_VECTOR_PUBLIC_ENDPOINT_DOMAIN");

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: "Server not configured" }, { status: 500 });
  }

  const { data: taste } = await admin
    .from("taste_profiles")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();
  const tasteStatus =
    taste && typeof taste === "object"
      ? (taste as { status?: unknown }).status
      : undefined;
  if (tasteStatus !== "ready") {
    return NextResponse.json({ error: "not_indexed" }, { status: 409 });
  }

  try {
    const qvec = await embedTextVertex(message);
    const neighbors = await findNeighbors({
      location: vecLocation,
      project: projectId,
      publicDomain,
      indexEndpointId,
      deployedIndexId,
      userId: user.id,
      queryVector: qvec,
      neighborCount: 12,
    });

    const context = neighbors
      .slice(0, 10)
      .map((n, i) => `Doc ${i + 1}:\n${String(n.text).slice(0, 700)}`)
      .join("\n\n");

    const vertex = new VertexAI({
      project: projectId,
      location: (process.env.VERTEX_LOCATION?.trim() || "us-central1").trim(),
      googleAuthOptions: vertexGoogleAuthOptions() as
        | Record<string, unknown>
        | undefined,
    });
    const model = vertex.getGenerativeModel({
      model: (process.env.VERTEX_GEMINI_MODEL?.trim() || "gemini-2.0-flash-001").trim(),
      generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
    });

    const prompt = [
      "Return ONLY valid JSON (no markdown) with this exact shape:",
      `{"reply":"...","queries":[...]} `,
      "",
      "You are Vibin AI. Use the retrieved context (the user's playlists/signals) to suggest videos they'll like.",
      "",
      "Retrieved context (do not invent beyond this):",
      context || "(none)",
      "",
      "User request:",
      JSON.stringify(message),
      "",
      "Rules:",
      "- reply: 1 short sentence (<= 140 chars).",
      "- queries: exactly 8 natural YouTube search queries.",
      "- Queries should be grounded in the retrieved context when possible.",
      "- Keep each query <= 80 characters.",
    ].join("\n");

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    const text =
      result.response.candidates?.[0]?.content?.parts
        ?.map((p) => ("text" in p ? String(p.text ?? "") : ""))
        .join("") ?? "";

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return NextResponse.json(
        { error: "Model returned non-JSON", detail: text.slice(0, 250) },
        { status: 502 }
      );
    }
    const parsedObj =
      parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    const reply = typeof parsedObj?.reply === "string" ? norm(parsedObj.reply) : "";
    const queriesRaw = parsedObj?.queries;
    const queries =
      Array.isArray(queriesRaw)
        ? Array.from(
            new Set(
              queriesRaw
                .filter((q): q is string => typeof q === "string")
                .map(norm)
                .filter(Boolean)
            )
          ).slice(0, 8)
        : [];
    if (!reply || queries.length < 3) {
      return NextResponse.json(
        { error: "Model returned invalid schema", detail: parsed },
        { status: 502 }
      );
    }

    // Resolve queries to concrete YouTube items using existing endpoint.
    const items = (
      await Promise.all(
        queries.map(async (q) => {
          try {
            const r = await fetch(
              new URL(`/api/youtube/search?q=${encodeURIComponent(q)}`, req.url)
            );
            const j = (await r.json()) as { items?: unknown[] };
            return (Array.isArray(j.items) ? j.items[0] : null) ?? null;
          } catch {
            return null;
          }
        })
      )
    ).filter(Boolean);

    return NextResponse.json({ reply, queries, items });
  } catch (e) {
    return NextResponse.json(
      { error: "suggest_failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}

