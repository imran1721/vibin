import { NextRequest, NextResponse } from "next/server";
import { getBearerToken } from "@/lib/api-auth";
import { createSupabaseUserClient } from "@/lib/supabase/user-client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseUserClient(token);
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  try {
    const admin = getSupabaseAdmin();
    const { error } = await admin
      .from("youtube_credentials")
      .delete()
      .eq("user_id", user.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } catch {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
