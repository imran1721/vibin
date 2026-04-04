"use client";

import { useCallback, useEffect, useState } from "react";
import type { YouTubeSearchItem } from "@/lib/types";

type Props = {
  onAdd: (item: YouTubeSearchItem) => void;
  disabled?: boolean;
};

const fieldClass =
  "border-border bg-surface-elevated text-foreground placeholder:text-muted-foreground focus-visible:ring-ring min-h-11 w-full rounded-2xl border px-4 py-3 text-base outline-none transition-[box-shadow,background-color] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function SearchYouTube({ onAdd, disabled }: Props) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<YouTubeSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const runSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setItems([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/youtube/search?q=${encodeURIComponent(query)}`
      );
      const data = (await res.json()) as {
        items?: YouTubeSearchItem[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Search failed");
        setItems([]);
        return;
      }
      setItems(data.items ?? []);
    } catch {
      setError("Network error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runSearch(debounced);
  }, [debounced, runSearch]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="yt-search"
          className="text-foreground mb-2 block text-sm font-semibold"
        >
          Search YouTube
        </label>
        <input
          id="yt-search"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Song, artist, or video…"
          disabled={disabled}
          className={fieldClass}
          autoComplete="off"
          enterKeyHint="search"
        />
      </div>
      {loading && (
        <p
          className="text-muted-foreground animate-pulse text-xs motion-reduce:animate-none"
          aria-live="polite"
        >
          Searching…
        </p>
      )}
      {error && (
        <p className="text-destructive text-sm font-medium" role="alert">
          {error}
        </p>
      )}
      <ul
        className={`max-h-[min(50vh,20rem)] overflow-y-auto overscroll-y-contain rounded-2xl sm:max-h-72 ${items.length > 0 ? "border-border border" : ""}`}
        aria-label="Search results"
      >
        {items.map((it) => (
          <li
            key={it.videoId}
            className="border-border flex items-center gap-3 border-b py-3 last:border-b-0 sm:gap-4 sm:py-3.5"
          >
            {it.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={it.thumbUrl}
                alt=""
                width={96}
                height={54}
                className="h-14 w-[6.25rem] shrink-0 rounded-lg object-cover"
              />
            ) : (
              <div className="bg-muted h-14 w-[6.25rem] shrink-0 rounded-lg" />
            )}
            <p className="text-foreground min-w-0 flex-1 text-sm font-medium leading-snug">
              {it.title}
            </p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAdd(it)}
              className="bg-primary text-primary-foreground focus-visible:ring-ring hover:brightness-105 active:brightness-95 inline-flex min-h-11 min-w-[4.5rem] shrink-0 items-center justify-center rounded-xl px-4 text-xs font-bold transition-[filter,transform] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50"
            >
              Add
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
