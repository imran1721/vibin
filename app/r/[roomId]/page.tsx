import Link from "next/link";
import { Suspense } from "react";
import { JoinRoomLoader } from "@/components/JoinRoomLoader";
import { RoomClient } from "./RoomClient";

export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const linkClass =
  "text-accent focus-visible:ring-ring inline-flex min-h-11 items-center rounded-lg text-sm font-semibold underline underline-offset-4 transition-colors hover:brightness-110 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function RoomFallback() {
  return (
    <main className="vibin-page-bg mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col items-center justify-center px-[clamp(1rem,4vw,1.5rem)]">
      <JoinRoomLoader />
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
      <main className="vibin-page-bg mx-auto flex max-w-lg flex-col gap-5 px-[clamp(1rem,4vw,1.75rem)] py-10 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <h1 className="font-display text-xl font-bold">Invalid link</h1>
        <p className="text-muted-foreground text-sm">
          That room ID is not valid.
        </p>
        <Link href="/" className={linkClass}>
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
