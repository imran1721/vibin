import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<"svg">, "viewBox" | "children"> & {
  /** Accessible label; omit when decorative (default). */
  title?: string;
};

/**
 * Default inline logo — rounded tile with three animated equalizer bars (CSS, GPU-friendly).
 * Used in `AppBrandLockup`, splash, and anywhere the app mark appears.
 *
 * Pair with copy in a row: `flex items-center gap-2` or `gap-3` next to “vibin.click”.
 */
export function VibinEqualizerMark({ className, title, ...rest }: Props) {
  const merged =
    className != null && className !== ""
      ? `vibin-eq-mark block shrink-0 ${className}`
      : "vibin-eq-mark block size-8 shrink-0 sm:size-10";
  return (
    <svg
      viewBox="0 0 32 32"
      className={merged}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <rect width="32" height="32" rx="8" fill="#1c1412" />
      <rect
        className="vibin-eq-bar vibin-eq-bar-1"
        x="7"
        y="18"
        width="4"
        height="10"
        rx="2"
        fill="#e8945c"
      />
      <rect
        className="vibin-eq-bar vibin-eq-bar-2"
        x="14"
        y="11"
        width="4"
        height="17"
        rx="2"
        fill="#e8945c"
      />
      <rect
        className="vibin-eq-bar vibin-eq-bar-3"
        x="21"
        y="14"
        width="4"
        height="14"
        rx="2"
        fill="#5eb8c4"
      />
    </svg>
  );
}
