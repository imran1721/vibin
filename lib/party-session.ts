import type { SupabaseClient } from "@supabase/supabase-js";
import { clearDisplayProfileStorage } from "@/lib/displayName";

export const GUEST_VIDEO_PREF_KEY = "vibin_guest_show_synced_video";

const PARTY_ROOM_SESSION_KEY = "vibin_party_room_id";

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

/** `false` when this tab is already “in” this room (e.g. refresh). `true` for a new room or first open. */
export function shouldResetPartySessionForRoom(roomId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(PARTY_ROOM_SESSION_KEY) !== roomId;
  } catch {
    return true;
  }
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
}
