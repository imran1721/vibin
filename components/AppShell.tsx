"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { VibinEqualizerMark } from "@/components/VibinEqualizerMark";
import { ThemeToggle } from "@/components/ThemeToggle";
import { readStoredHostRoom } from "@/lib/party-session";

type NavId = "home" | "explore" | "create" | "settings" | "me";

type RoomChip = {
  id: string;
  title: string;
  emoji?: string;
  letter?: string;
  live?: boolean;
  unread?: number;
  href: string;
};

const DESKTOP_MIN = 900;

function useIsWide() {
  const [wide, setWide] = useState<boolean>(true);
  useEffect(() => {
    const set = () => setWide(window.innerWidth >= DESKTOP_MIN);
    set();
    window.addEventListener("resize", set);
    return () => window.removeEventListener("resize", set);
  }, []);
  return wide;
}

function pathToNavId(pathname: string | null): NavId | "room" {
  if (!pathname) return "home";
  if (pathname === "/") return "home";
  if (pathname.startsWith("/explore")) return "explore";
  if (pathname.startsWith("/r/")) return "room";
  return "home";
}

/* =========================================================================
   LeftRail — desktop (72px sticky column)
   ========================================================================= */

const railNavIcons: Record<NavId, ReactNode> = {
  home: (
    <>
      <path d="M3 12 12 3l9 9" />
      <path d="M5 10v10h14V10" />
      <path d="M10 20v-6h4v6" />
    </>
  ),
  explore: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  create: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
  me: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
};

function RailIcon({
  id,
  label,
  active,
  onClick,
  badge,
}: {
  id: NavId;
  label: string;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="focus-visible:ring-ring relative grid size-12 place-items-center rounded-[14px] transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-shell"
      style={{
        background: active ? "color-mix(in oklch, var(--primary) 22%, transparent)" : "transparent",
        color: active ? "var(--primary)" : "var(--muted-foreground)",
      }}
      onMouseOver={(e) => {
        if (active) return;
        e.currentTarget.style.background = "color-mix(in oklch, var(--primary) 14%, transparent)";
        e.currentTarget.style.color = "var(--foreground)";
      }}
      onMouseOut={(e) => {
        if (active) return;
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = "var(--muted-foreground)";
      }}
    >
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {railNavIcons[id]}
      </svg>
      {badge != null && badge > 0 ? (
        <span
          className="border-bg-shell bg-primary text-primary-foreground absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full border-2 px-1 text-[10px] font-bold"
        >
          {badge}
        </span>
      ) : null}
      {active ? (
        <span
          className="bg-primary absolute -left-3.5 top-2.5 bottom-2.5 w-1 rounded-r"
          style={{ boxShadow: "0 0 16px color-mix(in oklch, var(--primary) 80%, transparent)" }}
        />
      ) : null}
    </button>
  );
}

function LeftRail({
  current,
  onNavigate,
  rooms,
}: {
  current: NavId | "room";
  onNavigate: (id: NavId) => void;
  rooms: RoomChip[];
}) {
  return (
    <aside
      className="vibin-rail bg-bg-shell/95 sticky top-0 z-40 flex h-screen w-18 shrink-0 flex-col items-center gap-2 py-4"
      style={{
        width: 72,
        borderRight: "1px solid color-mix(in oklch, var(--border) 50%, transparent)",
        background: "color-mix(in oklch, var(--bg-shell) 92%, black)",
      }}
    >
      <button
        type="button"
        onClick={() => onNavigate("home")}
        aria-label="Vibin home"
        className="mb-1 cursor-pointer border-0 bg-transparent"
        style={{ filter: "drop-shadow(0 6px 16px color-mix(in oklch, var(--primary) 45%, transparent))" }}
      >
        <VibinEqualizerMark className="size-10" />
      </button>

      <div
        className="my-1 h-px w-8"
        style={{ background: "color-mix(in oklch, var(--border) 60%, transparent)" }}
      />

      <div className="flex flex-col items-center gap-1.5">
        <RailIcon id="home" label="Home" active={current === "home"} onClick={() => onNavigate("home")} />
        <RailIcon id="explore" label="Explore" active={current === "explore"} onClick={() => onNavigate("explore")} />
        <RailIcon id="create" label="Start a Room" active={current === "room" || current === "create"} onClick={() => onNavigate("create")} />
      </div>

      {rooms.length > 0 ? (
        <>
          <div
            className="mt-3 mb-0.5 h-px w-8"
            style={{ background: "color-mix(in oklch, var(--border) 60%, transparent)" }}
          />
          <div className="text-muted-foreground mb-0.5 text-[9px] font-bold uppercase tracking-wider">
            Rooms
          </div>
          <div className="flex flex-col items-center gap-1.5">
            {rooms.map((r) => (
              <a
                key={r.id}
                href={r.href}
                title={r.title}
                aria-label={r.title}
                className="relative grid place-items-center rounded-[14px] font-display text-sm font-extrabold text-white transition-colors"
                style={{
                  width: 46,
                  height: 46,
                  border: "1px solid color-mix(in oklch, var(--border) 50%, transparent)",
                  background: "linear-gradient(135deg, color-mix(in oklch, var(--primary) 35%, #1c1412), color-mix(in oklch, var(--accent) 40%, #1c1412))",
                }}
              >
                {r.emoji || r.letter || r.title.charAt(0).toUpperCase()}
                {r.unread ? (
                  <span
                    className="bg-primary text-primary-foreground absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full border-2 px-1 text-[9px] font-bold"
                    style={{ borderColor: "var(--bg-shell)" }}
                  >
                    {r.unread}
                  </span>
                ) : null}
                {r.live ? (
                  <span
                    className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2"
                    style={{ background: "#34d399", borderColor: "var(--bg-shell)" }}
                  />
                ) : null}
              </a>
            ))}
          </div>
        </>
      ) : null}

      <div className="flex-1" />

      <div className="flex flex-col items-center gap-1.5">
        <ThemeToggle variant="rail" />
        <RailIcon id="settings" label="Settings" active={false} onClick={() => { /* no-op placeholder */ }} />
        <button
          type="button"
          aria-label="Profile"
          className="mt-1 grid size-10 cursor-pointer place-items-center rounded-full font-display text-sm font-extrabold text-white"
          style={{
            border: "2px solid color-mix(in oklch, var(--border) 60%, transparent)",
            background: "linear-gradient(135deg, #6ec8ff, #b58bff)",
          }}
        >
          V
        </button>
      </div>
    </aside>
  );
}

/* =========================================================================
   MobileTabBar — bottom nav on small screens
   ========================================================================= */

function MobileTabBar({
  current,
  onNavigate,
}: {
  current: NavId | "room";
  onNavigate: (id: NavId) => void;
}) {
  const items: { id: NavId; label: string }[] = [
    { id: "home", label: "Home" },
    { id: "explore", label: "Explore" },
    { id: "create", label: "Start" },
    { id: "me", label: "You" },
  ];
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[60] flex justify-around"
      style={{
        background: "color-mix(in oklch, var(--bg-shell) 92%, black)",
        borderTop: "1px solid color-mix(in oklch, var(--border) 50%, transparent)",
        paddingBottom: "env(safe-area-inset-bottom)",
        backdropFilter: "blur(12px)",
      }}
    >
      {items.map((it) => {
        const active = current === it.id || (it.id === "create" && current === "room");
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onNavigate(it.id)}
            aria-label={it.label}
            className="flex flex-1 cursor-pointer flex-col items-center gap-0.5 border-0 bg-transparent px-1.5 py-2.5 text-[10px] font-semibold"
            style={{ color: active ? "var(--primary)" : "var(--muted-foreground)" }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {railNavIcons[it.id]}
            </svg>
            <span>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

/* =========================================================================
   AppShell — wraps pages with chrome; hides on room routes where the Room
   supplies its own full-height layout.
   ========================================================================= */

export function AppShell({
  children,
  rooms,
  hideChrome = false,
}: {
  children: ReactNode;
  rooms?: RoomChip[];
  hideChrome?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const wide = useIsWide();
  const current = pathToNavId(pathname);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setMounted(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const [derivedRooms, setDerivedRooms] = useState<RoomChip[]>([]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (rooms) {
        setDerivedRooms(rooms);
        return;
      }
      const stored = readStoredHostRoom();
      if (stored) {
        setDerivedRooms([
          {
            id: stored.roomId,
            title: "Your room",
            letter: "Y",
            live: true,
            href: `/r/${stored.roomId}?h=${encodeURIComponent(stored.hostToken)}`,
          },
        ]);
      } else {
        setDerivedRooms([]);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [rooms, pathname]);

  const onNavigate = (id: NavId) => {
    if (id === "home") router.push("/");
    else if (id === "explore") router.push("/explore");
    else if (id === "create") {
      const stored = readStoredHostRoom();
      if (stored) {
        router.push(`/r/${stored.roomId}?h=${encodeURIComponent(stored.hostToken)}`);
      } else {
        router.push("/");
      }
    } else if (id === "me") {
      router.push("/");
    }
  };

  const onRoomRoute = mounted && current === "room";
  if (hideChrome || onRoomRoute) {
    return <>{children}</>;
  }

  return (
    <div className="bg-bg-shell flex min-h-screen">
      {wide ? <LeftRail current={current} onNavigate={onNavigate} rooms={derivedRooms} /> : null}
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
      {!wide ? <MobileTabBar current={current} onNavigate={onNavigate} /> : null}
    </div>
  );
}
