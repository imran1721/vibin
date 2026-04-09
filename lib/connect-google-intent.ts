const INTENT_KEY = "vibin_connect_google_intent";
const RETURN_TO_KEY = "vibin_connect_google_return_to";

export function setConnectGoogleIntent(returnTo: string): void {
  try {
    sessionStorage.setItem(INTENT_KEY, "1");
    sessionStorage.setItem(RETURN_TO_KEY, returnTo);
  } catch {
    /* private mode */
  }
}

export function readConnectGoogleIntent(): { active: boolean; returnTo: string } {
  try {
    const active = sessionStorage.getItem(INTENT_KEY) === "1";
    const returnTo = sessionStorage.getItem(RETURN_TO_KEY) || "/";
    return { active, returnTo };
  } catch {
    return { active: false, returnTo: "/" };
  }
}

export function clearConnectGoogleIntent(): void {
  try {
    sessionStorage.removeItem(INTENT_KEY);
    sessionStorage.removeItem(RETURN_TO_KEY);
  } catch {
    /* */
  }
}

