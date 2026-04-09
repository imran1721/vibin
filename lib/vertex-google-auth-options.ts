/**
 * Vertex on Vercel/serverless: set GOOGLE_APPLICATION_CREDENTIALS_JSON to the
 * full service account JSON (Vercel → Environment Variables → paste JSON, mark secret).
 * Local dev: omit it and use `gcloud auth application-default login` (ADC).
 */
export function vertexGoogleAuthOptions():
  | Record<string, unknown>
  | undefined {
  const quotaProject = (
    process.env.GOOGLE_CLOUD_QUOTA_PROJECT?.trim() ||
    process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
    ""
  ).trim();

  const raw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
  let credentials: Record<string, unknown> | undefined;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        credentials = parsed as Record<string, unknown>;
      }
    } catch {
      // Invalid JSON — omit credentials so the error surfaces from the client.
    }
  }

  const out: Record<string, unknown> = {};
  if (quotaProject) out.quotaProjectId = quotaProject;
  if (credentials) out.credentials = credentials;

  if (Object.keys(out).length === 0) return undefined;
  return out;
}
