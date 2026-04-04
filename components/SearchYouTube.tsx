"use client";

import { useCallback, useEffect, useState } from "react";
import type { YouTubeSearchItem } from "@/lib/types";

type Props = {
  onAdd: (item: YouTubeSearchItem) => void;
  disabled?: boolean;
};

const fieldClass =
  "border-border bg-surface-elevated text-foreground placeholder:text-muted-foreground focus-visible:ring-ring min-h-10 w-full rounded-xl border px-3.5 py-2.5 text-[0.9375rem] outline-none transition-[box-shadow,background-color] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-base";

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
    <div className="flex flex-col">
      <div>
        <label
          htmlFor="yt-search"
          className="text-foreground mb-1 block text-sm font-semibold"
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
        className={`max-h-[min(46vh,18rem)] overflow-y-auto overscroll-y-contain rounded-xl sm:max-h-64 ${items.length > 0 ? "border-border border" : ""}`}
        aria-label="Search results"
      >
        {items.map((it) => (
          <li
            key={it.videoId}
            className="border-border flex items-center gap-2.5 border-b py-2.5 last:border-b-0 sm:gap-3 sm:py-3"
          >
            {it.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={it.thumbUrl}
                alt=""
                width={96}
                height={54}
                className="h-12 w-24 shrink-0 rounded-md object-cover sm:h-[3.25rem] sm:w-[5.5rem]"
              />
            ) : (
              <div className="bg-muted h-12 w-24 shrink-0 rounded-md sm:h-[3.25rem] sm:w-[5.5rem]" />
            )}
            <p className="text-foreground min-w-0 flex-1 text-sm font-medium leading-snug">
              {it.title}
            </p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAdd(it)}
              className="bg-primary text-primary-foreground focus-visible:ring-ring hover:brightness-105 active:brightness-95 inline-flex min-h-10 min-w-[4.25rem] shrink-0 items-center justify-center rounded-lg px-3 text-xs font-bold transition-[filter,transform] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-11 sm:min-w-[4.5rem] sm:rounded-xl sm:px-4"
            >
              Add
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
