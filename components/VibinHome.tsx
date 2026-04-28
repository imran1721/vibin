"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureAnonymousSession } from "@/lib/auth";
import {
  HeroScene,
  NowVibingTicker,
  Sparkles,
} from "@/components/HomeHeroArt";
import { JoinRoomLoader } from "@/components/JoinRoomLoader";
import { JoinRoomQrDialog } from "@/components/JoinRoomQrDialog";
import { LiveRoomsPreview } from "@/components/LiveRoomsPreview";
import { PwaInstallOption } from "@/components/PwaInstallOption";
import { VibinEqualizerMark } from "@/components/VibinEqualizerMark";
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
  "bg-primary text-primary-foreground focus-visible:ring-ring hover:brightness-105 active:brightness-95 inline-flex min-h-14 w-full items-center justify-center rounded-2xl px-6 text-base font-bold shadow-lg shadow-black/15 transition-[filter,transform] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:shadow-black/45 enabled:active:scale-[0.99] motion-reduce:enabled:active:scale-100 disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto sm:min-w-[200px]";

const secondaryBtn =
  "border-border bg-card/70 text-foreground hover:bg-muted/80 focus-visible:ring-ring inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border px-6 text-base font-bold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[180px]";

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
    <div className="relative mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:px-6 sm:py-10">
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

      {/* Lockup row — logo + vibin.click */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <VibinEqualizerMark className="size-9" />
          <span className="font-display text-accent text-[1.05rem] font-extrabold tracking-tight">
            vibin.click
          </span>
        </div>
      </div>

      {/* Hero — art + eyebrow + headline + CTAs */}
      <section className="relative flex flex-col items-center gap-5 overflow-visible text-center">
        <Sparkles />
        <div className="relative -mb-1 w-full max-w-[540px]">
          <HeroScene />
        </div>

        <p className="text-accent relative text-[0.7rem] font-extrabold uppercase tracking-[0.22em]">
          Youtube watch parties
        </p>

        <h1 className="font-display text-foreground relative max-w-[28rem] text-[2rem] font-extrabold leading-[1.03] tracking-tight sm:text-5xl">
          Watch YouTube together.{" "}
          <span
            className="bg-clip-text text-transparent"
            style={{
              backgroundImage:
                "linear-gradient(95deg, var(--primary), var(--accent))",
            }}
          >
            Instantly.
          </span>
        </h1>

        <p className="text-muted-foreground relative max-w-[30rem] text-[1rem] leading-snug sm:text-[1.1rem]">
          Start a private watch party in one tap, or hop into a public room
          that&apos;s already vibing. Chat, react, and queue together — no
          login, no installs.
        </p>

        <div className="relative mt-1 flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center">
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
        </div>
        <p className="text-muted-foreground/90 relative text-xs">
          Scan a code, or open a link someone sent you.
        </p>
      </section>

      {/* Marquee of rooms already vibing */}
      <NowVibingTicker />

      {/* Live now — real rooms */}
      <LiveRoomsPreview />

      {/* How it works */}
      <section aria-labelledby="how-heading" className="space-y-2">
        <h2
          id="how-heading"
          className="text-muted-foreground text-xs font-bold uppercase tracking-wider"
        >
          How it works
        </h2>
        <ol className="grid grid-cols-3 gap-2.5">
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

      <div className="flex flex-col gap-3">
        <section aria-label="Features" className="space-y-2">
          <h2 className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
            At a glance
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
              },
              {
                label: "Chat & react",
                sub: "Side chat and emoji reactions",
                icon: <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />,
              },
            ].map((item) => (
              <li
                key={item.label}
                className="border-border/60 bg-card/35 flex min-w-0 items-start gap-3 rounded-xl border px-3 py-2.5"
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

        <p className="text-muted-foreground text-center text-sm font-medium italic">
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
