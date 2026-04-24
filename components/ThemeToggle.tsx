"use client";

import { useTheme } from "@/components/ThemeProvider";

type Variant = "rail" | "inline";

export function ThemeToggle({
  variant = "rail",
  className = "",
}: {
  variant?: Variant;
  className?: string;
}) {
  const { resolved, toggle } = useTheme();
  const isDark = resolved === "dark";
  const title = isDark ? "Switch to light mode" : "Switch to dark mode";

  if (variant === "rail") {
    return (
      <button
        type="button"
        onClick={toggle}
        title={title}
        aria-label={title}
        className={`text-muted-foreground hover:text-foreground hover:bg-muted/70 focus-visible:ring-ring grid size-12 place-items-center rounded-[14px] transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-shell ${className}`}
      >
        <ThemeIcon isDark={isDark} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={title}
      aria-label={title}
      className={`border-border text-foreground hover:bg-muted/70 focus-visible:ring-ring inline-flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${className}`}
    >
      <ThemeIcon isDark={isDark} />
    </button>
  );
}

function ThemeIcon({ isDark }: { isDark: boolean }) {
  return isDark ? (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
    </svg>
  ) : (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
