import { NextRequest, NextResponse } from "next/server";
import { VertexAI } from "@google-cloud/vertexai";
import { vertexGoogleAuthOptions } from "@/lib/vertex-google-auth-options";

const DEFAULT_MODEL_ID = "gemini-2.0-flash-001";

function norm(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function extractFirstJsonObject(text: string): string | null {
  const s = text.trim();
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = (fenced?.[1] ?? s).trim();

  const firstBrace = candidate.indexOf("{");
  if (firstBrace === -1) return null;
  let depth = 0;
  for (let i = firstBrace; i < candidate.length; i++) {
    const ch = candidate[i];
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return candidate.slice(firstBrace, i + 1);
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  const project = process.env.GOOGLE_CLOUD_PROJECT?.trim();
  const location = (process.env.VERTEX_LOCATION?.trim() || "us-central1").trim();
  const modelId = (
    process.env.VERTEX_GEMINI_MODEL?.trim() || DEFAULT_MODEL_ID
  ).trim();

  if (!project) {
    return NextResponse.json(
      { error: "GOOGLE_CLOUD_PROJECT is not configured" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = norm((body as any)?.message ?? "");
  if (message.length < 1) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  const nowPlaying = norm((body as any)?.nowPlaying ?? "");
  const queueSize = Number((body as any)?.queueSize ?? 0);
  const guestCount = Number((body as any)?.guestCount ?? 0);

  const vertex = new VertexAI({
    project,
    location,
    googleAuthOptions: vertexGoogleAuthOptions() as
      | Record<string, unknown>
      | undefined,
  });

  const model = vertex.getGenerativeModel({
    model: modelId,
    generationConfig: { temperature: 0.75, maxOutputTokens: 450 },
  });

  const prompt = [
    "Return ONLY valid JSON (no markdown) with this exact shape:",
    `{"kind":"clarify"|"suggest","reply":"...","queries":[...]} `,
    "",
    "You are Vibin AI, a helpful music room assistant.",
    "",
    "Given the user's message, do ONE of:",
    "- kind=clarify: ask 1 short clarifying question (<= 120 chars), queries=[]",
    "- kind=suggest: reply with 1 short sentence (<= 140 chars), and include 6 YouTube search queries",
    "",
    "Context:",
    `- nowPlaying: ${nowPlaying ? `"${nowPlaying}"` : "(none)"}`,
    `- queueSize: ${Number.isFinite(queueSize) ? queueSize : 0}`,
    `- guestCount: ${Number.isFinite(guestCount) ? guestCount : 0}`,
    "",
    "User message:",
    JSON.stringify(message),
    "",
    "Rules for queries:",
    '- Query format: "Artist - Song official audio" or "Song - Artist official video".',
    '- Avoid: live, cover, remix, sped up, nightcore, 8D.',
    "- Keep each query <= 80 characters.",
    "- queries must be an array (empty for clarify).",
    "",
    "Decision policy:",
    "- If the message is vague (e.g. 'something good', 'play music', 'any songs?'), clarify.",
    "- If the message contains vibe/genre/artist/era constraints, suggest.",
    "- If they ask for a playlist or songs, suggest.",
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
      {
        error: "Vertex AI request failed",
        detail: e instanceof Error ? e.message : String(e),
      },
      { status: 502 }
    );
  }

  let parsed: unknown;
  try {
    const json = extractFirstJsonObject(text);
    if (!json) throw new Error("No JSON object found");
    parsed = JSON.parse(json);
  } catch {
    return NextResponse.json(
      { error: "Model returned non-JSON", detail: text.slice(0, 250) },
      { status: 502 }
    );
  }

  const kind = (parsed as any)?.kind;
  const reply = (parsed as any)?.reply;
  const queriesRaw = (parsed as any)?.queries;

  if (kind !== "clarify" && kind !== "suggest") {
    return NextResponse.json(
      { error: "Model returned invalid schema", detail: parsed },
      { status: 502 }
    );
  }
  if (typeof reply !== "string" || norm(reply).length === 0) {
    return NextResponse.json(
      { error: "Model returned invalid schema", detail: parsed },
      { status: 502 }
    );
  }

  const queries =
    Array.isArray(queriesRaw) && kind === "suggest"
      ? Array.from(
          new Set(
            queriesRaw
              .filter((q: unknown): q is string => typeof q === "string")
              .map(norm)
              .filter(Boolean)
          )
        ).slice(0, 8)
      : [];

  return NextResponse.json({
    kind,
    reply: norm(reply).slice(0, 240),
    queries,
  });
}

