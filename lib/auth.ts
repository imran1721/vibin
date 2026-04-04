import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureAnonymousSession(supabase: SupabaseClient): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) return;
  const { error } = await supabase.auth.signInAnonymously();
  if (error) throw error;
}
