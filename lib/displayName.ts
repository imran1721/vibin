const LEGACY_KEY = "jam_display_name";
const PROFILE_KEY = "jam_display_profile_v1";

const MAX_NAME_LEN = 40;

export type DisplayProfileChoice = "named" | "anonymous";

type StoredProfile = {
  v: 1;
  choice: DisplayProfileChoice;
  name?: string;
};

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

/** For `queue_items.added_by`: `null` when anonymous. */
export function getQueueAttributionLabel(): string | null {
  if (typeof window === "undefined") return null;
  migrateLegacy();
  try {
    const p = parseProfile(window.localStorage.getItem(PROFILE_KEY));
    if (!p) return null;
    if (p.choice === "anonymous") return null;
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
  if (!t) {
    saveDisplayProfileAnonymous();
    return;
  }
  const p: StoredProfile = { v: 1, choice: "named", name: t };
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
  } catch {
    /* private mode */
  }
}

export function saveDisplayProfileAnonymous(): void {
  const p: StoredProfile = { v: 1, choice: "anonymous" };
  try {
    window.localStorage.setItem(PROFILE_KEY, JSON.stringify(p));
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
