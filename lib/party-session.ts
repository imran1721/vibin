import type { SupabaseClient } from "@supabase/supabase-js";
import { clearDisplayProfileStorage } from "@/lib/displayName";

export const GUEST_VIDEO_PREF_KEY = "vibin_guest_show_synced_video";

const PARTY_ROOM_SESSION_KEY = "vibin_party_room_id";
const HOST_ROOM_STORAGE_KEY = "vibin_host_room";

export type StoredHostRoom = {
  roomId: string;
  hostToken: string;
  storedAt: string;
};

export function readGuestShowSyncedVideoPref(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(GUEST_VIDEO_PREF_KEY) === "1";
  } catch {
    return false;
  }
}

export function setStoredPartyRoomId(roomId: string): void {
  try {
    sessionStorage.setItem(PARTY_ROOM_SESSION_KEY, roomId);
  } catch {
    /* private mode */
  }
}

export function clearStoredPartyRoomId(): void {
  try {
    sessionStorage.removeItem(PARTY_ROOM_SESSION_KEY);
  } catch {
    /* private mode */
  }
}

export function setStoredHostRoom(roomId: string, hostToken: string): void {
  if (typeof window === "undefined") return;
  const rid = roomId.trim();
  const tok = hostToken.trim();
  if (!rid || !tok) return;
  const payload: StoredHostRoom = {
    roomId: rid,
    hostToken: tok,
    storedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(HOST_ROOM_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    /* private mode */
  }
}

export function readStoredHostRoom(): StoredHostRoom | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(HOST_ROOM_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredHostRoom> | null;
    if (
      !parsed ||
      typeof parsed.roomId !== "string" ||
      typeof parsed.hostToken !== "string"
    ) {
      return null;
    }
    const roomId = parsed.roomId.trim();
    const hostToken = parsed.hostToken.trim();
    if (!roomId || !hostToken) return null;
    return {
      roomId,
      hostToken,
      storedAt:
        typeof parsed.storedAt === "string" ? parsed.storedAt : new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function clearStoredHostRoom(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(HOST_ROOM_STORAGE_KEY);
  } catch {
    /* private mode */
  }
}

/** `false` when this tab is already “in” this room (e.g. refresh). `true` for a new room or first open. */
export function shouldResetPartySessionForRoom(roomId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(PARTY_ROOM_SESSION_KEY) !== roomId;
  } catch {
    return true;
  }
}

/**
 * Clears room-specific markers without logging out.
 * Use this when navigating between rooms / back home but the user should keep their session
 * (e.g. to preserve connected YouTube credentials tied to the current Supabase user).
 */
export function clearPartyRoomState(): void {
  clearStoredPartyRoomId();
}

/** Sign out, clear display name profile, guest-video pref, and party room marker. */
export async function clearPartySession(supabase: SupabaseClient): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    /* network / missing client */
  }
  clearDisplayProfileStorage();
  try {
    sessionStorage.removeItem(GUEST_VIDEO_PREF_KEY);
  } catch {
    /* */
  }
  clearStoredPartyRoomId();
  clearStoredHostRoom();
}
