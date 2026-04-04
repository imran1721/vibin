"use client";

import type { QueueItem } from "@/lib/types";

type Props = {
  items: QueueItem[];
  isHost: boolean;
  onRemove: (id: string) => void;
  nowPlayingId: string | null;
};

export function QueueList({ items, isHost, onRemove, nowPlayingId }: Props) {
  if (items.length === 0) {
    return (
      <div className="border-border bg-card text-muted-foreground rounded-2xl border border-dashed px-6 py-12 text-center">
        <p className="text-foreground font-medium">Nothing queued yet</p>
        <p className="mt-2 max-w-[28ch] text-sm leading-relaxed">
          Search below and tap <span className="text-primary font-semibold">Add</span>{" "}
          to drop a track in the line.
        </p>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3" aria-label="Playback queue">
      {items.map((item, index) => {
        const isNow = item.id === nowPlayingId;
        return (
          <li
            key={item.id}
            className={`flex min-h-[3.25rem] items-center gap-3 rounded-2xl border px-3 py-2.5 transition-colors sm:gap-4 sm:px-4 ${
              isNow
                ? "border-primary/45 bg-primary/12 shadow-sm shadow-primary/10"
                : "border-border bg-card hover:border-border/80"
            }`}
          >
            {item.thumb_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumb_url}
                alt=""
                width={88}
                height={50}
                className="h-12 w-[4.75rem] shrink-0 rounded-lg object-cover sm:h-[3.25rem] sm:w-[5.5rem]"
              />
            ) : (
              <div className="bg-muted h-12 w-[4.75rem] shrink-0 rounded-lg sm:h-[3.25rem] sm:w-[5.5rem]" />
            )}
            <div className="min-w-0 flex-1 py-0.5">
              <p className="text-foreground truncate text-sm font-semibold leading-snug">
                {item.title}
              </p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                {isNow ? (
                  <span className="text-primary font-semibold">Now playing</span>
                ) : (
                  <span>#{index + 1} in queue</span>
                )}
                {item.added_by ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {item.added_by}
                  </span>
                ) : null}
              </p>
            </div>
            {isHost && !isNow && (
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="text-muted-foreground hover:text-destructive focus-visible:ring-ring inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-xl text-xs font-semibold underline-offset-4 transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:min-h-10 sm:px-3"
              >
                Remove
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
