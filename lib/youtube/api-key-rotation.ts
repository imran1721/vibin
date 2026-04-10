type WithApiKeyResult = {
  response: Response;
  keyIndex: number;
};

function parseKeysFromEnv(): string[] {
  const raw = process.env.YOUTUBE_API_KEYS ?? "";
  return raw
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

async function readErrorReasonSafe(res: Response): Promise<string | null> {
  try {
    const data = (await res.clone().json()) as {
      error?: { errors?: Array<{ reason?: string }> };
    };
    const reason = data.error?.errors?.[0]?.reason;
    return typeof reason === "string" ? reason : null;
  } catch {
    return null;
  }
}

function shouldRotateKey(status: number, reason: string | null): boolean {
  if (status === 429) return true;
  if (status !== 403) return false;
  return (
    reason === "quotaExceeded" ||
    reason === "dailyLimitExceeded" ||
    reason === "userRateLimitExceeded" ||
    reason === "rateLimitExceeded"
  );
}

export function getYouTubeApiKeys(): string[] {
  return parseKeysFromEnv();
}

export async function fetchWithYouTubeApiKeyRotation(
  buildUrl: (apiKey: string) => string,
  init?: RequestInit
): Promise<WithApiKeyResult> {
  const keys = parseKeysFromEnv();
  if (keys.length === 0) {
    throw new Error("YOUTUBE_API_KEYS is not configured");
  }

  let lastResponse: Response | null = null;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const res = await fetch(buildUrl(key), init);
    lastResponse = res;

    if (res.ok) return { response: res, keyIndex: i };

    const reason = await readErrorReasonSafe(res);
    const canTryNext = i < keys.length - 1;
    if (!canTryNext || !shouldRotateKey(res.status, reason)) {
      return { response: res, keyIndex: i };
    }
  }

  return { response: lastResponse as Response, keyIndex: keys.length - 1 };
}
