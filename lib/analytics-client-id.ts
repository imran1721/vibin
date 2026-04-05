/** Stable per-browser id for analytics (survives tab close and return visits). */
const STORAGE_KEY = "vibin_analytics_client_id";

export function getOrCreateAnalyticsClientId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(STORAGE_KEY)?.trim();
    if (!id || id.length > 128) {
      id = crypto.randomUUID();
      window.localStorage.setItem(STORAGE_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}
