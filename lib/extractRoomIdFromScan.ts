const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Parse a guest room id from pasted text or a scanned QR payload (URL or raw UUID).
 */
export function extractRoomIdFromScan(text: string): string | null {
  const t = text.trim();
  if (!t) return null;
  const lower = t.toLowerCase();
  if (UUID_RE.test(lower)) return lower;

  const inPath = lower.match(
    /\/r\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i
  );
  if (inPath?.[1] && UUID_RE.test(inPath[1])) return inPath[1].toLowerCase();

  const anywhere = lower.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i
  );
  return anywhere && UUID_RE.test(anywhere[0])
    ? anywhere[0].toLowerCase()
    : null;
}
