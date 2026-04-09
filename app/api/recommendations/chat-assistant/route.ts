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

  const bodyObj =
    body && typeof body === "object" ? (body as Record<string, unknown>) : null;

  const message = norm(
    typeof bodyObj?.message === "string" ? bodyObj.message : ""
  );
  if (message.length < 1) {
    return NextResponse.json({ error: "Missing message" }, { status: 400 });
  }

  const nowPlaying = norm(
    typeof bodyObj?.nowPlaying === "string" ? bodyObj.nowPlaying : ""
  );
  const queueSize = Number(
    typeof bodyObj?.queueSize === "number" || typeof bodyObj?.queueSize === "string"
      ? bodyObj.queueSize
      : 0
  );
  const guestCount = Number(
    typeof bodyObj?.guestCount === "number" || typeof bodyObj?.guestCount === "string"
      ? bodyObj.guestCount
      : 0
  );

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
    "You are Vibin AI, a helpful assistant for a shared YouTube watch queue (music, comedy, docs, gaming, sports, podcasts-as-video, tutorials — anything on YouTube).",
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
    "- Natural YouTube search strings that will surface the right full videos — e.g. song titles, sketch names, documentary titles, creator + topic, game + highlight, recipe channel + dish.",
    "- Match what they asked: music-only if they asked for songs; non-music if they asked for something else.",
    '- Prefer official or reputable uploads; avoid spammy modifiers (sped up, nightcore, 8D, "part 99") unless they fit the request.',
    "- Keep each query <= 80 characters.",
    "- queries must be an array (empty for clarify).",
    "",
    "Decision policy:",
    "- If the message is vague (e.g. 'something good', 'anything fun', 'what should we watch?'), clarify.",
    "- If they name a genre, artist, show, sport, game, topic, era, or mood, suggest.",
    "- If they ask for videos, a queue, recommendations, or 'find me…', suggest.",
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

  const parsedObj =
    parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  const kind = parsedObj?.kind;
  const reply = parsedObj?.reply;
  const queriesRaw = parsedObj?.queries;

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

