import { GoogleAuth } from "google-auth-library";

/**
 * Returns an OAuth access token for calling Vertex REST APIs.
 *
 * Uses GOOGLE_APPLICATION_CREDENTIALS_JSON when present (Vercel),
 * otherwise falls back to ADC (local gcloud auth / runtime environment).
 */
export async function getGcpAccessToken(): Promise<string> {
  const scopes = ["https://www.googleapis.com/auth/cloud-platform"];
  const credentialsRaw = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON?.trim();
  const quotaProjectId =
    (process.env.GOOGLE_CLOUD_QUOTA_PROJECT?.trim() ||
      process.env.GOOGLE_CLOUD_PROJECT?.trim() ||
      "")?.trim() || undefined;

  const auth = credentialsRaw
    ? new GoogleAuth({
        scopes,
        // google-auth-library supports quotaProjectId at runtime, but types may lag.
        ...(quotaProjectId ? ({ quotaProjectId } as unknown as Record<string, unknown>) : {}),
        credentials: JSON.parse(credentialsRaw) as Record<string, unknown>,
      })
    : new GoogleAuth({
        scopes,
        ...(quotaProjectId ? ({ quotaProjectId } as unknown as Record<string, unknown>) : {}),
      });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = typeof tokenResponse === "string" ? tokenResponse : tokenResponse?.token;
  if (!token) throw new Error("Could not acquire GCP access token");
  return token;
}

