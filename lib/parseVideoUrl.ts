export type ParsedVideo =
  | { provider: "youtube"; videoId: string; title: string; thumbUrl: string }
  | {
      provider: "direct";
      mediaUrl: string;
      title: string;
      thumbUrl: string | null;
    }
  | {
      provider: "embed";
      embedUrl: string;
      title: string;
      thumbUrl: string | null;
    };

const YT_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
]);

const DIRECT_EXTENSIONS = [
  ".mp4",
  ".m4v",
  ".webm",
  ".ogg",
  ".ogv",
  ".mov",
  ".mkv",
  ".m3u8",
  ".mpd",
];

function extractYouTubeId(u: URL): string | null {
  if (u.hostname === "youtu.be") {
    const seg = u.pathname.split("/").filter(Boolean)[0];
    return seg && /^[\w-]{6,}$/.test(seg) ? seg : null;
  }
  const v = u.searchParams.get("v");
  if (v && /^[\w-]{6,}$/.test(v)) return v;
  const parts = u.pathname.split("/").filter(Boolean);
  if (parts.length >= 2 && /^(embed|shorts|live|v)$/.test(parts[0])) {
    return /^[\w-]{6,}$/.test(parts[1]) ? parts[1] : null;
  }
  return null;
}

function looksLikeDirectMedia(u: URL): boolean {
  const path = u.pathname.toLowerCase();
  return DIRECT_EXTENSIONS.some((ext) => path.endsWith(ext));
}

function fileNameTitle(u: URL): string {
  const last = u.pathname.split("/").filter(Boolean).pop() ?? u.hostname;
  try {
    return decodeURIComponent(last).replace(/\.[^.]+$/, "") || u.hostname;
  } catch {
    return last || u.hostname;
  }
}

/** Rewrite watch-page URLs into their iframe-embed equivalents where well-known. */
function toEmbedUrl(u: URL): string {
  const host = u.hostname.replace(/^www\./, "");

  // Vimeo: vimeo.com/12345 → player.vimeo.com/video/12345
  if (host === "vimeo.com") {
    const id = u.pathname.split("/").filter(Boolean)[0];
    if (id && /^\d+$/.test(id)) {
      return `https://player.vimeo.com/video/${id}`;
    }
  }

  // Dailymotion: dailymotion.com/video/{id} → dailymotion.com/embed/video/{id}
  if (host === "dailymotion.com" || host === "dai.ly") {
    const parts = u.pathname.split("/").filter(Boolean);
    const id =
      host === "dai.ly"
        ? parts[0]
        : parts[0] === "video"
          ? parts[1]
          : parts.find((_, i, a) => i > 0 && a[i - 1] === "video");
    if (id) return `https://www.dailymotion.com/embed/video/${id}`;
  }

  // Twitch clip / video: needs parent= which is set by player at runtime if available.
  // Fall through to default — embed will be the original URL.

  return u.toString();
}

export function parseVideoUrl(raw: string): ParsedVideo | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  if (YT_HOSTS.has(url.hostname)) {
    const id = extractYouTubeId(url);
    if (!id) return null;
    return {
      provider: "youtube",
      videoId: id,
      title: `YouTube video ${id}`,
      thumbUrl: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    };
  }

  if (looksLikeDirectMedia(url)) {
    return {
      provider: "direct",
      mediaUrl: url.toString(),
      title: fileNameTitle(url),
      thumbUrl: null,
    };
  }

  return {
    provider: "embed",
    embedUrl: toEmbedUrl(url),
    title: fileNameTitle(url) || url.hostname,
    thumbUrl: null,
  };
}
