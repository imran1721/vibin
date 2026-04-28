import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<"svg">, "viewBox" | "children"> & {
  /** Accessible label; omit when decorative (default). */
  title?: string;
};

/**
 * Default inline logo — four animated equalizer bars on a transparent ground
 * (matches the "now playing" mark inside the room stage). Used in
 * `AppBrandLockup`, splash, and anywhere the app mark appears in-DOM.
 *
 * Pair with copy in a row: `flex items-center gap-2` or `gap-3` next to “vibin.click”.
 */
export function VibinEqualizerMark({ className, title, ...rest }: Props) {
  const merged =
    className != null && className !== ""
      ? `vibin-eq-mark block shrink-0 ${className}`
      : "vibin-eq-mark block size-8 shrink-0 sm:size-10";
  // Four bars, bottom-aligned at y=25 in a 32-unit viewBox so the tallest
  // bar (h=18) spans 7..25 and the visual block centers at y=16 — aligning
  // with the cap height of adjacent text in `flex items-center` rows.
  const bars = [
    { x: 5, h: 10, color: "#e8945c", cls: "vibin-eq-bar-1" },
    { x: 11, h: 18, color: "#e8945c", cls: "vibin-eq-bar-2" },
    { x: 17, h: 12, color: "#e8945c", cls: "vibin-eq-bar-3" },
    { x: 23, h: 16, color: "#5eb8c4", cls: "vibin-eq-bar-4" },
  ] as const;
  return (
    <svg
      viewBox="0 0 32 32"
      className={merged}
      role={title ? "img" : "presentation"}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {bars.map((b) => (
        <rect
          key={b.cls}
          className={`vibin-eq-bar ${b.cls}`}
          x={b.x}
          y={25 - b.h}
          width="4"
          height={b.h}
          rx="2"
          fill={b.color}
        />
      ))}
    </svg>
  );
}
