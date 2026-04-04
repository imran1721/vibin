import { createHmac, timingSafeEqual } from "crypto";

export type YoutubeOAuthStatePayload = {
  uid: string;
  returnTo: string;
  exp: number;
};

function getSecret(): string {
  const s = process.env.YOUTUBE_OAUTH_STATE_SECRET;
  if (!s || s.length < 16) {
    throw new Error("Missing or weak YOUTUBE_OAUTH_STATE_SECRET");
  }
  return s;
}

export function signYoutubeOAuthState(payload: YoutubeOAuthStatePayload): string {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", getSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyYoutubeOAuthState(token: string): YoutubeOAuthStatePayload | null {
  const last = token.lastIndexOf(".");
  if (last === -1) return null;
  const body = token.slice(0, last);
  const sig = token.slice(last + 1);
  const expected = createHmac("sha256", getSecret()).update(body).digest("base64url");
  try {
    const a = Buffer.from(sig, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const json = Buffer.from(body, "base64url").toString("utf8");
    const data = JSON.parse(json) as YoutubeOAuthStatePayload;
    if (!data.uid || typeof data.returnTo !== "string" || typeof data.exp !== "number") {
      return null;
    }
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}
