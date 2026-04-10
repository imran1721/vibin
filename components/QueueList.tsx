"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { QueueItem } from "@/lib/types";

export type QueuePlaybackControls = {
  isPaused: boolean;
  busy?: boolean;
  canPrevious: boolean;
  hasNowPlaying: boolean;
  onPrevious: () => void;
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  /** Relative seek in seconds (e.g. −10 / +10); synced for everyone in the room. */
  onSeekDelta?: (deltaSec: number) => void;
};

export type NowPlayingQueueRowProps = {
  item: QueueItem;
  playback?: QueuePlaybackControls;
  className?: string;
  /** Use `"li"` when this row sits inside the queue `<ul>`. */
  renderAs?: "div" | "li";
};

export type QueueListHandle = {
  /** Scroll the list so the current track sits at the top of the queue viewport. */
  scrollCurrentToTop: () => void;
};

type Props = {
  items: QueueItem[];
  onRemove: (id: string) => void;
  nowPlayingId: string | null;
  /** Tap a row to jump the room to this track (host + guests). */
  onPlayItem: (id: string) => void;
  playBusy?: boolean;
  /** Shown beside the “now playing” row for everyone in the room. */
  playback?: QueuePlaybackControls;
  /** Fired when the now-playing row enters/leaves the queue scroll viewport (for “Go to now playing” FAB). */
  onNowPlayingVisibleInQueueChange?: (visible: boolean) => void;
  /** When false, the list is hidden (e.g. queue collapsed); visibility is reported as “in view” for FAB logic. */
  listPanelOpen?: boolean;
};

const miniBtn =
  "border-border bg-card/90 text-foreground hover:bg-muted focus-visible:ring-ring inline-flex min-h-10 min-w-10 shrink-0 touch-manipulation items-center justify-center rounded-lg border leading-none transition-colors [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-9 sm:min-w-9";

const miniPlayBtn =
  "border-border bg-card/90 text-foreground hover:bg-muted focus-visible:ring-ring inline-flex min-h-10 min-w-[3.35rem] shrink-0 touch-manipulation items-center justify-center rounded-lg border px-2 leading-none transition-colors [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-9 sm:min-w-[3.25rem]";

const playbackGlyphClass =
  "size-[1.15rem] shrink-0 sm:size-[1.1875rem]";

function IconPrevious() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={playbackGlyphClass}
      aria-hidden
    >
      <path d="M5 5v14" />
      <path d="M19 5 8 12l11 7V5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconNext() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={playbackGlyphClass}
      aria-hidden
    >
      <path d="M19 5v14" />
      <path d="M5 5l11 7-11 7V5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconPlay() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={playbackGlyphClass}
      aria-hidden
    >
      <path d="M8 5v14l11-7-11-7z" />
    </svg>
  );
}

function IconPause() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={playbackGlyphClass}
      aria-hidden
    >
      <path d="M6 5h3v14H6V5zm9 0h3v14h-3V5z" />
    </svg>
  );
}

function scrollCurrentRowToTop(
  container: HTMLElement,
  target: HTMLElement,
  behavior: ScrollBehavior
) {
  const cRect = container.getBoundingClientRect();
  const tRect = target.getBoundingClientRect();
  const nextTop = container.scrollTop + (tRect.top - cRect.top);
  container.scrollTo({ top: Math.max(0, nextTop), behavior });
}

/** True when the now-playing row intersects the scroll container’s visible area (any scroll position). */
function isNowPlayingVisibleInContainer(container: HTMLElement, row: HTMLElement) {
  const c = container.getBoundingClientRect();
  const t = row.getBoundingClientRect();
  const margin = 8;
  return t.bottom > c.top + margin && t.top < c.bottom - margin;
}

function NowPlayingPlayback({
  playback,
}: {
  playback: QueuePlaybackControls;
}) {
  const {
    isPaused,
    busy,
    canPrevious,
    hasNowPlaying,
    onPrevious,
    onPlay,
    onPause,
    onNext,
    onSeekDelta,
  } = playback;
  const d = busy || !hasNowPlaying;

  return (
    <div
      className="border-border bg-background/70 flex shrink-0 flex-wrap items-center justify-center gap-1 border-t px-2 py-2 sm:border-l sm:border-t-0 sm:gap-0.5 sm:px-2 sm:py-2"
      role="group"
      aria-label="Playback controls"
    >
      <button
        type="button"
        className={miniBtn}
        disabled={!canPrevious || busy}
        onClick={() => onPrevious()}
        title="Previous track"
        aria-label="Previous track"
      >
        <IconPrevious />
      </button>
      {onSeekDelta ? (
        <button
          type="button"
          className={`${miniBtn} min-w-[3.15rem] text-[0.7rem] font-bold sm:min-w-12 sm:text-xs`}
          disabled={d}
          onClick={() => onSeekDelta(-10)}
          title="Back 10 seconds"
          aria-label="Back 10 seconds"
        >
          −10s
        </button>
      ) : null}
      {isPaused ? (
        <button
          type="button"
          className={miniPlayBtn}
          disabled={d}
          onClick={() => onPlay()}
          title="Play"
          aria-label="Play"
        >
          <IconPlay />
        </button>
      ) : (
        <button
          type="button"
          className={miniPlayBtn}
          disabled={d}
          onClick={() => onPause()}
          title="Pause"
          aria-label="Pause"
        >
          <IconPause />
        </button>
      )}
      {onSeekDelta ? (
        <button
          type="button"
          className={`${miniBtn} min-w-[3.15rem] text-[0.7rem] font-bold sm:min-w-12 sm:text-xs`}
          disabled={d}
          onClick={() => onSeekDelta(10)}
          title="Forward 10 seconds"
          aria-label="Forward 10 seconds"
        >
          +10s
        </button>
      ) : null}
      <button
        type="button"
        className={miniBtn}
        disabled={d}
        onClick={() => onNext()}
        title="Next track"
        aria-label="Next track"
      >
        <IconNext />
      </button>
    </div>
  );
}

/** Current track card — same chrome as the “now playing” row inside the queue list. */
export function NowPlayingQueueRow({
  item,
  playback,
  className = "",
  renderAs = "div",
}: NowPlayingQueueRowProps) {
  const Tag = renderAs;
  return (
    <Tag
      data-queue-id={item.id}
      className={`border-primary/60 ring-primary/20 flex min-h-12 flex-col items-stretch overflow-hidden rounded-xl border bg-primary/15 shadow-md shadow-primary/15 ring-1 transition-colors sm:flex-row ${className}`.trim()}
    >
      <div className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 sm:gap-3 sm:px-3.5">
        {item.thumb_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumb_url}
            alt=""
            width={88}
            height={50}
            className="h-11 w-20 shrink-0 rounded-md object-cover sm:h-12 sm:w-[4.75rem] sm:rounded-lg"
          />
        ) : (
          <div className="bg-muted h-11 w-20 shrink-0 rounded-md sm:h-12 sm:w-[4.75rem] sm:rounded-lg" />
        )}
        <div className="min-w-0 flex-1 py-0.5">
          <p className="text-foreground truncate text-sm font-semibold leading-snug">
            {item.title}
          </p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            <span className="text-primary font-semibold">Now playing</span>
            {item.added_by ? (
              <span className="text-muted-foreground">
                {" "}
                · {item.added_by}
              </span>
            ) : null}
          </p>
        </div>
      </div>
      {playback ? <NowPlayingPlayback playback={playback} /> : null}
    </Tag>
  );
}

export const QueueList = forwardRef<QueueListHandle, Props>(function QueueList(
  {
    items,
    onRemove,
    nowPlayingId,
    onPlayItem,
    playBusy,
    playback,
    onNowPlayingVisibleInQueueChange,
    listPanelOpen = true,
  },
  ref
) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAlignedNowId = useRef<string | null>(null);
  const scrollRafRef = useRef<number | null>(null);
  const lastVisibleNotified = useRef<boolean | null>(null);
  const prevNowPlayingIdRef = useRef<string | null>(null);
  const [recentlyPromotedNowId, setRecentlyPromotedNowId] = useState<string | null>(
    null
  );

  const currentIndex = useMemo(() => {
    if (!nowPlayingId) return -1;
    return items.findIndex((q) => q.id === nowPlayingId);
  }, [items, nowPlayingId]);

  const syncNowPlayingVisibility = useCallback(() => {
    if (!listPanelOpen) {
      if (lastVisibleNotified.current !== true) {
        lastVisibleNotified.current = true;
        onNowPlayingVisibleInQueueChange?.(true);
      }
      return;
    }
    const container = scrollRef.current;
    if (!container || !nowPlayingId || items.length === 0) {
      if (lastVisibleNotified.current !== false) {
        lastVisibleNotified.current = false;
        onNowPlayingVisibleInQueueChange?.(false);
      }
      return;
    }
    const target = container.querySelector<HTMLElement>(
      `[data-queue-id="${nowPlayingId}"]`
    );
    if (!target) {
      if (lastVisibleNotified.current !== false) {
        lastVisibleNotified.current = false;
        onNowPlayingVisibleInQueueChange?.(false);
      }
      return;
    }
    const visible = isNowPlayingVisibleInContainer(container, target);
    if (lastVisibleNotified.current !== visible) {
      lastVisibleNotified.current = visible;
      onNowPlayingVisibleInQueueChange?.(visible);
    }
  }, [
    listPanelOpen,
    nowPlayingId,
    items.length,
    onNowPlayingVisibleInQueueChange,
  ]);

  const scheduleSyncNowPlayingVisibility = useCallback(() => {
    if (scrollRafRef.current != null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      syncNowPlayingVisibility();
    });
  }, [syncNowPlayingVisibility]);

  const runScrollCurrentToTop = useCallback(() => {
    const container = scrollRef.current;
    if (!container || !nowPlayingId) return;
    const target = container.querySelector<HTMLElement>(
      `[data-queue-id="${nowPlayingId}"]`
    );
    if (!target) return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollCurrentRowToTop(
      container,
      target,
      reduceMotion ? "auto" : "smooth"
    );
    requestAnimationFrame(() => {
      requestAnimationFrame(syncNowPlayingVisibility);
    });
  }, [nowPlayingId, syncNowPlayingVisibility]);

  useImperativeHandle(
    ref,
    () => ({
      scrollCurrentToTop: () => {
        runScrollCurrentToTop();
      },
    }),
    [runScrollCurrentToTop]
  );

  useEffect(() => {
    const id = requestAnimationFrame(() => {
      syncNowPlayingVisibility();
    });
    return () => cancelAnimationFrame(id);
  }, [syncNowPlayingVisibility]);

  useEffect(() => {
    const prev = prevNowPlayingIdRef.current;
    prevNowPlayingIdRef.current = nowPlayingId;
    if (!nowPlayingId || !prev || prev === nowPlayingId) return;
    const rafId = window.requestAnimationFrame(() => {
      setRecentlyPromotedNowId(nowPlayingId);
    });
    const id = window.setTimeout(() => {
      setRecentlyPromotedNowId((cur) => (cur === nowPlayingId ? null : cur));
    }, 900);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.clearTimeout(id);
    };
  }, [nowPlayingId]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const onScroll = () => scheduleSyncNowPlayingVisibility();
    container.addEventListener("scroll", onScroll, { passive: true });

    const ro = new ResizeObserver(() => scheduleSyncNowPlayingVisibility());
    ro.observe(container);

    return () => {
      container.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (scrollRafRef.current != null) {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, [scheduleSyncNowPlayingVisibility]);

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container || !nowPlayingId || items.length === 0) return;

    const target = container.querySelector<HTMLElement>(
      `[data-queue-id="${nowPlayingId}"]`
    );
    if (!target) return;

    if (lastAlignedNowId.current !== nowPlayingId) {
      lastAlignedNowId.current = nowPlayingId;
      const reduceMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      scrollCurrentRowToTop(
        container,
        target,
        reduceMotion ? "auto" : "smooth"
      );
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(syncNowPlayingVisibility);
    });
  }, [nowPlayingId, items, syncNowPlayingVisibility]);

  if (items.length === 0) {
    return (
      <div className="border-border bg-card text-muted-foreground rounded-xl border border-dashed px-4 py-8">
        <div className="mx-auto flex max-w-md flex-col items-center text-center">
          <p className="text-foreground text-sm font-medium">Nothing queued yet</p>
          <p className="text-pretty mt-1.5 max-w-[28ch] text-xs leading-snug sm:text-sm">
            Use the YouTube search above and tap{" "}
            <span className="text-primary font-semibold">Add</span> to queue a
            track here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-0 w-full min-w-0 max-h-[min(52svh,24rem)] sm:max-h-[min(46svh,22rem)]">
      <div
        ref={scrollRef}
        className="max-h-[min(52svh,24rem)] min-h-0 min-w-0 w-full overflow-y-auto overflow-x-hidden overscroll-y-contain sm:max-h-[min(46svh,22rem)]"
        role="region"
        aria-label="Playback queue"
      >
        <ul
          className={`flex flex-col gap-2 pb-2 pr-1 ${playBusy ? "pointer-events-none opacity-55" : ""}`}
        >
          {items.map((item, index) => {
            const isNow = item.id === nowPlayingId;
            const queueMeta =
              currentIndex >= 0 ? (
                index < currentIndex ? (
                  <span className="text-muted-foreground">Played</span>
                ) : index === currentIndex + 1 ? (
                  <span>
                    <span className="text-primary font-semibold">Up next</span>
                    <span className="text-muted-foreground"> · queued</span>
                  </span>
                ) : index > currentIndex ? (
                  <span>
                    <span className="text-muted-foreground">Queued</span> · #
                    {index - currentIndex}
                  </span>
                ) : null
              ) : (
                <span>#{index + 1} in queue</span>
              );

            if (isNow) {
              return (
                <NowPlayingQueueRow
                  key={item.id}
                  renderAs="li"
                  item={item}
                  playback={playback}
                  className={
                    recentlyPromotedNowId === item.id ? "vibin-now-promoted" : ""
                  }
                />
              );
            }

            return (
              <li
                key={item.id}
                data-queue-id={item.id}
                className="border-border flex min-h-12 flex-row items-stretch overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/25"
              >
                <button
                  type="button"
                  disabled={playBusy}
                  onClick={() => onPlayItem(item.id)}
                  title="Play this track"
                  className="flex min-h-12 min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-primary/5 active:bg-primary/10 sm:gap-3 sm:px-3.5 disabled:cursor-wait"
                >
                      {item.thumb_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumb_url}
                          alt=""
                          width={88}
                          height={50}
                          className="h-11 w-20 shrink-0 rounded-md object-cover sm:h-12 sm:w-[4.75rem] sm:rounded-lg"
                        />
                      ) : (
                        <div className="bg-muted h-11 w-20 shrink-0 rounded-md sm:h-12 sm:w-[4.75rem] sm:rounded-lg" />
                      )}
                      <div className="min-w-0 flex-1 py-0.5">
                        <p className="text-foreground truncate text-sm font-semibold leading-snug">
                          {item.title}
                        </p>
                        <p className="text-muted-foreground mt-0.5 text-xs">
                          {queueMeta}
                          {item.added_by ? (
                            <span className="text-muted-foreground">
                              {" "}
                              · {item.added_by}
                            </span>
                          ) : null}
                        </p>
                      </div>
                </button>
                    <button
                      type="button"
                      disabled={playBusy}
                      onClick={() => onRemove(item.id)}
                      className="border-border text-muted-foreground hover:text-destructive focus-visible:ring-ring inline-flex min-h-12 shrink-0 items-center justify-center border-l px-2.5 text-xs font-semibold underline-offset-4 transition-colors hover:underline focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-3.5"
                    >
                      Remove
                    </button>
              </li>
            );
          })}
        </ul>
      </div>
      <style jsx global>{`
        @keyframes vibin-now-promoted {
          0% {
            transform: translateY(6px) scale(0.985);
            opacity: 0.7;
          }
          55% {
            transform: translateY(0) scale(1.01);
            opacity: 1;
          }
          100% {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }
        .vibin-now-promoted {
          animation: vibin-now-promoted 0.9s cubic-bezier(0.22, 1, 0.36, 1);
        }
      `}</style>
    </div>
  );
});

QueueList.displayName = "QueueList";
