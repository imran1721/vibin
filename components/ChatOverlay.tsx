"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { YouTubeSearchItem } from "@/lib/types";

export type ChatTextMessage = {
  id: string;
  text: string;
  createdAtIso: string;
  senderUserId: string | null;
  senderLabel: string;
};

export type ChatRecsMessage = {
  id: string;
  kind: "recs";
  title: string;
  createdAtIso: string;
  senderUserId: null;
  senderLabel: "Vibin AI";
  items: YouTubeSearchItem[];
};

export type ChatMessage =
  | (ChatTextMessage & { kind?: "text" })
  | ChatRecsMessage;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomLabel: string;
  myUserId: string | null;
  myLabel: string;
  messages: ChatMessage[];
  aiTyping?: boolean;
  suggestions?: string[];
  onPickSuggestion?: (text: string) => void;
  onAddRecItem?: (item: YouTubeSearchItem) => void | Promise<void>;
  onSend: (text: string) => Promise<void> | void;
};

const iconBtn =
  "text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-10 items-center justify-center rounded-xl transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const inputClass =
  "border-border bg-surface-elevated text-foreground placeholder:text-muted-foreground focus-visible:ring-ring min-h-11 w-full rounded-xl border px-3.5 py-2.5 text-[0.9375rem] outline-none transition-[box-shadow,background-color] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:text-base";

const sendBtnClass =
  "bg-primary text-primary-foreground focus-visible:ring-ring hover:brightness-105 active:brightness-95 inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl px-4 text-sm font-bold transition-[filter] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50";

/** Suggestion starters: multi-line OK, must not overflow narrow chat panes. */
const suggestionChipClass =
  "border-border bg-card/70 text-foreground hover:bg-muted/70 focus-visible:ring-ring inline-flex min-h-9 w-full min-w-0 items-center justify-start gap-1 rounded-2xl border px-3.5 py-2.5 text-left text-xs font-semibold leading-snug transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background [overflow-wrap:anywhere] break-words whitespace-normal";

function isBlank(s: string) {
  return s.trim().length === 0;
}

export function ChatOverlay({
  open,
  onOpenChange,
  roomLabel,
  myUserId,
  myLabel,
  messages,
  aiTyping,
  suggestions,
  onPickSuggestion,
  onAddRecItem,
  onSend,
}: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const prevScrollLockRef = useRef<{
    htmlOverflow: string;
    bodyOverflow: string;
    bodyPosition: string;
    bodyTop: string;
    bodyWidth: string;
    scrollY: number;
  } | null>(null);

  const title = useMemo(() => `Chat · ${roomLabel}`, [roomLabel]);

  useEffect(() => {
    if (!open) return;
    if (typeof window === "undefined") return;

    // Lock background scroll while modal is open.
    // `dialog.showModal()` doesn't reliably prevent scrolling on iOS/Safari.
    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY || 0;

    prevScrollLockRef.current = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyWidth: body.style.width,
      scrollY,
    };

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      const prev = prevScrollLockRef.current;
      if (!prev) return;
      html.style.overflow = prev.htmlOverflow;
      body.style.overflow = prev.bodyOverflow;
      body.style.position = prev.bodyPosition;
      body.style.top = prev.bodyTop;
      body.style.width = prev.bodyWidth;
      window.scrollTo(0, prev.scrollY);
      prevScrollLockRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const onDialogClose = () => onOpenChange(false);
    d.addEventListener("close", onDialogClose);
    return () => d.removeEventListener("close", onDialogClose);
  }, [onOpenChange]);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open) {
      if (!d.open) d.showModal();
    } else if (d.open) {
      d.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // Scroll to bottom after new messages.
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [open, messages.length]);

  return (
    <dialog
      ref={dialogRef}
      className="text-foreground fixed inset-0 z-[120] m-0 h-[100dvh] w-[100dvw] overflow-hidden bg-transparent p-0 [&::backdrop]:bg-black/50 [&::backdrop]:backdrop-blur-[2px]"
      onClick={(e) => {
        if (e.target === dialogRef.current) onOpenChange(false);
      }}
      aria-label={title}
    >
      <div className="pointer-events-none fixed inset-0 flex items-end justify-center sm:items-center sm:p-6">
        <div className="border-border bg-background pointer-events-auto flex h-[min(100dvh,42rem)] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border shadow-2xl sm:h-[min(92dvh,44rem)] sm:rounded-3xl">
          <div className="border-border flex items-center justify-between gap-3 border-b px-5 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))] sm:pt-4">
            <div className="min-w-0">
              <p className="font-display text-base font-bold leading-tight sm:text-lg">
                Chat
              </p>
              <p className="text-muted-foreground truncate text-xs sm:text-sm">
                {roomLabel}
              </p>
            </div>
            <button
              type="button"
              className={iconBtn}
              onClick={() => onOpenChange(false)}
              aria-label="Close chat"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-5"
                aria-hidden
              >
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <ul
            ref={listRef}
            className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-5 py-4"
            aria-label="Messages"
          >
            {messages.map((m) => {
              if ((m as ChatRecsMessage).kind === "recs") {
                const rec = m as ChatRecsMessage;
                return (
                  <li key={rec.id} className="flex justify-start">
                    <div className="border-border bg-card/45 w-full rounded-2xl border px-4 py-3">
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-foreground text-sm font-semibold">
                          {rec.title}
                        </p>
                        <time
                          className="text-muted-foreground text-[0.65rem]"
                          dateTime={rec.createdAtIso}
                          title={new Date(rec.createdAtIso).toLocaleString()}
                        >
                          {new Date(rec.createdAtIso).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                      <ul className="mt-2 flex flex-col gap-2">
                        {rec.items.slice(0, 8).map((it) => (
                          <li
                            key={it.videoId}
                            className="border-border/70 flex items-center gap-2 rounded-xl border px-2.5 py-2"
                          >
                            {it.thumbUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={it.thumbUrl}
                                alt=""
                                width={64}
                                height={36}
                                className="h-9 w-16 shrink-0 rounded-md object-cover"
                              />
                            ) : (
                              <div className="bg-muted h-9 w-16 shrink-0 rounded-md" />
                            )}
                            <p className="text-foreground min-w-0 flex-1 break-words text-xs font-medium leading-snug">
                              {it.title}
                            </p>
                            <button
                              type="button"
                              onClick={() => void onAddRecItem?.(it)}
                              className="bg-primary text-primary-foreground focus-visible:ring-ring hover:brightness-105 active:brightness-95 inline-flex min-h-9 shrink-0 items-center justify-center rounded-lg px-3 text-[0.7rem] font-bold transition-[filter] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            >
                              Add
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </li>
                );
              }

              const mine = myUserId != null && m.senderUserId === myUserId;
              const label = mine ? "You" : m.senderLabel || "Anonymous";
              return (
                <li
                  key={m.id}
                  className={`flex ${mine ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`border-border max-w-[85%] rounded-2xl border px-3.5 py-2.5 sm:max-w-[70%] ${mine ? "bg-primary/10" : "bg-card/70"}`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-foreground text-xs font-semibold">
                        {label}
                      </p>
                      <time
                        className="text-muted-foreground text-[0.65rem]"
                        dateTime={m.createdAtIso}
                        title={new Date(m.createdAtIso).toLocaleString()}
                      >
                        {new Date(m.createdAtIso).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                    <p className="text-foreground mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {"text" in m ? m.text : ""}
                    </p>
                  </div>
                </li>
              );
            })}

            {aiTyping ? (
              <li className="flex justify-start pt-1">
                <div className="border-border bg-card/70 max-w-[85%] rounded-2xl border px-3.5 py-2.5 sm:max-w-[70%]">
                  <p className="text-foreground text-xs font-semibold">
                    Vibin AI
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm font-medium animate-pulse motion-reduce:animate-none">
                    Thinking…
                  </p>
                </div>
              </li>
            ) : null}

            {suggestions && suggestions.length > 0 ? (
              <li className="border-border bg-card/35 min-w-0 w-full max-w-full rounded-2xl border px-4 py-3.5 pt-4">
                <p className="text-foreground font-display text-sm font-bold leading-tight">
                  Start a vibe
                </p>
                <p className="text-muted-foreground mt-1.5 max-w-prose text-xs leading-relaxed">
                  Tap a starter to get video ideas in this chat, or type your own ask
                  below.
                </p>
                <p className="text-muted-foreground mt-3 mb-2 text-[0.65rem] font-semibold uppercase tracking-wider">
                  Ask Vibin AI
                </p>
                <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={`${i}-${s.slice(0, 48)}`}
                      type="button"
                      className={suggestionChipClass}
                      onClick={() => onPickSuggestion?.(s)}
                      title="Search YouTube for ideas matching this theme"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </li>
            ) : null}
          </ul>

          <form
            className="border-border flex gap-2 border-t px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              const text = draft.trim();
              if (isBlank(text) || sending) return;
              setSending(true);
              void Promise.resolve(onSend(text))
                .then(() => {
                  setDraft("");
                })
                .finally(() => setSending(false));
            }}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={`Message as ${myLabel || "Anonymous"}…`}
              className={inputClass}
              autoComplete="off"
              enterKeyHint="send"
            />
            <button
              type="submit"
              className={sendBtnClass}
              disabled={sending || isBlank(draft)}
            >
              {sending ? "Sending…" : "Send"}
            </button>
          </form>
        </div>
      </div>
    </dialog>
  );
}

