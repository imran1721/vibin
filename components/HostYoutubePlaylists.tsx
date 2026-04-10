"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
type Props = {
  roomId: string;
  /** `null` when anonymous — queue rows omit attribution. */
  queueAttributionLabel: string | null;
  /** Called after a successful add when the user chose a display name. */
  onQueueActivity?: (message: string) => void;
  onImported?: () => void;
  /** Hide title + description; use when a parent provides the section heading (e.g. collapsible). */
  omitSectionChrome?: boolean;
  /** YouTube `videoId`s already in the room queue — per-track button shows “Added”. */
  queuedVideoIds?: ReadonlySet<string>;
  /** Optional parent-triggered refresh action (e.g. remount/cache bust). */
  onRequestRefresh?: () => void;
};

type Playlist = { id: string; title: string; itemCount?: number };
type PlItem = { videoId: string; title: string; thumbUrl: string };

const panelClass =
  "border-border bg-card min-w-0 w-full max-w-full rounded-xl border p-3 shadow-sm sm:p-4";

const plAddBtnClass =
  "bg-primary text-primary-foreground focus-visible:ring-ring hover:brightness-105 active:brightness-95 inline-flex min-h-9 min-w-[3.75rem] shrink-0 items-center justify-center rounded-lg px-2.5 text-[0.65rem] font-bold transition-[filter,transform] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-10 sm:min-w-[4.25rem] sm:px-3 sm:text-xs";

const plAddedBtnClass =
  "border-border bg-muted/55 text-muted-foreground inline-flex min-h-9 min-w-[3.75rem] shrink-0 cursor-default items-center justify-center rounded-lg border px-2.5 text-[0.65rem] font-semibold sm:min-h-10 sm:min-w-[4.25rem] sm:px-3 sm:text-xs";

function shortTrackTitle(title: string, max = 36): string {
  const t = title.trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

export function HostYoutubePlaylists({
  roomId,
  queueAttributionLabel,
  onQueueActivity,
  onImported,
  omitSectionChrome = false,
  queuedVideoIds,
  onRequestRefresh,
}: Props) {
  const searchParams = useSearchParams();
  const [connected, setConnected] = useState(false);
  const [plLoading, setPlLoading] = useState(true);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [itemsByPlaylist, setItemsByPlaylist] = useState<
    Record<string, PlItem[]>
  >({});
  const [itemsLoading, setItemsLoading] = useState<string | null>(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const [singleAddBusyId, setSingleAddBusyId] = useState<string | null>(null);

  const getAccessToken = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const loadPlaylists = useCallback(async () => {
    setListError(null);
    setPlLoading(true);
    const t = await getAccessToken();
    if (!t) {
      setConnected(false);
      setPlaylists([]);
      setPlLoading(false);
      return;
    }
    const res = await fetch("/api/youtube/playlists", {
      headers: { Authorization: `Bearer ${t}` },
    });
    const data = (await res.json()) as {
      playlists?: Playlist[];
      error?: string;
    };
    if (data.error === "not_connected") {
      setConnected(false);
      setPlaylists([]);
      setPlLoading(false);
      return;
    }
    if (!res.ok) {
      setListError(data.error ?? "Failed to load playlists");
      setConnected(false);
      setPlaylists([]);
      setPlLoading(false);
      return;
    }
    setConnected(true);
    setPlaylists(data.playlists ?? []);
    setPlLoading(false);
  }, [getAccessToken]);

  useEffect(() => {
    void loadPlaylists();
  }, [loadPlaylists]);

  useEffect(() => {
    if (searchParams.get("youtube_connected") === "1") {
      void loadPlaylists();
      const u = new URL(window.location.href);
      u.searchParams.delete("youtube_connected");
      window.history.replaceState({}, "", u.toString());
    }
  }, [searchParams, loadPlaylists]);

  const startConnect = async () => {
    setImportMsg(null);
    const t = await getAccessToken();
    if (!t) return;
    const returnTo =
      typeof window !== "undefined"
        ? `${window.location.pathname}${window.location.search}`
        : "/";
    const res = await fetch("/api/youtube/oauth/start", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ returnTo }),
    });
    const data = (await res.json()) as { url?: string; error?: string };
    if (!res.ok || !data.url) {
      setListError(data.error ?? "Could not start Google sign-in");
      return;
    }
    window.location.href = data.url;
  };

  const disconnect = async () => {
    setImportMsg(null);
    const t = await getAccessToken();
    if (!t) return;
    await fetch("/api/youtube/disconnect", {
      method: "POST",
      headers: { Authorization: `Bearer ${t}` },
    });
    setItemsByPlaylist({});
    setExpandedId(null);
    await loadPlaylists();
  };

  const togglePlaylist = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (itemsByPlaylist[id]) return;
    setItemsLoading(id);
    const t = await getAccessToken();
    if (!t) return;
    const res = await fetch(`/api/youtube/playlist/${id}/items`, {
      headers: { Authorization: `Bearer ${t}` },
    });
    const data = (await res.json()) as { items?: PlItem[]; error?: string };
    setItemsLoading(null);
    if (!res.ok) {
      setListError(data.error ?? "Failed to load tracks");
      return;
    }
    setItemsByPlaylist((prev) => ({ ...prev, [id]: data.items ?? [] }));
  };

  const addSingleToQueue = useCallback(
    async (it: PlItem) => {
      setImportMsg(null);
      setSingleAddBusyId(it.videoId);
      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.from("queue_items").insert({
          room_id: roomId,
          video_id: it.videoId,
          title: it.title,
          thumb_url: it.thumbUrl || null,
          added_by: queueAttributionLabel,
        });
        if (error) {
          setImportMsg(error.message);
          return;
        }
        if (queueAttributionLabel) {
          onQueueActivity?.(
            `${queueAttributionLabel} added “${shortTrackTitle(it.title)}”`
          );
        }
        onImported?.();
      } finally {
        setSingleAddBusyId(null);
      }
    },
    [roomId, queueAttributionLabel, onQueueActivity, onImported]
  );

  const importPlaylist = async (
    playlistId: string,
    mode: "append" | "replace"
  ) => {
    setImportBusy(true);
    setImportMsg(null);
    try {
      const t = await getAccessToken();
      if (!t) return;
      const res = await fetch("/api/youtube/import-playlist", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${t}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          roomId,
          playlistId,
          mode,
          addedBy: queueAttributionLabel,
        }),
      });
      const data = (await res.json()) as {
        imported?: number;
        error?: string;
        mode?: string;
      };
      if (!res.ok) {
        setImportMsg(data.error ?? "Import failed");
        return;
      }
      setImportMsg(
        `${mode === "replace" ? "Replaced queue with" : "Added"} ${data.imported ?? 0} videos.`
      );
      if (queueAttributionLabel && (data.imported ?? 0) > 0) {
        onQueueActivity?.(
          `${queueAttributionLabel} ${mode === "replace" ? "replaced the queue with" : "added"} ${data.imported} tracks from a playlist`
        );
      }
      onImported?.();
    } finally {
      setImportBusy(false);
    }
  };

  const disconnectBtn = !plLoading && connected && (
    <button
      type="button"
      onClick={() => void disconnect()}
      className="text-muted-foreground hover:text-foreground text-xs font-semibold underline underline-offset-2"
    >
      Disconnect Google
    </button>
  );

  const refreshBtn = !plLoading && connected && onRequestRefresh ? (
    <button
      type="button"
      onClick={onRequestRefresh}
      className="text-muted-foreground hover:text-foreground text-xs font-semibold underline underline-offset-2"
    >
      Refresh
    </button>
  ) : null;

  const inner = (
    <>

      {listError && (
        <p className="text-destructive mt-2.5 text-sm" role="alert">
          {listError}
        </p>
      )}

      {importMsg && (
        <p className="text-accent mt-2.5 text-sm font-medium" role="status">
          {importMsg}
        </p>
      )}

      {plLoading && (
        <div className="mt-2.5 flex min-h-0 flex-1 items-center justify-center">
          <p className="text-muted-foreground text-xs">
            Tuning the playlist satellites…
          </p>
        </div>
      )}

      {!plLoading && !connected && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => void startConnect()}
            className="bg-primary text-primary-foreground hover:brightness-105 inline-flex min-h-10 w-full max-w-sm items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold transition-[filter] sm:min-h-11 sm:w-auto"
          >
            Connect Google (YouTube)
          </button>
        </div>
      )}

      {!plLoading && connected && playlists.length === 0 && !listError && (
        <p className="text-muted-foreground mt-3 text-center text-sm">
          No playlists found on this account.
        </p>
      )}

      {!plLoading && connected && playlists.length > 0 && (
        <div
          className={`mt-3 min-h-0 min-w-0 w-full overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-lg ${
            omitSectionChrome
              ? "flex-1 max-h-none"
              : "max-h-[min(48svh,22rem)] sm:max-h-[min(40svh,20rem)]"
          }`}
          role="region"
          aria-label="Scrollable playlist list"
        >
          <ul className="flex min-w-0 w-full flex-col gap-1.5 pb-2 pr-1">
            {playlists.map((pl) => {
              const open = expandedId === pl.id;
              const items = itemsByPlaylist[pl.id];
              const loading = itemsLoading === pl.id;
              return (
                <li
                  key={pl.id}
                  className="border-border min-w-0 overflow-hidden rounded-xl border"
                >
                  <button
                    type="button"
                    onClick={() => void togglePlaylist(pl.id)}
                    className="hover:bg-muted/50 flex w-full items-center justify-between gap-2 px-2.5 py-2.5 text-left transition-colors sm:px-3.5"
                  >
                    <span className="text-foreground min-w-0 flex-1 truncate font-semibold">
                      {pl.title}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-xs">
                      {pl.itemCount != null ? `${pl.itemCount} · ` : ""}
                      {open ? "Hide" : "Show"}
                    </span>
                  </button>
                  {open && (
                    <div className="border-border border-t px-2.5 py-2.5 sm:px-3.5">
                      {loading && (
                        <p className="text-muted-foreground text-xs">
                          Loading…
                        </p>
                      )}
                      {!loading && items && (
                        <>
                          <div className="mb-2 flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              disabled={importBusy}
                              onClick={() =>
                                void importPlaylist(pl.id, "append")
                              }
                              className="bg-primary/15 text-primary hover:bg-primary/25 inline-flex min-h-8 items-center rounded-md px-2 py-1 text-[0.65rem] font-bold disabled:opacity-50 sm:text-xs"
                            >
                              Add all to queue
                            </button>
                            <button
                              type="button"
                              disabled={importBusy}
                              onClick={() =>
                                void importPlaylist(pl.id, "replace")
                              }
                              className="border-border hover:bg-muted inline-flex min-h-8 items-center rounded-md border px-2 py-1 text-[0.65rem] font-semibold disabled:opacity-50 sm:text-xs"
                            >
                              Replace queue
                            </button>
                          </div>
                          <ul
                            className="border-border max-h-[min(42svh,18rem)] min-w-0 overflow-y-auto overflow-x-hidden overscroll-y-contain rounded-lg border text-sm sm:max-h-[min(36svh,16rem)]"
                            aria-label="Tracks in this playlist"
                          >
                            {items.map((it) => {
                              const rowBusy =
                                singleAddBusyId === it.videoId || importBusy;
                              const inQueue =
                                queuedVideoIds?.has(it.videoId) ?? false;
                              return (
                                <li
                                  key={it.videoId}
                                  className="border-border flex min-w-0 items-center gap-2 border-b py-2 pl-2 pr-1.5 last:border-b-0 sm:gap-2.5 sm:py-2.5 sm:pl-2.5 sm:pr-2"
                                >
                                  {it.thumbUrl ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={it.thumbUrl}
                                      alt=""
                                      width={96}
                                      height={54}
                                      className="h-10 w-[4.5rem] shrink-0 rounded-md object-cover sm:h-11 sm:w-20"
                                    />
                                  ) : (
                                    <div className="bg-muted h-10 w-[4.5rem] shrink-0 rounded-md sm:h-11 sm:w-20" />
                                  )}
                                  <p className="text-foreground min-w-0 flex-1 break-words text-xs font-medium leading-snug sm:text-sm">
                                    {it.title}
                                  </p>
                                  <button
                                    type="button"
                                    disabled={rowBusy || inQueue}
                                    onClick={() => void addSingleToQueue(it)}
                                    aria-label={
                                      inQueue ? "Already in queue" : "Add to queue"
                                    }
                                    className={
                                      inQueue ? plAddedBtnClass : plAddBtnClass
                                    }
                                  >
                                    {singleAddBusyId === it.videoId
                                      ? "…"
                                      : inQueue
                                        ? "Added"
                                        : "Add"}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </>
  );

  if (omitSectionChrome) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        {refreshBtn || disconnectBtn ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-auto">{refreshBtn}</div>
            {disconnectBtn}
          </div>
        ) : null}
        {inner}
      </div>
    );
  }

  return (
    <section className={panelClass} aria-labelledby="yt-pl-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2
            id="yt-pl-heading"
            className="font-display text-foreground text-lg font-bold"
          >
            YouTube playlists
          </h2>
          <p className="text-muted-foreground mt-1 text-[0.7rem] leading-snug sm:text-xs">
            Connect Google to list playlists from your account. Add one track,
            add everything, or replace the whole queue.
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2">
          <div className="mr-auto">{refreshBtn}</div>
          {disconnectBtn}
        </div>
      </div>
      {inner}
    </section>
  );
}
