"use client";

import { useCallback, useEffect, useState } from "react";
import type { YouTubeSearchItem } from "@/lib/types";

type Props = {
  onAdd: (item: YouTubeSearchItem) => Promise<boolean> | boolean;
  disabled?: boolean;
  /** YouTube `videoId`s already present in the room queue — show “Added” instead of “Add”. */
  queuedVideoIds?: ReadonlySet<string>;
};

/** `pe-*` reserves space for custom clear control (Safari hides native search cancel on dark UI). */
const fieldClass =
  "bg-transparent text-foreground placeholder:text-muted-foreground min-h-10 w-full rounded-[inherit] py-2.5 pl-10 pr-3.5 text-[0.9375rem] outline-none sm:pl-11 sm:text-base";

const fieldClassWithClear = `${fieldClass} pe-11 sm:pe-12`;

const addBtnClass =
  "bg-primary text-primary-foreground focus-visible:ring-ring hover:brightness-105 active:brightness-95 inline-flex min-h-10 min-w-[4.25rem] shrink-0 items-center justify-center rounded-lg px-3 text-xs font-bold transition-[filter,transform] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-11 sm:min-w-[4.5rem] sm:rounded-xl sm:px-4";

const addedBtnClass =
  "border-border bg-muted/55 text-muted-foreground inline-flex min-h-10 min-w-[4.25rem] shrink-0 cursor-default items-center justify-center rounded-lg border px-3 text-xs font-semibold sm:min-h-11 sm:min-w-[4.5rem] sm:rounded-xl sm:px-4";

function formatPublishedAt(iso?: string): string {
  if (!iso) return "";
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function SearchYouTube({ onAdd, disabled, queuedVideoIds }: Props) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [items, setItems] = useState<YouTubeSearchItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [addingIds, setAddingIds] = useState<Set<string>>(() => new Set());
  const [locallyAddedIds, setLocallyAddedIds] = useState<Set<string>>(
    () => new Set()
  );

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 400);
    return () => clearTimeout(t);
  }, [q]);

  const runSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setItems([]);
      setNextPageToken(null);
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
        nextPageToken?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Search failed");
        setItems([]);
        setNextPageToken(null);
        return;
      }
      setItems(data.items ?? []);
      setNextPageToken(data.nextPageToken ?? null);
    } catch {
      setError("Network error");
      setItems([]);
      setNextPageToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = useCallback(async () => {
    if (!debounced || debounced.length < 2 || !nextPageToken || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/youtube/search?q=${encodeURIComponent(debounced)}&pageToken=${encodeURIComponent(nextPageToken)}`
      );
      const data = (await res.json()) as {
        items?: YouTubeSearchItem[];
        nextPageToken?: string | null;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Could not load more");
        return;
      }
      setItems((prev) => [...prev, ...(data.items ?? [])]);
      setNextPageToken(data.nextPageToken ?? null);
    } catch {
      setError("Network error");
    } finally {
      setLoadingMore(false);
    }
  }, [debounced, nextPageToken, loadingMore]);

  useEffect(() => {
    void runSearch(debounced);
  }, [debounced, runSearch]);

  const handleResultsScroll = useCallback(
    (e: React.UIEvent<HTMLUListElement>) => {
      if (!nextPageToken || loading || loadingMore) return;
      const node = e.currentTarget;
      const remaining = node.scrollHeight - node.scrollTop - node.clientHeight;
      if (remaining <= 160) {
        void loadMore();
      }
    },
    [nextPageToken, loading, loadingMore, loadMore]
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 w-full flex-col gap-3">
      <div>
        <div className="border-border bg-surface-elevated focus-within:border-primary focus-within:ring-primary/55 relative rounded-xl border transition-[border-color,box-shadow] focus-within:ring-1">
          <span className="pointer-events-none absolute inset-y-0 left-0 inline-flex items-center pl-3 text-muted-foreground sm:pl-3.5">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              className="size-4.5"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </span>
          <input
            id="yt-search"
            type="text"
            inputMode="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Song, artist, or video…"
            disabled={disabled}
            className={fieldClassWithClear}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            enterKeyHint="search"
          />
          {q.length > 0 ? (
            <button
              type="button"
              className="text-muted-foreground hover:bg-muted/70 hover:text-foreground focus-visible:ring-ring absolute inset-y-0 right-1 flex min-w-11 items-center justify-center rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 sm:right-1.5"
              aria-label="Clear search"
              onClick={() => setQ("")}
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5 shrink-0"
                aria-hidden
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>
      </div>
      {error && (
        <p className="text-destructive text-sm font-medium" role="alert">
          {error}
        </p>
      )}
      {items.length > 0 ? (
        <ul
          className="border-border relative min-h-0 flex-1 min-w-0 w-full overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-xl border px-3 sm:px-3.5"
          aria-label="Search results"
          onScroll={handleResultsScroll}
        >
          {items.map((it) => {
          const inQueue =
            (queuedVideoIds?.has(it.videoId) ?? false) ||
            locallyAddedIds.has(it.videoId);
          const isAdding = addingIds.has(it.videoId);
          return (
            <li
              key={it.videoId}
              className="border-border flex min-w-0 items-center gap-2.5 border-b py-2.5 last:border-b-0 sm:gap-3 sm:py-3"
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
              <div className="min-w-0 flex-1">
                <p className="text-foreground min-w-0 break-words text-sm font-medium leading-snug">
                  {it.title}
                </p>
                {it.publishedAt ? (
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {formatPublishedAt(it.publishedAt)}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                disabled={disabled || inQueue || isAdding}
                onClick={() => {
                  if (disabled || inQueue || isAdding) return;
                  const id = it.videoId;
                  setAddingIds((prev) => {
                    const next = new Set(prev);
                    next.add(id);
                    return next;
                  });
                  void Promise.resolve(onAdd(it))
                    .then((ok) => {
                      if (ok) {
                        setLocallyAddedIds((prev) => {
                          const next = new Set(prev);
                          next.add(id);
                          return next;
                        });
                      }
                    })
                    .finally(() => {
                      setAddingIds((prev) => {
                        const next = new Set(prev);
                        next.delete(id);
                        return next;
                      });
                    });
                }}
                aria-label={
                  inQueue ? "Already in queue" : isAdding ? "Adding" : "Add to queue"
                }
                className={inQueue ? addedBtnClass : addBtnClass}
              >
                {inQueue ? "Added" : isAdding ? "Adding…" : "Add"}
              </button>
            </li>
          );
          })}
          {nextPageToken ? (
            <li className="pointer-events-none sticky bottom-0 z-[1] -mx-3 mt-1.5 border-t border-border/60 bg-gradient-to-t from-background/95 via-background/70 to-transparent px-3 py-1.5 text-center sm:-mx-3.5 sm:px-3.5">
              <p className="text-muted-foreground text-xs">
                {loadingMore ? "Loading more…" : "Scroll for more"}
              </p>
            </li>
          ) : null}
        </ul>
      ) : null}
      {debounced.length < 2 && !loading && items.length === 0 ? (
        <div className="border-border/60 bg-card/35 flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed px-4 text-center">
          <p className="text-muted-foreground text-sm font-medium">
            Summon a song and let the vibe gods decide.
          </p>
        </div>
      ) : null}
      {debounced.length >= 2 && !loading && items.length === 0 && !error ? (
        <div className="border-border/60 bg-card/35 flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed px-4 text-center">
          <p className="text-muted-foreground text-sm font-medium">
            No results found.
          </p>
        </div>
      ) : null}
      {loading && items.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-4 text-center">
          <p
            className="text-muted-foreground animate-pulse text-sm font-medium motion-reduce:animate-none"
            aria-live="polite"
          >
            Searching…
          </p>
        </div>
      ) : null}
    </div>
  );
}
