import { NextRequest, NextResponse } from "next/server";
import { getBearerToken } from "@/lib/api-auth";
import { createSupabaseUserClient } from "@/lib/supabase/user-client";
import { signYoutubeOAuthState } from "@/lib/youtube/oauth-state";

const SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

export async function POST(request: NextRequest) {
  try {
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

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI;
    if (!clientId || !redirectUri) {
      return NextResponse.json(
        { error: "Server missing GOOGLE_CLIENT_ID or YOUTUBE_OAUTH_REDIRECT_URI" },
        { status: 500 }
      );
    }

    let returnTo = "/";
    try {
      const body = (await request.json()) as { returnTo?: string };
      if (
        typeof body.returnTo === "string" &&
        body.returnTo.startsWith("/") &&
        !body.returnTo.startsWith("//")
      ) {
        returnTo = body.returnTo;
      }
    } catch {
      /* no body */
    }

    const state = signYoutubeOAuthState({
      uid: user.id,
      returnTo,
      exp: Date.now() + 15 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPE,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });

    const url = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OAuth start failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
