"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { YouTubeSearchItem } from "@/lib/types";

type Preset = {
  id: string;
  label: string;
  description: string;
};

const presets: Preset[] = [
  {
    id: "house-party",
    label: "House party",
    description: "Pop + EDM everyone knows",
  },
  { id: "chill", label: "Chill", description: "Cozy, mellow, modern" },
  { id: "focus", label: "Focus", description: "Low distraction" },
  { id: "throwbacks", label: "Throwbacks", description: "2000s/2010s hits" },
  { id: "global-hits", label: "Global hits", description: "Across languages" },
  { id: "surprise", label: "Surprise me", description: "A fun mix" },
];

type Props = {
  onAdd: (item: YouTubeSearchItem) => Promise<boolean> | boolean;
  queuedVideoIds?: ReadonlySet<string>;
  disabled?: boolean;
};

const pillBtnClass =
  "border-border bg-card/70 text-foreground hover:bg-muted/70 focus-visible:ring-ring inline-flex min-h-11 items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

const primaryBtnClass =
  "bg-primary text-primary-foreground focus-visible:ring-ring hover:brightness-105 active:brightness-95 inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition-[filter] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

const secondaryBtnClass =
  "border-border bg-muted/55 text-foreground hover:bg-muted/75 focus-visible:ring-ring inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

function normalizeQuery(q: string) {
  return q.replace(/\s+/g, " ").trim();
}

export function ColdStartRecommender({
  onAdd,
  queuedVideoIds,
  disabled,
}: Props) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>("house-party");
  const [customVibe, setCustomVibe] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<YouTubeSearchItem[]>([]);
  const [addingIds, setAddingIds] = useState<Set<string>>(() => new Set());
  const inFlightRef = useRef(false);

  const vibe = useMemo(() => {
    const v = normalizeQuery(customVibe);
    return v.length >= 2 ? v : selectedPresetId;
  }, [customVibe, selectedPresetId]);

  const resolveQueryToTopItem = useCallback(async (query: string) => {
    const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
    const data = (await res.json()) as {
      items?: YouTubeSearchItem[];
      error?: string;
    };
    if (!res.ok) {
      throw new Error(data.error ?? "YouTube search failed");
    }
    return data.items?.[0] ?? null;
  }, []);

  const generate = useCallback(async () => {
    if (disabled || loading) return;
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    setLoading(true);
    setError(null);
    setItems([]);
    try {
      const res = await fetch(
        `/api/recommendations/cold-start?vibe=${encodeURIComponent(vibe)}&count=12`
      );
      const data = (await res.json()) as { queries?: string[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? "Recommendation failed");
      }

      const queries = (data.queries ?? [])
        .map((q) => normalizeQuery(q))
        .filter(Boolean)
        .slice(0, 12);

      if (queries.length === 0) {
        throw new Error("No recommendations returned");
      }

      const results = await Promise.all(
        queries.map(async (q) => {
          try {
            return await resolveQueryToTopItem(q);
          } catch {
            return null;
          }
        })
      );

      const deduped: YouTubeSearchItem[] = [];
      const seen = new Set<string>();
      for (const it of results) {
        if (!it?.videoId) continue;
        if (seen.has(it.videoId)) continue;
        if (queuedVideoIds?.has(it.videoId)) continue;
        seen.add(it.videoId);
        deduped.push(it);
      }

      if (deduped.length === 0) {
        throw new Error("Could not resolve recommendations on YouTube");
      }

      setItems(deduped);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Recommendation failed");
    } finally {
      setLoading(false);
      inFlightRef.current = false;
    }
  }, [disabled, loading, queuedVideoIds, resolveQueryToTopItem, vibe]);

  const addOne = useCallback(
    async (it: YouTubeSearchItem) => {
      if (disabled) return;
      if (queuedVideoIds?.has(it.videoId)) return;
      setAddingIds((prev) => {
        const next = new Set(prev);
        next.add(it.videoId);
        return next;
      });
      try {
        const ok = await Promise.resolve(onAdd(it));
        if (ok) {
          setItems((prev) => prev.filter((x) => x.videoId !== it.videoId));
        }
      } finally {
        setAddingIds((prev) => {
          const next = new Set(prev);
          next.delete(it.videoId);
          return next;
        });
      }
    },
    [disabled, onAdd, queuedVideoIds]
  );

  const addAll = useCallback(async () => {
    if (disabled) return;
    for (const it of items) {
      if (queuedVideoIds?.has(it.videoId)) continue;
      // eslint-disable-next-line no-await-in-loop
      await addOne(it);
    }
  }, [addOne, disabled, items, queuedVideoIds]);

  return (
    <section
      aria-label="Start a vibe"
      className="border-border bg-card/45 w-full rounded-2xl border px-4 py-3.5 shadow-sm backdrop-blur-sm"
    >
      <div className="flex flex-col gap-1.5">
        <p className="text-foreground font-display text-base font-bold">
          Start a vibe
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          New room, empty queue. Generate a few picks, then add what you like.
        </p>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {presets.map((p) => {
          const selected = selectedPresetId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              className={`${pillBtnClass} ${selected ? "border-primary/45 ring-1 ring-primary/15" : ""}`}
              onClick={() => setSelectedPresetId(p.id)}
              disabled={disabled || loading}
            >
              <span className="min-w-0">
                <span className="text-foreground block text-sm font-semibold">
                  {p.label}
                </span>
                <span className="text-muted-foreground block text-[0.7rem] leading-snug">
                  {p.description}
                </span>
              </span>
              <span
                className={`shrink-0 rounded-full px-2 py-1 text-[0.65rem] font-semibold ${selected ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground"}`}
              >
                {selected ? "Selected" : "Pick"}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        <label className="text-foreground my-1.5 block text-sm font-semibold">
          Or describe your vibe
        </label>
        <input
          type="text"
          value={customVibe}
          onChange={(e) => setCustomVibe(e.target.value)}
          placeholder='e.g. "late-night lo-fi, no sad songs"'
          disabled={disabled || loading}
          className="border-border bg-surface-elevated text-foreground placeholder:text-muted-foreground focus-visible:ring-ring min-h-10 w-full rounded-xl border px-3.5 py-2.5 text-[0.9375rem] outline-none transition-[box-shadow,background-color] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-base"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={generate}
          className={primaryBtnClass}
          disabled={disabled || loading}
        >
          {loading ? "Generating…" : "Generate picks"}
        </button>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={addAll}
            className={secondaryBtnClass}
            disabled={disabled || loading}
          >
            Add all
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="text-destructive mt-2 text-sm font-medium" role="alert">
          {error}
        </p>
      ) : null}

      {items.length > 0 ? (
        <ul
          className="border-border mt-3 max-h-[min(46vh,18rem)] w-full overflow-y-auto overscroll-y-contain rounded-xl border px-3"
          aria-label="Recommended tracks"
        >
          {items.map((it) => {
            const inQueue = queuedVideoIds?.has(it.videoId) ?? false;
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
                <p className="text-foreground min-w-0 flex-1 break-words text-sm font-medium leading-snug">
                  {it.title}
                </p>
                <button
                  type="button"
                  disabled={disabled || inQueue || isAdding}
                  onClick={() => void addOne(it)}
                  className="bg-primary text-primary-foreground focus-visible:ring-ring hover:brightness-105 active:brightness-95 inline-flex min-h-10 min-w-[4.25rem] shrink-0 items-center justify-center rounded-lg px-3 text-xs font-bold transition-[filter,transform] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-11 sm:min-w-[4.5rem] sm:rounded-xl sm:px-4"
                >
                  {inQueue ? "Added" : isAdding ? "Adding…" : "Add"}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}

