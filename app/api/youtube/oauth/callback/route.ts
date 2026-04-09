import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { verifyYoutubeOAuthState } from "@/lib/youtube/oauth-state";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  if (err) {
    return NextResponse.redirect(
      new URL(`/?youtube_error=${encodeURIComponent(err)}`, request.url)
    );
  }

  if (!code || !stateRaw) {
    return NextResponse.redirect(
      new URL("/?youtube_error=missing_code", request.url)
    );
  }

  const state = verifyYoutubeOAuthState(stateRaw);
  if (!state) {
    return NextResponse.redirect(
      new URL("/?youtube_error=invalid_state", request.url)
    );
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.redirect(
      new URL("/?youtube_error=server_config", request.url)
    );
  }

  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const tokenJson = (await tokenRes.json()) as {
    refresh_token?: string;
    error?: string;
  };

  if (!tokenRes.ok || !tokenJson.refresh_token) {
    return NextResponse.redirect(
      new URL(
        `/?youtube_error=${encodeURIComponent(tokenJson.error ?? "token_exchange")}`,
        request.url
      )
    );
  }

  const admin = getSupabaseAdmin();
  const { error: upsertError } = await admin.from("youtube_credentials").upsert(
    {
      user_id: state.uid,
      refresh_token: tokenJson.refresh_token,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (upsertError) {
    return NextResponse.redirect(
      new URL("/?youtube_error=save_failed", request.url)
    );
  }

  // Ensure a taste_profiles row exists so Supabase / UI can show status (not only after first index run).
  await admin.from("taste_profiles").upsert(
    {
      user_id: state.uid,
      status: "not_started",
      error: null,
      indexed_at: null,
    },
    { onConflict: "user_id", ignoreDuplicates: true }
  );

  const target = new URL(state.returnTo, request.url);
  target.searchParams.set("youtube_connected", "1");
  return NextResponse.redirect(target);
}
