import Link from "next/link";
import { Suspense } from "react";
import { RoomClient } from "./RoomClient";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function RoomFallback() {
  return (
    <main className="mx-auto max-w-lg px-4 py-16 text-center">
      <p className="text-foreground/60 animate-pulse text-sm">Loading…</p>
    </main>
  );
}

export default async function RoomPage({
  params,
  searchParams,
}: {
  params: Promise<{ roomId: string }>;
  searchParams: Promise<{ h?: string }>;
}) {
  const { roomId } = await params;
  const { h } = await searchParams;

  if (!UUID_RE.test(roomId)) {
    return (
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-10">
        <h1 className="text-xl font-semibold">Invalid link</h1>
        <p className="text-foreground/70 text-sm">That room ID is not valid.</p>
        <Link href="/" className="text-amber-400 text-sm underline">
          Back home
        </Link>
      </main>
    );
  }

  return (
    <Suspense fallback={<RoomFallback />}>
      <RoomClient roomId={roomId} hostToken={h ?? null} />
    </Suspense>
  );
}
