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
      <p className="text-foreground/60 py-8 text-center text-sm">
        Queue is empty. Add songs from search.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, index) => {
        const isNow = item.id === nowPlayingId;
        return (
          <li
            key={item.id}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
              isNow
                ? "border-amber-500/50 bg-amber-500/10"
                : "border-foreground/10 bg-foreground/[0.03]"
            }`}
          >
            {item.thumb_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.thumb_url}
                alt=""
                width={80}
                height={45}
                className="h-11 w-20 shrink-0 rounded object-cover"
              />
            ) : (
              <div className="bg-foreground/10 h-11 w-20 shrink-0 rounded" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.title}</p>
              <p className="text-foreground/50 text-xs">
                {isNow ? "Now playing" : `#${index + 1}`}
                {item.added_by ? ` · ${item.added_by}` : ""}
              </p>
            </div>
            {isHost && !isNow && (
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="text-foreground/50 hover:text-foreground shrink-0 text-xs underline"
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
