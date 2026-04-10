import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<"svg">, "viewBox" | "children"> & {
  /** Accessible label; omit when decorative (default). */
  title?: string;
};

/**
 * Inline logo mark (same motif as the app icon) for vibin.click headers and wordmarks.
 */
export function VibinMark({ className, title, ...rest }: Props) {
  const merged =
    className != null && className !== ""
      ? `block shrink-0 ${className}`
      : "block size-8 shrink-0";
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
      <rect x="7" y="18" width="4" height="10" rx="2" fill="#e8945c" />
      <rect x="14" y="11" width="4" height="17" rx="2" fill="#e8945c" />
      <rect x="21" y="14" width="4" height="14" rx="2" fill="#5eb8c4" />
    </svg>
  );
}
