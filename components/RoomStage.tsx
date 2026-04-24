"use client";

import { useMemo, type CSSProperties, type ReactNode } from "react";

/* =========================================================================
   RoomStage — visual frame around the real YouTube iframe.

   Overlays (non-interactive) on top of the video:
     • LIVE pill (top-left) with green pulse
     • Watchers pill (top-right)
     • Progress bar (bottom, tabular-nums time)
   Below the video:
     • Transport strip: EQ mark, "Now playing" eyebrow, title, Prev/Play/Next
     • Optional quick-reactions row (decorative; spawn flies via onReaction)

   All overlays use pointer-events: none so taps fall through to the iframe.
   The transport bar below is interactive.
   ========================================================================= */

type Props = {
  children: ReactNode; // the YouTubeSyncPlayer iframe
  watchers: number;
  progressSec: number;
  durationSec: number | null;
  nowPlayingTitle: string | null;
  nowPlayingAddedBy?: string | null;
  isPlaying: boolean;
  canPrev: boolean;
  canNext: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  onTogglePlay?: () => void;
  /** Disabled when the user is a guest (host-only playback controls). */
  controlsDisabled?: boolean;
  /** Top-left corner — visibility pill, room title, etc. */
  chipSlot?: ReactNode;
  /** Row below transport strip — quick reactions, queue prompt, etc. */
  bottomSlot?: ReactNode;
};

export function RoomStage({
  children,
  watchers,
  progressSec,
  durationSec,
  nowPlayingTitle,
  nowPlayingAddedBy,
  isPlaying,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onTogglePlay,
  controlsDisabled = false,
  chipSlot,
  bottomSlot,
}: Props) {
  const pct = useMemo(() => {
    if (!durationSec || durationSec <= 0) return 0;
    return Math.min(100, Math.max(0, (progressSec / durationSec) * 100));
  }, [progressSec, durationSec]);

  return (
    <div
      className="vibin-stage relative w-full overflow-hidden rounded-2xl"
      style={{
        background: "#0b0608",
        boxShadow:
          "0 30px 80px -30px rgba(0,0,0,.6), 0 0 0 1px color-mix(in oklch, var(--border) 50%, transparent)",
      }}
    >
      <div className="vibin-stage__frame relative">
        <div className="vibin-stage__media relative w-full">{children}</div>

        {/* Non-interactive overlays */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between"
        >
          <div className="flex flex-col items-start gap-1.5">
            <StagePill>
              <span
                className="relative inline-flex"
                style={{ width: 7, height: 7 }}
              >
                <span
                  className="vibin-stage-ping absolute inset-0 rounded-full"
                  style={{ background: "#34d399", opacity: 0.7 }}
                />
                <span
                  className="relative rounded-full"
                  style={{ width: 7, height: 7, background: "#34d399" }}
                />
              </span>
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 11,
                  color: "#fff",
                  letterSpacing: ".12em",
                }}
              >
                LIVE
              </span>
            </StagePill>
            {chipSlot ? <div className="pointer-events-auto">{chipSlot}</div> : null}
          </div>
          <StagePill>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden
              style={{ color: "#fff" }}
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span
              style={{
                fontWeight: 700,
                fontSize: 11,
                color: "#fff",
              }}
            >
              {watchers} watching
            </span>
          </StagePill>
        </div>

        {durationSec != null && durationSec > 0 ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center gap-2.5"
          >
            <div
              className="flex-1 overflow-hidden rounded-full"
              style={{ height: 4, background: "rgba(255,255,255,.24)" }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  height: "100%",
                  borderRadius: 9999,
                  background:
                    "linear-gradient(90deg, var(--primary), var(--accent))",
                  transition: "width 500ms linear",
                }}
              />
            </div>
            <span
              className="font-sans tabular-nums"
              style={{
                fontWeight: 600,
                fontSize: 11,
                color: "#fff",
                letterSpacing: ".02em",
              }}
            >
              {fmt(progressSec)} / {fmt(durationSec)}
            </span>
          </div>
        ) : null}
      </div>

      {/* Transport strip — real controls below the frame */}
      <div className="vibin-stage__transport relative px-4 py-3">
       <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-0.5 flex items-center gap-1.5">
            <EqBars />
            <span
              className="font-display"
              style={{
                fontWeight: 800,
                fontSize: 10,
                color: "var(--primary)",
                letterSpacing: ".1em",
                textTransform: "uppercase",
              }}
            >
              Now playing
            </span>
          </div>
          <div
            className="truncate"
            style={{
              fontWeight: 700,
              fontSize: 14,
              color: "#fff",
            }}
          >
            {nowPlayingTitle ?? "Nothing playing yet"}
          </div>
          {nowPlayingAddedBy ? (
            <div
              className="truncate"
              style={{
                marginTop: 2,
                fontSize: 11,
                color: "var(--muted-foreground)",
              }}
            >
              added by {nowPlayingAddedBy}
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <TransportBtn
            label="Previous"
            onClick={onPrev}
            disabled={controlsDisabled || !canPrev || !onPrev}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" />
              <line x1="5" y1="19" x2="5" y2="5" />
            </svg>
          </TransportBtn>
          <button
            type="button"
            onClick={onTogglePlay}
            disabled={controlsDisabled || !onTogglePlay}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="focus-visible:ring-ring grid size-11 place-items-center rounded-full border-0 transition-colors focus-visible:ring-2 disabled:opacity-35"
            style={{
              background: "var(--primary)",
              color: "var(--primary-foreground)",
              boxShadow:
                "0 10px 24px -8px color-mix(in oklch, var(--primary) 70%, transparent)",
            }}
          >
            {isPlaying ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <rect x="6" y="5" width="4" height="14" rx="1" />
                <rect x="14" y="5" width="4" height="14" rx="1" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <TransportBtn
            label="Next"
            onClick={onNext}
            disabled={controlsDisabled || !canNext || !onNext}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" />
              <line x1="19" y1="5" x2="19" y2="19" />
            </svg>
          </TransportBtn>
        </div>
       </div>
        {bottomSlot ? (
          <div className="mt-2 flex justify-center">{bottomSlot}</div>
        ) : null}
      </div>

      <style jsx>{`
        .vibin-stage-ping {
          animation: vibin-stage-ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
        }
        @keyframes vibin-stage-ping {
          75%,
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .vibin-stage-ping {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

function StagePill({ children }: { children: ReactNode }) {
  const style: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(0,0,0,.55)",
    padding: "5px 12px",
    borderRadius: 9999,
    backdropFilter: "blur(6px)",
    WebkitBackdropFilter: "blur(6px)",
    color: "#fff",
  };
  return <div style={style}>{children}</div>;
}

function TransportBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="hover:bg-muted/40 focus-visible:ring-ring grid size-10 place-items-center rounded-xl border-0 bg-transparent text-white transition-colors focus-visible:ring-2 disabled:opacity-35"
    >
      {children}
    </button>
  );
}

function EqBars() {
  const bars = [0, 1, 2, 3];
  return (
    <span aria-hidden className="inline-flex items-end" style={{ gap: 2, height: 14 }}>
      {bars.map((i) => (
        <span
          key={i}
          className="vibin-stage-eq-bar"
          style={
            {
              width: 3,
              height: i % 2 ? 8 : 12,
              background: i === 3 ? "var(--accent)" : "var(--primary)",
              borderRadius: 2,
              animationDelay: `${i * 80}ms`,
            } as CSSProperties
          }
        />
      ))}
      <style jsx>{`
        .vibin-stage-eq-bar {
          animation: vibin-stage-eq 0.85s ease-in-out infinite;
          transform-origin: bottom;
        }
        @keyframes vibin-stage-eq {
          0%,
          100% {
            transform: scaleY(0.35);
          }
          50% {
            transform: scaleY(1);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .vibin-stage-eq-bar {
            animation: none;
            transform: scaleY(0.7);
          }
        }
      `}</style>
    </span>
  );
}

function fmt(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/* ---------- Quick-reactions row (exported helper) ---------- */

export function QuickReactionRow({
  emojis = ["🔥", "👏", "😂", "❤️", "🎉", "🙌", "💯"],
  onTap,
  disabled,
}: {
  emojis?: string[];
  onTap: (emoji: string) => void;
  disabled?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-full px-1.5 py-1"
      style={{
        background: "rgba(0,0,0,.55)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        border: "1px solid rgba(255,255,255,.12)",
      }}
    >
      {emojis.map((e) => (
        <button
          key={e}
          type="button"
          disabled={disabled}
          onClick={() => onTap(e)}
          className="focus-visible:ring-ring grid size-8 place-items-center rounded-full border-0 bg-transparent transition-transform focus-visible:ring-2 hover:-translate-y-0.5 hover:scale-110 disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ fontSize: 17 }}
          aria-label={`React with ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
