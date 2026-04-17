import type { ReactNode } from "react";
import { VibinEqualizerMark } from "@/components/VibinEqualizerMark";

/** Short line under the app name — keep in sync with marketing copy. */
export const APP_TAGLINE = "YouTube watch parties";

type Props = {
  className?: string;
  /** Override default mark size (default: `size-10 shrink-0 sm:size-11`). */
  markClassName?: string;
  /**
   * Renders after the app name on the **same row** (e.g. Host/Guest in the room header).
   * Keeps the tagline on its own line below so the pill does not sit beside it.
   */
  titleRowSuffix?: ReactNode;
  /**
   * Drop the marketing tagline. Use inside the room header, where the user already
   * knows what the app is and the row needs to stay one line tall on narrow screens.
   */
  hideTagline?: boolean;
  /**
   * Replace the tagline with custom text (e.g. the room title). Wins over `hideTagline`.
   */
  subtitle?: string | null;
};

/**
 * Logo + vibin.click + tagline — same stack as the home hero.
 */
export function AppBrandLockup({
  className = "",
  markClassName,
  titleRowSuffix,
  hideTagline = false,
  subtitle,
}: Props) {
  const mark =
    markClassName ?? "size-10 shrink-0 sm:size-11";
  const subtitleText =
    typeof subtitle === "string" && subtitle.trim().length > 0
      ? subtitle
      : hideTagline
        ? null
        : APP_TAGLINE;
  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <VibinEqualizerMark className={mark} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-accent font-display text-sm font-bold tracking-tight">
            vibin.click
          </p>
          {titleRowSuffix}
        </div>
        {subtitleText ? (
          <p className="text-muted-foreground truncate text-xs font-medium">
            {subtitleText}
          </p>
        ) : null}
      </div>
    </div>
  );
}
