const LEGACY_KEY = "jam_display_name";
const PROFILE_KEY = "jam_display_profile_v1";

const MAX_NAME_LEN = 40;

export type DisplayProfileChoice = "named" | "anonymous";

type StoredProfile = {
  v: 1;
  choice: DisplayProfileChoice;
  name?: string;
  anonymousAlias?: string;
  avatarDataUrl?: string;
};

const QUIRKY_ALIASES = [
  "awkward giraffe",
  "sleepy llama",
  "chaotic panda",
  "dramatic flamingo",
  "confused penguin",
  "grumpy koala",
  "sneaky raccoon",
  "nervous alpaca",
  "dancing otter",
  "clumsy turtle",
  "curious cat",
  "hyper monkey",
  "shy fox",
  "lazy sloth",
  "spicy squirrel",
  "spicy potato",
  "crispy taco",
  "sleepy noodle",
  "angry samosa",
  "melting pizza",
  "confused pickle",
  "dancing donut",
  "sneaky biscuit",
  "wobbly jelly",
  "dramatic momo",
  "glitchy pixel",
  "laggy potato",
  "buffering human",
  "cosmic noodle",
  "jittery jelly",
  "vibin blob",
  "loopy signal",
  "pixel ghost",
  "sleepy bot",
  "chaotic byte",
  "invisible sandwich",
  "screaming muffin",
  "flying toaster",
  "broken banana",
  "sarcastic pancake",
  "confused ceiling",
  "dancing chair",
  "angry cloud",
] as const;

export function createQuirkyAlias(): string {
  const alias = QUIRKY_ALIASES[Math.floor(Math.random() * QUIRKY_ALIASES.length)];
  return alias.slice(0, MAX_NAME_LEN);
}

function parseProfile(raw: string | null): StoredProfile | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as StoredProfile;
    if (
      o?.v === 1 &&
      (o.choice === "named" || o.choice === "anonymous")
    ) {
      return o;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function readStoredProfile(): StoredProfile | null {
  if (typeof window === "undefined") return null;
  migrateLegacy();
  try {
    return parseProfile(window.localStorage.getItem(PROFILE_KEY));
  } catch {
    return null;
  }
}

/** One-time: old single key → structured profile so existing users skip the gate. */
function migrateLegacy(): void {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(PROFILE_KEY)) return;
    const leg = window.localStorage.getItem(LEGACY_KEY);
    if (!leg?.trim()) return;
    const p: StoredProfile = {
      v: 1,
      choice: "named",
      name: leg.trim().slice(0, MAX_NAME_LEN),
    };
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}

export function hasCompletedDisplayProfile(): boolean {
  if (typeof window === "undefined") return false;
  migrateLegacy();
  try {
    return !!window.localStorage.getItem(PROFILE_KEY);
  } catch {
    return false;
  }
}

function getOrCreateAnonymousAlias(profile: StoredProfile): string {
  const existing = profile.anonymousAlias?.trim();
  if (existing) return existing.slice(0, MAX_NAME_LEN);

  const generated = createQuirkyAlias();
  const next: StoredProfile = { ...profile, anonymousAlias: generated };
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
  return generated;
}

/** For `queue_items.added_by`: returns saved name or persisted quirky alias. */
export function getQueueAttributionLabel(): string | null {
  if (typeof window === "undefined") return null;
  migrateLegacy();
  try {
    const p = parseProfile(window.localStorage.getItem(PROFILE_KEY));
    if (!p) return null;
    if (p.choice === "anonymous") return getOrCreateAnonymousAlias(p);
    const n = p.name?.trim();
    return n && n.length > 0 ? n.slice(0, MAX_NAME_LEN) : null;
  } catch {
    return null;
  }
}

export function shouldBroadcastActivity(): boolean {
  return getQueueAttributionLabel() != null;
}

export function saveDisplayProfileNamed(name: string): void {
  const t = name.trim().slice(0, MAX_NAME_LEN);
  const prev = readStoredProfile();
  if (!t) {
    saveDisplayProfileAnonymous();
    return;
  }
  const p: StoredProfile = {
    v: 1,
    choice: "named",
    name: t,
    avatarDataUrl: prev?.avatarDataUrl,
  };
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}

export function saveDisplayProfileAnonymous(): void {
  const prev = readStoredProfile();
  const alias =
    prev?.anonymousAlias?.trim().slice(0, MAX_NAME_LEN) || createQuirkyAlias();
  const p: StoredProfile = {
    v: 1,
    choice: "anonymous",
    anonymousAlias: alias,
    avatarDataUrl: prev?.avatarDataUrl,
  };
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}

/** Clears saved name / anonymous choice (e.g. leaving a party or joining a different room). */
export function clearDisplayProfileStorage(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(PROFILE_KEY);
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    /* private mode */
  }
}

export function getDisplayAvatarDataUrl(): string | null {
  const p = readStoredProfile();
  const avatar = p?.avatarDataUrl?.trim();
  if (!avatar) return null;
  return avatar.startsWith("data:image/") ? avatar : null;
}

export function saveDisplayAvatarDataUrl(dataUrl: string | null): void {
  const prev = readStoredProfile();
  const next: StoredProfile = prev ?? { v: 1, choice: "anonymous" };
  const cleaned = dataUrl?.trim() ?? "";
  if (cleaned && cleaned.startsWith("data:image/")) {
    next.avatarDataUrl = cleaned;
  } else {
    delete next.avatarDataUrl;
  }
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(next));
  } catch {
    /* private mode */
  }
}

/**
 * @deprecated Prefer {@link getQueueAttributionLabel} for queue rows.
 * Returns a non-null fallback for legacy call sites.
 */
export function getOrCreateDisplayName(): string {
  return getQueueAttributionLabel() ?? "Anonymous";
}
