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
};

/**
 * Logo + vibin.click + tagline — same stack as the home hero.
 */
export function AppBrandLockup({
  className = "",
  markClassName,
  titleRowSuffix,
}: Props) {
  const mark =
    markClassName ?? "size-10 shrink-0 sm:size-11";
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
        <p className="text-muted-foreground text-xs font-medium">
          {APP_TAGLINE}
        </p>
      </div>
    </div>
  );
}
