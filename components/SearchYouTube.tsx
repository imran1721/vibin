"use client";

import { useCallback, useEffect, useState } from "react";
import type { YouTubeSearchItem } from "@/lib/types";

type Props = {
  onAdd: (item: YouTubeSearchItem) => void;
  disabled?: boolean;
};

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
    <div className="flex flex-col gap-3">
      <label className="text-sm font-medium">Search YouTube</label>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Song or artist…"
        disabled={disabled}
        className="border-foreground/15 bg-background focus:ring-amber-500/40 rounded-xl border px-4 py-3 text-base outline-none focus:ring-2"
        autoComplete="off"
        enterKeyHint="search"
      />
      {loading && (
        <p className="text-foreground/50 text-xs">Searching…</p>
      )}
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <ul className="max-h-60 overflow-y-auto sm:max-h-72">
        {items.map((it) => (
          <li
            key={it.videoId}
            className="border-foreground/10 flex items-center gap-3 border-b py-2 last:border-0"
          >
            {it.thumbUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={it.thumbUrl}
                alt=""
                width={88}
                height={50}
                className="h-12 w-[4.5rem] shrink-0 rounded object-cover"
              />
            ) : (
              <div className="bg-foreground/10 h-12 w-[4.5rem] shrink-0 rounded" />
            )}
            <p className="min-w-0 flex-1 truncate text-sm">{it.title}</p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onAdd(it)}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold text-black"
            >
              Add
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
