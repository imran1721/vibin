"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureAnonymousSession } from "@/lib/auth";
import { HomeHeroMock } from "@/components/HomeHeroMock";
import { JoinRoomLoader } from "@/components/JoinRoomLoader";
import { JoinRoomQrDialog } from "@/components/JoinRoomQrDialog";
import { LiveRoomsPreview } from "@/components/LiveRoomsPreview";
import { PwaInstallOption } from "@/components/PwaInstallOption";
import { AppBrandLockup } from "@/components/AppBrandLockup";
import { LegalFooter } from "@/components/LegalFooter";
import {
  clearPartySession,
  readStoredHostRoom,
  setStoredHostRoom,
} from "@/lib/party-session";

const demoRoomId =
  typeof process.env.NEXT_PUBLIC_DEMO_ROOM_ID === "string"
    ? process.env.NEXT_PUBLIC_DEMO_ROOM_ID.trim()
    : "";

const primaryBtn =
  "bg-primary text-primary-foreground focus-visible:ring-ring hover:brightness-105 active:brightness-95 inline-flex min-h-14 w-full items-center justify-center rounded-2xl px-6 text-base font-bold shadow-lg shadow-black/15 transition-[filter,transform] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:shadow-black/45 enabled:active:scale-[0.99] motion-reduce:enabled:active:scale-100 disabled:cursor-not-allowed disabled:opacity-55";

const secondaryBtn =
  "border-border bg-card/70 text-foreground hover:bg-muted/80 focus-visible:ring-ring inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border px-6 text-base font-bold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

const ghostBtn =
  "border-border text-foreground hover:bg-muted/60 focus-visible:ring-ring inline-flex min-h-12 w-full items-center justify-center rounded-xl border px-4 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-55";

const subtleCard =
  "border-border/60 bg-card/40 rounded-2xl border px-4 py-4 sm:px-5";

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
      setJoinNavigating(true);
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

  function tryDemoRoom() {
    if (!demoRoomId) return;
    setError(null);
    setJoinNavigating(true);
    router.push(`/r/${demoRoomId}`);
  }

  return (
    <div className="relative mx-auto flex w-full max-w-md flex-col gap-5 sm:gap-6 sm:max-w-lg">
      {busy || joinNavigating ? (
        <div className="vibin-page-bg fixed inset-0 z-[80]">
          <JoinRoomLoader variant="overlay" creating={busy} />
        </div>
      ) : null}

      {error ? (
        <div
          className="border-destructive/35 bg-destructive/10 rounded-2xl border px-4 py-3"
          role="alert"
        >
          <p className="text-destructive text-sm font-medium">{error}</p>
        </div>
      ) : null}

      {/* Hero — value prop + CTAs first (conversion) */}
      <section className="space-y-5">
        <AppBrandLockup />

        <div className="space-y-3">
          <h1 className="font-display text-foreground text-[1.9rem] font-extrabold leading-[1.05] tracking-tight sm:text-4xl">
            Watch YouTube together. Instantly.
          </h1>
          <p className="text-muted-foreground max-w-[22rem] text-[1.05rem] leading-snug sm:text-lg">
            Start your own private watch party in one tap, or hop into a public
            room that&apos;s already vibing. Chat and react live—no login, no
            installs.
          </p>
        </div>

        <div className="flex flex-col gap-3 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => void startRoom()}
            className={primaryBtn}
          >
            {busy ? "Starting…" : "Start a Room"}
          </button>
          <button
            type="button"
            disabled={joinNavigating}
            onClick={() => setScanOpen(true)}
            className={secondaryBtn}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="text-muted-foreground size-5 shrink-0"
              aria-hidden
            >
              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
            </svg>
            Join a Room
          </button>
          <p className="text-muted-foreground px-1 text-center text-xs leading-snug">
            Join a room with your camera — or open a link someone sent you in
            the browser.
          </p>
        </div>
      </section>

      <LiveRoomsPreview />

      {/* <HomeHeroMock /> */}

      {/* How it works */}
      <section aria-labelledby="how-heading" className="space-y-1">
        <h2
          id="how-heading"
          className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
        >
          How it works
        </h2>
        <ol className="grid grid-cols-3 gap-2 pt-2">
          {[
            { n: "1", title: "Create", desc: "Private by default" },
            { n: "2", title: "Share or list", desc: "Link or public" },
            { n: "3", title: "Watch", desc: "Stay in sync" },
          ].map((step) => (
            <li
              key={step.n}
              className="border-border/70 bg-card/50 flex flex-col items-center rounded-xl border px-1.5 py-3 text-center"
            >
              <span className="bg-primary/12 text-primary mb-1.5 flex size-7 items-center justify-center rounded-full text-xs font-bold">
                {step.n}
              </span>
              <span className="text-foreground text-xs font-semibold">
                {step.title}
              </span>
              <span className="text-muted-foreground mt-0.5 text-[0.65rem] leading-tight">
                {step.desc}
              </span>
            </li>
          ))}
        </ol>
      </section>

      {/* Highlights + demo + tagline — tight group to avoid a “hole” of whitespace */}
      <div className="flex flex-col gap-2.5">
        <section aria-label="Features" className="space-y-1.5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            At a glance
          </h2>
          <ul className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-between">
            {[
              {
                label: "Real-time sync",
                sub: "One timeline for everyone",
                icon: (
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                ),
              },
              {
                label: "Built for phones",
                sub: "Tap-friendly, works everywhere",
                icon: (
                  <path d="M12 18h.01M8 21h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2z" />
                ),
              },
              {
                label: "No login",
                sub: "Jump in and press play",
                icon: (
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                ),
              },
              {
                label: "Chat & react",
                sub: "Side chat and emoji reactions while you watch",
                icon: (
                  <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
                ),
              },
              {
                label: "Public or private",
                sub: "List a room on /explore or keep it link-only",
                icon: (
                  <>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3.6 9h16.8M3.6 15h16.8M12 3a13 13 0 0 1 0 18M12 3a13 13 0 0 0 0 18" />
                  </>
                ),
              },
            ].map((item) => (
              <li
                key={item.label}
                className="border-border/60 bg-card/35 flex min-w-0 flex-1 items-start gap-3 rounded-xl border px-3 py-2.5 sm:min-w-[30%] sm:flex-1"
              >
                <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    className="size-4.5"
                    aria-hidden
                  >
                    {item.icon}
                  </svg>
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-foreground text-sm font-semibold leading-tight">
                    {item.label}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs leading-snug">
                    {item.sub}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {demoRoomId ? (
          <button
            type="button"
            disabled={joinNavigating}
            onClick={() => tryDemoRoom()}
            className="text-accent hover:brightness-110 focus-visible:ring-ring inline-flex min-h-11 w-full items-center justify-center rounded-lg text-sm font-bold underline underline-offset-4 transition-[filter] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50"
          >
            Try demo room
          </button>
        ) : null}

        <p className="text-muted-foreground -mt-0.5 text-center text-sm font-medium italic">
          Made for vibing together
        </p>
      </div>

      <section aria-label="Install app" className="border-border/70 border-t pt-4">
        <PwaInstallOption />
      </section>

      {hasSession ? (
        <div className={subtleCard}>
          <p className="text-muted-foreground mb-3 text-xs leading-relaxed">
            Logging out clears this device&apos;s session and saved YouTube
            connection.
          </p>
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
                  setError(
                    e instanceof Error ? e.message : "Could not log out"
                  );
                } finally {
                  setBusy(false);
                }
              })();
            }}
            className={ghostBtn}
          >
            {busy ? "Logging out…" : "Log out"}
          </button>
        </div>
      ) : null}

      <LegalFooter />

      <JoinRoomQrDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onDecoded={onQrDecoded}
      />
    </div>
  );
}
