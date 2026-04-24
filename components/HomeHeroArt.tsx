"use client";

import { useEffect, useRef, useState } from "react";

/* =========================================================================
   HomeHeroArt — hero tableau + ambient decorations for the landing page.
   Ported from the Lepton UI kit; tokens via CSS vars (theme-aware).
   ========================================================================= */

/* ---------- HeroScene ---------- */
export function HeroScene() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [bursts, setBursts] = useState<Array<{
    id: number;
    emoji: string;
    x: number;
    sway: number;
    dur: number;
    size: number;
  }>>([]);
  const [watching, setWatching] = useState(247);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      setTilt({ x, y });
    };
    const onLeave = () => setTilt({ x: 0, y: 0 });
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const pool = ["🔥", "👏", "😂", "❤️", "🎉", "✨", "🙌", "💯"];
    let id = 0;
    const tick = () => {
      const e = pool[Math.floor(Math.random() * pool.length)];
      const lane = Math.random();
      const side = Math.random() > 0.5 ? 1 : -1;
      const x = 360 + side * (40 + lane * 180);
      const sway = (Math.random() - 0.5) * 50;
      const dur = 3200 + Math.random() * 1400;
      const size = 20 + Math.random() * 10;
      const item = { id: id++, emoji: e, x, sway, dur, size };
      setBursts((b) => [...b, item]);
      window.setTimeout(() => setBursts((b) => b.filter((i) => i.id !== item.id)), dur + 100);
    };
    const iv = window.setInterval(tick, 900);
    tick();
    return () => window.clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = window.setInterval(() => {
      setWatching((w) => w + (Math.random() > 0.6 ? 1 : Math.random() > 0.85 ? -1 : 0));
    }, 1800);
    return () => window.clearInterval(iv);
  }, []);

  const screenTx = `translate(${tilt.x * 14}px, ${tilt.y * 8}px)`;
  const viewersTx = `translate(${-tilt.x * 6}px, ${-tilt.y * 3}px)`;

  return (
    <div ref={ref} className="relative w-full max-w-[620px]" style={{ perspective: 1200 }}>
      <svg
        viewBox="0 0 720 420"
        width="100%"
        height="100%"
        aria-hidden
        style={{ display: "block", overflow: "visible", filter: "drop-shadow(0 24px 50px rgba(0,0,0,.22))" }}
      >
        <defs>
          <radialGradient id="hero-bg" cx="50%" cy="45%" r="65%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
            <stop offset="60%" stopColor="var(--accent)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--background)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="hero-screen" cx="50%" cy="48%" r="60%">
            <stop offset="0%" stopColor="#ffd5a3" />
            <stop offset="55%" stopColor="var(--primary)" stopOpacity="0.92" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.7" />
          </radialGradient>
          <radialGradient id="hero-spill" cx="50%" cy="20%" r="80%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
          </radialGradient>
          <filter id="hero-bloom" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="6" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect x="0" y="0" width="720" height="420" fill="url(#hero-bg)" />

        <path d="M 0 360 Q 360 320 720 360 L 720 420 L 0 420 Z" fill="var(--brand-shell)" opacity="0.9" />

        <circle cx="80" cy="80" r="44" fill="var(--primary)" opacity="0.16">
          <animate attributeName="r" values="44;52;44" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle cx="660" cy="350" r="54" fill="var(--accent)" opacity="0.18">
          <animate attributeName="r" values="54;62;54" dur="5.2s" repeatCount="indefinite" />
        </circle>

        <g style={{ transform: screenTx, transformOrigin: "360px 178px", transition: "transform 220ms cubic-bezier(.33,1,.68,1)" }}>
          <ellipse cx="360" cy="178" rx="220" ry="130" fill="var(--primary)" opacity="0.22" filter="url(#hero-bloom)">
            <animate attributeName="opacity" values="0.18;0.34;0.18" dur="2.6s" repeatCount="indefinite" />
          </ellipse>
          <rect x="180" y="70" width="360" height="215" rx="18" fill="var(--brand-shell)" />
          <rect x="192" y="82" width="336" height="191" rx="10" fill="url(#hero-screen)" />
          <circle cx="360" cy="178" r="38" fill="#ffd5a3" opacity="0.88">
            <animate attributeName="opacity" values="0.78;0.95;0.78" dur="3.2s" repeatCount="indefinite" />
          </circle>
          <path d="M 230 240 Q 360 200 490 240 L 490 273 L 230 273 Z" fill="#1c1412" opacity="0.6" />
          <g transform="translate(340 155)">
            <circle r="28" fill="rgba(28,20,18,.5)" />
            <circle r="28" fill="none" stroke="rgba(255,255,255,.3)" strokeWidth="1.5">
              <animate attributeName="r" values="28;34;28" dur="2.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" repeatCount="indefinite" />
            </circle>
            <path d="M -9 -11 L 15 0 L -9 11 Z" fill="#fff" />
          </g>
          <g transform="translate(210 100)">
            <rect x="0" y="0" width="62" height="22" rx="11" fill="rgba(0,0,0,.55)" />
            <circle cx="12" cy="11" r="3.5" fill="#34d399">
              <animate attributeName="r" values="3.5;5.5;3.5" dur="1.4s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="1;0.4;1" dur="1.4s" repeatCount="indefinite" />
            </circle>
            <text x="22" y="15" fontFamily="var(--font-sans)" fontWeight="700" fontSize="10" fill="#fff" letterSpacing="1.2">
              LIVE
            </text>
          </g>
          <g transform="translate(458 100)">
            <rect x="0" y="0" width="70" height="22" rx="11" fill="rgba(0,0,0,.55)" />
            <circle cx="11" cy="11" r="3" fill="var(--accent)" />
            <text x="20" y="15" fontFamily="var(--font-sans)" fontWeight="600" fontSize="10" fill="#fff" letterSpacing=".3">
              {watching} vibing
            </text>
          </g>
          <rect x="200" y="260" width="320" height="3" rx="2" fill="rgba(255,255,255,.25)" />
          <rect x="200" y="260" width="124" height="3" rx="2" fill="var(--primary)">
            <animate attributeName="width" values="124;190;124" dur="8s" repeatCount="indefinite" />
          </rect>
          <g transform="translate(490 95)">
            {[0, 1, 2, 3].map((i) => (
              <rect
                key={i}
                x={i * 5}
                y="10"
                width="3"
                height="10"
                rx="1.5"
                fill="#fff"
                opacity="0.9"
              >
                <animate
                  attributeName="height"
                  values="3;14;3"
                  dur={`${0.7 + i * 0.12}s`}
                  repeatCount="indefinite"
                  begin={`${i * 0.1}s`}
                />
                <animate
                  attributeName="y"
                  values="17;6;17"
                  dur={`${0.7 + i * 0.12}s`}
                  repeatCount="indefinite"
                  begin={`${i * 0.1}s`}
                />
              </rect>
            ))}
          </g>
        </g>

        <ellipse cx="360" cy="360" rx="320" ry="82" fill="url(#hero-spill)" />

        <g style={{ transform: viewersTx, transformOrigin: "360px 360px", transition: "transform 260ms cubic-bezier(.33,1,.68,1)" }}>
          <g transform="translate(150 360)">
            <path d="M -40 60 Q -40 0 0 0 Q 40 0 40 60 Z" fill="#1c1412" />
            <circle cx="0" cy="-14" r="30" fill="#1c1412" />
            <path d="M -22 -26 Q 0 -50 22 -26 Q 10 -36 0 -36 Q -10 -36 -22 -26 Z" fill="var(--primary)" opacity="0.42" />
          </g>
          <g transform="translate(360 374)">
            <path d="M -46 48 Q -46 -4 0 -4 Q 46 -4 46 48 Z" fill="#1c1412" />
            <circle cx="0" cy="-20" r="34" fill="#1c1412" />
            <circle cx="-10" cy="-28" r="6" fill="var(--primary)" opacity="0.6">
              <animate attributeName="opacity" values="0.4;0.8;0.4" dur="2.2s" repeatCount="indefinite" />
            </circle>
            <circle cx="12" cy="-26" r="5" fill="var(--accent)" opacity="0.65">
              <animate attributeName="opacity" values="0.45;0.85;0.45" dur="2.2s" begin=".4s" repeatCount="indefinite" />
            </circle>
          </g>
          <g transform="translate(570 360)">
            <path d="M -38 60 Q -38 2 0 2 Q 38 2 38 60 Z" fill="#1c1412" />
            <circle cx="0" cy="-12" r="28" fill="#1c1412" />
            <path d="M -18 -24 Q 0 -44 18 -24" fill="none" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" opacity="0.6" />
          </g>
        </g>
      </svg>

      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        {bursts.map((b) => (
          <span
            key={b.id}
            className="absolute"
            style={{
              left: `${(b.x / 720) * 100}%`,
              bottom: "38%",
              fontSize: b.size,
              animation: `vibin-emoji-floatup ${b.dur}ms cubic-bezier(.22,1,.36,1) forwards`,
              transform: "translate(-50%, 0)",
              ["--sway" as string]: `${b.sway}px`,
              filter: "drop-shadow(0 4px 10px rgba(0,0,0,.25))",
              willChange: "transform, opacity",
            }}
          >
            {b.emoji}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Sparkles ---------- */
export function Sparkles() {
  const dots: Array<{ l: string; t: string; s: number; c: "primary" | "accent"; d: number }> = [
    { l: "8%", t: "12%", s: 5, c: "primary", d: 0 },
    { l: "92%", t: "18%", s: 4, c: "accent", d: 1.2 },
    { l: "14%", t: "58%", s: 3, c: "accent", d: 2.4 },
    { l: "88%", t: "72%", s: 5, c: "primary", d: 0.6 },
    { l: "50%", t: "4%", s: 3, c: "primary", d: 1.8 },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {dots.map((d, i) => (
        <span
          key={i}
          className="vibin-twinkle absolute rounded-full"
          style={{
            left: d.l,
            top: d.t,
            width: d.s,
            height: d.s,
            background: `color-mix(in oklch, var(--${d.c}) 60%, transparent)`,
            boxShadow: `0 0 12px 2px color-mix(in oklch, var(--${d.c}) 55%, transparent)`,
            animationDelay: `${d.d}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ---------- NowVibingTicker ---------- */
export function NowVibingTicker() {
  const items = [
    "🎸 Dorm movie night · 23 watching",
    "🎧 Lo-fi homework crew · 7 watching",
    "🔥 Friday wind-down · 12 watching",
    "🎤 Saturday karaoke · 18 watching",
    "🌊 3am ambient · 4 watching",
    "🎬 Studio Ghibli rewatch · 31 watching",
    "🕺 Disco party · 9 watching",
    "⚡️ EDM warehouse · 14 watching",
  ];
  const row = [...items, ...items];
  return (
    <div
      aria-hidden
      className="vibin-nv-ticker relative overflow-hidden rounded-full py-2.5"
      style={{
        border: "1px solid color-mix(in oklch, var(--border) 60%, transparent)",
        background: "color-mix(in oklch, var(--card) 50%, transparent)",
        maskImage: "linear-gradient(to right, transparent 0, #000 8%, #000 92%, transparent 100%)",
        WebkitMaskImage: "linear-gradient(to right, transparent 0, #000 8%, #000 92%, transparent 100%)",
      }}
    >
      <div
        className="vibin-nv-track text-muted-foreground flex gap-10 whitespace-nowrap font-sans text-xs font-semibold"
      >
        {row.map((s, i) => (
          <span key={i} className="inline-flex items-center gap-2">
            <span>{s}</span>
            <span className="size-1 rounded-full opacity-60" style={{ background: "var(--accent)" }} />
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- EqMark (inline animated bars) ---------- */
export function EqMark({ size = 18 }: { size?: number }) {
  const bars = [0, 1, 2, 3];
  return (
    <span
      aria-hidden
      className="inline-flex items-end"
      style={{ gap: 2, height: size, width: size }}
    >
      {bars.map((i) => (
        <span
          key={i}
          className="vibin-eqmark-bar"
          style={{
            width: Math.max(2, size * 0.14),
            height: size * (0.35 + (i % 2) * 0.3),
            background: i === 3 ? "var(--accent)" : "var(--primary)",
            borderRadius: 2,
            ["--dur" as string]: `${0.8 + i * 0.08}s`,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </span>
  );
}

/* ---------- ThumbArt ---------- */
type ThumbVariant = "sunset" | "lofi" | "movie" | "stage" | "stream" | "concert";

export function ThumbArt({
  variant = "sunset",
  duration = "4:14",
  width = 96,
  height = 54,
}: {
  variant?: ThumbVariant;
  duration?: string;
  width?: number;
  height?: number;
}) {
  const id = `${variant}-${width}`;
  return (
    <div
      className="bg-muted relative shrink-0 overflow-hidden rounded-lg"
      style={{ width, height, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.05)" }}
    >
      <svg
        viewBox="0 0 100 56"
        preserveAspectRatio="xMidYMid slice"
        width="100%"
        height="100%"
        style={{ display: "block" }}
      >
        {variant === "sunset" ? (
          <>
            <defs>
              <linearGradient id={`ta-sunset-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f9b86a" />
                <stop offset="55%" stopColor="#e8945c" />
                <stop offset="100%" stopColor="#7a2a2a" />
              </linearGradient>
            </defs>
            <rect width="100" height="56" fill={`url(#ta-sunset-${id})`} />
            <circle cx="72" cy="34" r="14" fill="#ffd5a3" opacity=".85" />
            <path d="M 0 44 L 30 30 L 48 40 L 72 26 L 100 38 L 100 56 L 0 56 Z" fill="#1c1412" opacity=".8" />
          </>
        ) : variant === "lofi" ? (
          <>
            <rect width="100" height="56" fill="#2a1c2e" />
            <rect x="8" y="12" width="30" height="32" rx="2" fill="#f6c98a" opacity=".9" />
            <rect x="10" y="14" width="26" height="20" fill="#1c1412" />
            <circle cx="23" cy="24" r="3" fill="#5eb8c4" />
            <rect x="46" y="32" width="48" height="10" rx="5" fill="#1c1412" />
            <circle cx="55" cy="37" r="2.5" fill="#e8945c" />
            <circle cx="63" cy="37" r="2.5" fill="#e8945c" opacity=".8" />
            <circle cx="71" cy="37" r="2.5" fill="#e8945c" opacity=".6" />
          </>
        ) : variant === "movie" ? (
          <>
            <rect width="100" height="56" fill="#0f1a2a" />
            <circle cx="78" cy="18" r="6" fill="#faf8f5" />
            {Array.from({ length: 20 }).map((_, i) => (
              <circle
                key={i}
                cx={(i * 13 + 7) % 100}
                cy={(i * 7) % 30}
                r={(i % 3) * 0.5 + 0.5}
                fill="#faf8f5"
                opacity=".7"
              />
            ))}
            <path d="M 0 40 Q 30 28 50 36 T 100 30 L 100 56 L 0 56 Z" fill="#1c1412" />
          </>
        ) : variant === "concert" ? (
          <>
            <defs>
              <linearGradient id={`ta-concert-${id}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#6a2a5e" />
                <stop offset="100%" stopColor="#1c1412" />
              </linearGradient>
            </defs>
            <rect width="100" height="56" fill={`url(#ta-concert-${id})`} />
            <path d="M 30 0 L 10 56 L 50 56 Z" fill="#e8945c" opacity=".35" />
            <path d="M 70 0 L 90 56 L 50 56 Z" fill="#5eb8c4" opacity=".35" />
            <path
              d="M 0 46 Q 6 38 12 46 Q 18 36 24 46 Q 30 38 36 46 Q 42 36 48 46 Q 54 38 60 46 Q 66 36 72 46 Q 78 38 84 46 Q 90 36 96 46 L 100 56 L 0 56 Z"
              fill="#0b0608"
            />
          </>
        ) : variant === "stream" ? (
          <>
            <rect width="100" height="56" fill="#1a0f1d" />
            {Array.from({ length: 22 }).map((_, i) => {
              const barH = 6 + ((i * 13) % 24);
              return (
                <rect
                  key={i}
                  x={i * 4 + 4}
                  y={28 - barH / 2}
                  width="2"
                  height={barH}
                  rx="1"
                  fill={i % 3 === 0 ? "#5eb8c4" : "#e8945c"}
                  opacity={0.7 + (i % 4) * 0.05}
                />
              );
            })}
          </>
        ) : (
          <>
            <defs>
              <radialGradient id={`ta-stage-${id}`} cx="50%" cy="100%" r="80%">
                <stop offset="0%" stopColor="#ffcc7a" />
                <stop offset="60%" stopColor="#e8945c" stopOpacity=".4" />
                <stop offset="100%" stopColor="#1c1412" />
              </radialGradient>
            </defs>
            <rect width="100" height="56" fill={`url(#ta-stage-${id})`} />
            <rect x="0" y="44" width="100" height="12" fill="#1c1412" />
            <rect x="44" y="22" width="12" height="24" rx="2" fill="#1c1412" />
          </>
        )}
      </svg>
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <div
          className="grid size-6 place-items-center rounded-full"
          style={{ background: "rgba(0,0,0,.45)", backdropFilter: "blur(2px)" }}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff" aria-hidden>
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
      <div
        className="absolute bottom-[3px] right-1 rounded px-1 py-px text-[9px] font-semibold text-white"
        style={{
          background: "rgba(0,0,0,.65)",
          fontVariantNumeric: "tabular-nums",
          letterSpacing: ".02em",
        }}
      >
        {duration}
      </div>
    </div>
  );
}
