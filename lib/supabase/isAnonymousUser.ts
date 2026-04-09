import type { User } from "@supabase/supabase-js";

/**
 * Supabase anonymous sessions are device-local and should not be used for
 * storing account-derived preference data (e.g. YouTube profile / RAG corpus).
 *
 * Supabase has evolved its user shape; we check a few known fields.
 */
export function isAnonymousUser(user: User | null | undefined): boolean {
  if (!user) return true;
  const anyUser = user as unknown as Record<string, unknown>;
  if (anyUser.is_anonymous === true) return true;

  const app = anyUser.app_metadata as Record<string, unknown> | undefined;
  const provider = typeof app?.provider === "string" ? app.provider : "";
  if (provider === "anonymous") return true;

  const identities = anyUser.identities as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(identities)) {
    if (identities.some((i) => i?.provider === "anonymous")) return true;
  }

  return false;
}

