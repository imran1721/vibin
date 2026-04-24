"use client";

import { useEffect, useState } from "react";

const ALL_EMOJIS = ["🔥", "❤️", "😂", "🎉", "👏", "🙌", "💯"] as const;
const DEFAULT_EMOJI = "🔥";
const STORAGE_KEY = "vibin.lastReactionEmoji";

type Props = {
  onReact: (emoji: string) => void;
  disabled?: boolean;
};

/**
 * Rail of quick-reaction emojis that sits above the chat head. Only the
 * last-used emoji is shown by default; the chevron expands the full set.
 * Tapping an emoji fires `onReact`, becomes the new default, and collapses.
 */
export function QuickReactionRail({ onReact, disabled }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [lastEmoji, setLastEmoji] = useState<string>(DEFAULT_EMOJI);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) setLastEmoji(stored);
      } catch {
        /* ignore */
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const react = (emoji: string) => {
    onReact(emoji);
    setLastEmoji(emoji);
    setExpanded(false);
    try {
      window.localStorage.setItem(STORAGE_KEY, emoji);
    } catch {
      /* ignore */
    }
  };

  const emojis = expanded
    ? [lastEmoji, ...ALL_EMOJIS.filter((e) => e !== lastEmoji)]
    : [lastEmoji];

  return (
    <div
      role="toolbar"
      aria-label="Quick reactions"
      className="vibin-react-rail border-border/60 bg-background/90 fixed z-[60] flex items-center gap-0.5 rounded-full border p-1 shadow-[0_14px_32px_-12px_rgba(0,0,0,0.45)] backdrop-blur-md"
    >
      {emojis.map((e) => (
        <button
          key={e}
          type="button"
          disabled={disabled}
          onClick={() => react(e)}
          aria-label={`React with ${e}`}
          className="focus-visible:ring-ring grid size-9 place-items-center rounded-full text-[18px] transition-transform hover:-translate-y-0.5 hover:scale-110 focus-visible:ring-2 active:scale-95 disabled:opacity-40"
        >
          {e}
        </button>
      ))}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label={expanded ? "Collapse reactions" : "More reactions"}
        aria-expanded={expanded}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring grid size-9 place-items-center rounded-full transition-colors focus-visible:ring-2"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-4"
          aria-hidden
        >
          {expanded ? (
            <path d="M18 6 6 18M6 6l12 12" />
          ) : (
            <>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8M8 12h8" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
