import { NextResponse } from "next/server";
import { getBearerToken } from "@/lib/api-auth";
import { getClientIp } from "@/lib/get-client-ip";
import { createSupabaseUserClient } from "@/lib/supabase/user-client";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

type Body = {
  phase?: string;
  clientSessionId?: string;
  timezone?: string;
  screenWidth?: number;
  screenHeight?: number;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clientSessionId =
    typeof body.clientSessionId === "string"
      ? body.clientSessionId.trim()
      : "";
  if (!clientSessionId || clientSessionId.length > 128) {
    return NextResponse.json(
      { error: "clientSessionId required" },
      { status: 400 }
    );
  }

  let admin;
  try {
    admin = getSupabaseAdmin();
  } catch {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 500 }
    );
  }

  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent")?.slice(0, 2048) ?? null;

  let userId: string | null = null;
  const token = getBearerToken(request);
  if (token) {
    try {
      const supabase = createSupabaseUserClient(token);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      /* ignore invalid token */
    }
  }

  if (body.phase === "start") {
    const timezone =
      typeof body.timezone === "string" ? body.timezone.slice(0, 128) : null;
    const screenWidth =
      typeof body.screenWidth === "number" && Number.isFinite(body.screenWidth)
        ? Math.round(Math.min(Math.max(body.screenWidth, 0), 99999))
        : null;
    const screenHeight =
      typeof body.screenHeight === "number" &&
      Number.isFinite(body.screenHeight)
        ? Math.round(Math.min(Math.max(body.screenHeight, 0), 99999))
        : null;

    const { data, error } = await admin
      .from("analytics_sessions")
      .insert({
        client_session_id: clientSessionId,
        user_id: userId,
        ip,
        user_agent: userAgent,
        timezone,
        screen_width: screenWidth,
        screen_height: screenHeight,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[analytics/session] insert", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, id: data?.id });
  }

  if (body.phase === "end") {
    const { data: row, error: fetchError } = await admin
      .from("analytics_sessions")
      .select("id, started_at")
      .eq("client_session_id", clientSessionId)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fetchError) {
      console.error("[analytics/session] select end", fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }
    if (!row?.id) {
      return NextResponse.json({ ok: true, skipped: true });
    }

    const endedAt = new Date().toISOString();
    const started = new Date(row.started_at as string).getTime();
    const ended = Date.now();
    const durationSeconds = Math.max(
      0,
      Math.round((ended - started) / 1000)
    );

    const { error: updError } = await admin
      .from("analytics_sessions")
      .update({
        ended_at: endedAt,
        duration_seconds: durationSeconds,
      })
      .eq("id", row.id);

    if (updError) {
      console.error("[analytics/session] update end", updError);
      return NextResponse.json({ error: updError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Invalid phase" }, { status: 400 });
}
