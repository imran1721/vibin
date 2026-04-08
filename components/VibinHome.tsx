"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureAnonymousSession } from "@/lib/auth";
import { JoinRoomLoader } from "@/components/JoinRoomLoader";
import { JoinRoomQrDialog } from "@/components/JoinRoomQrDialog";
import { PwaInstallOption } from "@/components/PwaInstallOption";
import { VibinMark } from "@/components/VibinMark";
import { LegalFooter } from "@/components/LegalFooter";
import {
  clearPartySession,
  readStoredHostRoom,
  setStoredHostRoom,
} from "@/lib/party-session";

const scanQrBtnClass =
  "border-border text-foreground hover:bg-muted active:bg-muted/80 focus-visible:ring-ring inline-flex min-h-11 w-full items-center justify-center rounded-2xl border border-dashed px-5 py-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function VibinHome() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joinNavigating, setJoinNavigating] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const stored = readStoredHostRoom();
    if (!stored) return;
    setJoinNavigating(true);
    router.replace(
      `/r/${stored.roomId}?h=${encodeURIComponent(stored.hostToken)}`
    );
  }, [router]);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    void (async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        setHasSession(!!session);
        const { data } = supabase.auth.onAuthStateChange((_evt, next) => {
          setHasSession(!!next);
        });
        unsub = () => data.subscription.unsubscribe();
      } catch {
        setHasSession(false);
      }
    })();
    return () => {
      if (unsub) unsub();
    };
  }, []);

  async function startRoom() {
    setError(null);
    setBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await ensureAnonymousSession(supabase);
      const { data, error: rpcError } = await supabase.rpc("create_room", {
        p_title: null,
      });
      if (rpcError) throw rpcError;
      const row = data as { id?: string; host_token?: string } | null;
      if (!row?.id || !row?.host_token) {
        throw new Error("Unexpected response from server");
      }
      setStoredHostRoom(row.id, row.host_token);
      router.push(
        `/r/${row.id}?h=${encodeURIComponent(row.host_token)}&new=1`
      );
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not create room. Check Supabase and Anonymous auth."
      );
    } finally {
      setBusy(false);
    }
  }

  function onQrDecoded(roomId: string) {
    setError(null);
    setJoinNavigating(true);
    router.push(`/r/${roomId}`);
  }

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col gap-10 sm:max-w-lg">
      {busy || joinNavigating ? (
        <div className="vibin-page-bg fixed inset-0 z-[80]">
          <JoinRoomLoader variant="overlay" creating={busy} />
        </div>
      ) : null}
      <header className="space-y-3">
        <p className="text-accent font-display text-sm font-semibold tracking-wide">
          YouTube listening party
        </p>
        <h1 className="font-display text-foreground flex flex-wrap items-center gap-2 text-5xl font-extrabold leading-none tracking-tight sm:gap-3 sm:text-6xl">
          <VibinMark className="size-[3.25rem] sm:size-16" />
          <span className="-translate-y-1 sm:-translate-y-0.5">Vibin</span>
        </h1>
        <p className="text-muted-foreground max-w-prose text-base leading-relaxed sm:text-[1.05rem]">
          Create a room and share a link or QR invite. You run playback on one
          device; everyone else queues YouTube videos from their phones and stays
          in sync.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void startRoom()}
          className="bg-primary text-primary-foreground focus-visible:ring-ring hover:brightness-105 active:brightness-95 inline-flex min-h-12 w-full items-center justify-center rounded-2xl px-6 py-3.5 text-base font-bold shadow-lg shadow-black/20 transition-[filter,transform] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:shadow-black/50 enabled:active:scale-[0.99] motion-reduce:enabled:active:scale-100 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {busy ? "Starting…" : "Start a room"}
        </button>
      </div>

      <div className="border-border flex flex-col gap-3 border-t pt-8">
        <p className="text-foreground text-sm font-semibold">Join a room</p>
        <p className="text-muted-foreground -mt-1 text-sm leading-relaxed">
          Scan the QR code from the host&apos;s invite.
        </p>
        <button
          type="button"
          disabled={joinNavigating}
          onClick={() => setScanOpen(true)}
          className={`${scanQrBtnClass} disabled:cursor-not-allowed disabled:opacity-50`}
        >
          Scan QR code
        </button>
      </div>

      <div className="border-border flex flex-col gap-3 border-t pt-8">
        <PwaInstallOption />
      </div>

      {hasSession ? (
        <div className="border-border flex flex-col gap-3 border-t pt-8">
          <button
            type="button"
            disabled={busy || joinNavigating}
            onClick={() => {
              setError(null);
              setBusy(true);
              void (async () => {
                try {
                  const supabase = getSupabaseBrowserClient();
                  await clearPartySession(supabase);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Could not log out");
                } finally {
                  setBusy(false);
                }
              })();
            }}
            className="border-border text-foreground hover:bg-muted active:bg-muted/80 focus-visible:ring-ring inline-flex min-h-11 w-full items-center justify-center rounded-2xl border px-5 py-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-55"
          >
            {busy ? "Logging out…" : "Log out"}
          </button>
          <p className="text-muted-foreground -mt-1 text-xs leading-relaxed">
            Logging out will disconnect your saved YouTube connection on this device
            (you can reconnect anytime).
          </p>
        </div>
      ) : null}

      <LegalFooter />

      <JoinRoomQrDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onDecoded={onQrDecoded}
      />

      {error && (
        <div
          className="border-destructive/35 bg-destructive/10 rounded-2xl border px-4 py-3"
          role="alert"
        >
          <p className="text-destructive text-sm font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}
