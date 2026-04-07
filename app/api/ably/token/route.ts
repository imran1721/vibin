import { NextResponse } from "next/server";
import { getAblyRest } from "@/lib/ably/server";

export async function GET() {
  try {
    const rest = getAblyRest();
    const tokenRequest = await rest.auth.createTokenRequest({
      clientId: `anon:${crypto.randomUUID()}`,
      ttl: 60 * 60 * 1000, // 1 hour
    });
    return NextResponse.json(tokenRequest);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Ably token error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

