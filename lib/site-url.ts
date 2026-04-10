/**
 * Canonical site origin for metadata, sitemap, and JSON-LD.
 * Set `NEXT_PUBLIC_SITE_URL` in production (e.g. https://vibin.click).
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  if (process.env.VERCEL_URL)
    return `https://${process.env.VERCEL_URL.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3000";
}
