import { VibinMark } from "@/components/VibinMark";

type Props = {
  /** Page: default padding; overlay: full-bleed for fixed overlay */
  variant?: "page" | "overlay";
  className?: string;
  /** True when the host is creating a new room from home (not opening an invite link). */
  creating?: boolean;
};

/**
 * Animated loader shown while creating a room or joining one.
 */
export function JoinRoomLoader({
  variant = "page",
  className = "",
  creating = false,
}: Props) {
  const srOnly = creating
    ? "Creating your room, please wait"
    : "Joining the room, please wait";
  const title = creating ? "Creating your room" : "Joining the room";
  const caption = creating
    ? "Starting your session…"
    : "Syncing queue & playback…";

  const shell =
    variant === "overlay"
      ? "flex min-h-[100dvh] w-full flex-col items-center justify-center bg-background/88 px-6 backdrop-blur-md"
      : "flex flex-col items-center justify-center px-4 py-8";

  return (
    <div
      className={`vibin-join-loader-root ${shell} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{srOnly}</span>
      <div className="flex flex-col items-center gap-7">
        {/* <div className="relative grid size-[7.25rem] place-items-center">
          <div
            className="border-border vibin-join-ring-slow pointer-events-none absolute inset-0 rounded-full border-2 border-dashed opacity-40"
            aria-hidden
          />
          <div
            className="vibin-join-ring pointer-events-none absolute inset-[10px] rounded-full border-2 border-transparent border-t-primary border-r-primary/35"
            aria-hidden
          />
          <div className="vibin-join-mark-wrap relative z-10 drop-shadow-sm">
            <VibinMark className="size-[4.25rem] sm:size-[4.5rem]" />
          </div>
        </div> */}

        <div
          className="flex h-11 items-end justify-center gap-[5px]"
          aria-hidden
        >
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="vibin-join-bar" />
          ))}
        </div>

        <div className="text-center">
          <p className="text-foreground font-display text-lg font-bold tracking-tight sm:text-xl">
            {title}
          </p>
          <p className="text-muted-foreground vibin-join-caption mt-1.5 text-sm">
            {caption}
          </p>
        </div>
      </div>
    </div>
  );
}
