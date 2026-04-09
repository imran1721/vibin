import { getGcpAccessToken } from "@/lib/gcp-access-token";

function env(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing ${name}`);
  return v;
}

/** Optional; must match Vector Search index dimension. */
export function parseEmbeddingOutputDimension(): number | undefined {
  const raw = process.env.VERTEX_EMBEDDING_OUTPUT_DIMENSION?.trim();
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return n;
}

function predictUrl(location: string, project: string, model: string): string {
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${encodeURIComponent(
    model
  )}:predict`;
}

/**
 * Vertex text embeddings for indexing and query. Uses VERTEX_EMBEDDINGS_MODEL and optional
 * VERTEX_EMBEDDING_OUTPUT_DIMENSION (must match the Vector Search index dimension).
 *
 * - `text-embedding-004` / `text-embedding-005`: batch predict, max output 768.
 * - `gemini-embedding-001`: one text per request; supports outputDimensionality up to 3072.
 */
export async function embedTextsVertex(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const project = env("GOOGLE_CLOUD_PROJECT");
  const location = (process.env.VERTEX_LOCATION?.trim() || "us-central1").trim();
  const model = (process.env.VERTEX_EMBEDDINGS_MODEL?.trim() || "text-embedding-004").trim();
  const outputDim = parseEmbeddingOutputDimension();
  const token = await getGcpAccessToken();
  const url = predictUrl(location, project, model);

  const parameters =
    outputDim !== undefined
      ? { autoTruncate: true, outputDimensionality: outputDim }
      : undefined;

  const isGeminiEmbedding =
    model.startsWith("gemini-embedding-") || model.includes("gemini-embedding");

  if (isGeminiEmbedding) {
    const vectors: number[][] = [];
    for (const content of texts) {
      const body: Record<string, unknown> = {
        instances: [{ content }],
        ...(parameters ? { parameters } : {}),
      };
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Embeddings failed: ${res.status} ${txt.slice(0, 400)}`);
      }
      const data = (await res.json()) as {
        predictions?: Array<{ embeddings?: { values?: number[] } }>;
      };
      const v = data.predictions?.[0]?.embeddings?.values ?? [];
      if (v.length === 0) throw new Error("Embeddings returned empty vector");
      vectors.push(v);
    }
    return vectors;
  }

  if (outputDim !== undefined && outputDim > 768 && !isGeminiEmbedding) {
    throw new Error(
      `VERTEX_EMBEDDING_OUTPUT_DIMENSION=${outputDim} is incompatible with ${model} (max 768). ` +
        `Either set VERTEX_EMBEDDINGS_MODEL=gemini-embedding-001, or recreate your Vector Search index with dimension 768.`
    );
  }

  const body: Record<string, unknown> = {
    instances: texts.map((t) => ({ content: t })),
    ...(parameters ? { parameters } : {}),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Embeddings failed: ${res.status} ${txt.slice(0, 400)}`);
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

export async function embedTextVertex(text: string): Promise<number[]> {
  const v = await embedTextsVertex([text]);
  const first = v[0];
  if (!first) throw new Error("Embeddings returned empty vector");
  return first;
}
