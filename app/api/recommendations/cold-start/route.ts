import { NextRequest, NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { vertexGoogleAuthOptions } from "@/lib/vertex-google-auth-options";

const DEFAULT_MODEL_ID = "gemini-2.0-flash-001";
const DEFAULT_COUNT = 12;

function toVibePrompt(vibe: string): string {
  const v = vibe.trim().toLowerCase();
  if (!v) return "upbeat popular mix, widely liked";

  const preset: Record<string, string> = {
    "house-party":
      "high-energy house party pop + edm bangers, widely liked, avoid niche",
    chill: "chill cozy, mellow, modern, not sad, avoid long intros",
    focus: "work focus, low distraction, minimal lyrics, ambient/electronic",
    throwbacks: "2000s/2010s throwback hits, upbeat",
    "global-hits":
      "global mainstream hits across languages, party-friendly, high energy",
    surprise:
      "fun variety but still coherent and broadly enjoyable, no meme edits",
  };

  return preset[v] ?? vibe;
}

function normalizeQuery(q: string): string {
  return q.replace(/\s+/g, " ").trim();
}

export async function GET(req: NextRequest) {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const location = (process.env.VERTEX_LOCATION?.trim() || "us-central1").trim();
  const modelId = (process.env.VERTEX_GEMINI_MODEL?.trim() || DEFAULT_MODEL_ID).trim();

  if (!project) {
    return NextResponse.json(
      { error: "GOOGLE_CLOUD_PROJECT is not configured" },
      { status: 500 }
    );
  }

  const vibeRaw = req.nextUrl.searchParams.get("vibe") ?? "";
  const vibe = vibeRaw.trim();
  if (!vibe) {
    return NextResponse.json({ error: "Missing vibe" }, { status: 400 });
  }

  const countParam = Number(req.nextUrl.searchParams.get("count") ?? "");
  const count = Number.isFinite(countParam)
    ? Math.max(3, Math.min(16, Math.floor(countParam)))
    : DEFAULT_COUNT;

  const vertex = new VertexAI({
    project,
    location,
    googleAuthOptions: vertexGoogleAuthOptions() as
      | Record<string, unknown>
      | undefined,
  });
  const model = vertex.getGenerativeModel({
    model: modelId,
    generationConfig: {
      temperature: 0.75,
      maxOutputTokens: 700,
    },
  });

  const vibePrompt = toVibePrompt(vibe);

  const prompt = [
    "Return ONLY valid JSON (no markdown, no code fences) with this exact shape:",
    `{"queries":[...]} `,
    "",
    `Task: generate exactly ${count} YouTube search queries for music tracks that fit this vibe:`,
    `"${vibePrompt}"`,
    "",
    "Rules:",
    '- Each query should look like a user search, e.g. "Artist - Song official audio".',
    '- Prefer official audio/video; avoid "live", "cover", "sped up", "nightcore", "8D".',
    "- Keep each query <= 80 characters.",
    "- Avoid duplicates and near-duplicates.",
    `- Output exactly ${count} queries.`,
  ].join("\n");

  let text = "";
  try {
    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });
    text =
      result.response.candidates?.[0]?.content?.parts
        ?.map((p) => ("text" in p ? String(p.text ?? "") : ""))
        .join("") ?? "";
  } catch (e) {
    return NextResponse.json(
      { error: "Vertex AI request failed", detail: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Model returned non-JSON", detail: text.slice(0, 250) },
      { status: 502 }
    );
  }

  const queries = (parsed as { queries?: unknown } | null)?.queries;
  if (!Array.isArray(queries)) {
    return NextResponse.json(
      { error: "Model returned invalid schema", detail: parsed },
      { status: 502 }
    );
  }

  const normalized = queries
    .filter((q): q is string => typeof q === "string")
    .map(normalizeQuery)
    .filter(Boolean);

  const uniq = Array.from(new Set(normalized)).slice(0, count);
  if (uniq.length < Math.min(3, count)) {
    return NextResponse.json(
      { error: "Model returned too few queries", detail: parsed },
      { status: 502 }
    );
  }

  return NextResponse.json({ queries: uniq });
}
