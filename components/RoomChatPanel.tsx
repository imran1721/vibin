"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";

/* =========================================================================
   RoomChatPanel — full-featured chat panel ported from the Lepton mock.
   Persistent right sidebar on desktop; bottom-sheet on mobile. Includes:
   - presence row
   - typing indicator
   - message bubbles with avatar, mentions, GIFs, reactions
   - hover toolbar (add reaction, reply/pin)
   - composer with @ autocomplete, GIF picker, "React at timestamp" toggle
   ========================================================================= */

export type ChatPerson = {
  id: string;
  name: string;
  letter: string;
  avatarDataUrl?: string | null;
  gradient?: string;
  isHost?: boolean;
  online?: boolean;
};

export type ChatReactions = Record<string, { userIds: string[] }>;

export type ChatMessage = {
  id: string;
  authorId: string | null;
  authorLabel: string;
  text: string;
  createdAtIso: string;
  avatarDataUrl?: string | null;
  mentions?: string[];
  gif?: string | null;
  pinnedToSec?: number | null;
  reactions?: ChatReactions;
  pending?: boolean;
};

type SendPayload = {
  text: string;
  mentions: string[];
  gif: string | null;
  pinnedToSec: number | null;
};

type Props = {
  mobile?: boolean;
  people: ChatPerson[];
  messages: ChatMessage[];
  currentUserId: string | null;
  currentUserLabel: string;
  typingLabels: string[];
  videoTime: number;
  /** Full participant count (host + guests). */
  presenceCount?: number;
  onSend: (payload: SendPayload) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onJumpTo?: (sec: number) => void;
  onQuickReaction?: (emoji: string) => void;
  onTyping?: (isTyping: boolean) => void;
  onClose?: () => void;
  onOpenPresence?: () => void;
};

const REACTIONS_POOL = ["🔥", "👏", "😂", "❤️", "🎉", "😭", "🙌", "💯"];
const QUICK_REACTIONS = ["🔥", "👏", "😂", "❤️"];
const GIF_VARIANTS = ["concert", "dance", "lofi", "stage"] as const;

export function RoomChatPanel({
  mobile = false,
  people,
  messages,
  currentUserId,
  currentUserLabel,
  typingLabels,
  videoTime,
  presenceCount,
  onSend,
  onToggleReaction,
  onJumpTo,
  onQuickReaction,
  onTyping,
  onClose,
  onOpenPresence,
}: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [pinNext, setPinNext] = useState(false);
  const [stickToBottom, setStickToBottom] = useState(true);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottom) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, stickToBottom]);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 40;
    const atBottom =
      el.scrollHeight - (el.scrollTop + el.clientHeight) < threshold;
    setStickToBottom(atBottom);
  }, []);

  const resolvedPresenceCount = presenceCount ?? people.length;

  return (
    <aside
      className="flex min-h-0 flex-col"
      style={{
        width: mobile ? "100%" : 360,
        height: mobile ? "100%" : undefined,
        flex: mobile ? 1 : "none",
        background:
          "color-mix(in oklch, var(--card) 75%, var(--bg-shell))",
        borderLeft: mobile
          ? 0
          : "1px solid color-mix(in oklch, var(--border) 50%, transparent)",
      }}
    >
      <ChatHeader
        count={messages.length}
        mobile={mobile}
        onClose={onClose}
      />
      <PresenceRow
        people={people}
        count={resolvedPresenceCount}
        onOpen={onOpenPresence}
      />

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="min-h-0 flex-1 overflow-y-auto px-1 py-2.5"
        style={{ overscrollBehavior: "contain" }}
      >
        {messages.length === 0 ? (
          <EmptyState label={currentUserLabel} />
        ) : (
          messages.map((m) => (
            <Message
              key={m.id}
              message={m}
              people={people}
              isMine={m.authorId != null && m.authorId === currentUserId}
              currentUserId={currentUserId}
              onToggleReaction={onToggleReaction}
              onJumpTo={onJumpTo}
            />
          ))
        )}
      </div>

      <TypingIndicator names={typingLabels} />

      <Composer
        people={people}
        currentUserId={currentUserId}
        videoTime={videoTime}
        pinNext={pinNext}
        setPinNext={setPinNext}
        onSend={onSend}
        onQuickReaction={onQuickReaction}
        onTyping={onTyping}
      />
    </aside>
  );
}

/* ---------- Header ---------- */
function ChatHeader({
  count,
  mobile,
  onClose,
}: {
  count: number;
  mobile: boolean;
  onClose?: () => void;
}) {
  return (
    <header
      className="flex items-center gap-2.5 px-4 py-3"
      style={{
        borderBottom:
          "1px solid color-mix(in oklch, var(--border) 50%, transparent)",
      }}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ color: "var(--primary)" }}
        aria-hidden
      >
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
      <span className="font-display text-[0.95rem] font-bold">Chat</span>
      <span className="text-muted-foreground text-xs font-medium">· {count}</span>
      <div className="flex-1" />
      {mobile && onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-ring grid size-8 place-items-center rounded-lg transition-colors focus-visible:ring-2"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      ) : null}
    </header>
  );
}

/* ---------- Presence row ---------- */
function PresenceRow({
  people,
  count,
  onOpen,
}: {
  people: ChatPerson[];
  count: number;
  onOpen?: () => void;
}) {
  const visible = people.slice(0, 5);
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!onOpen}
      className="focus-visible:ring-ring flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-muted/25 focus-visible:ring-2 disabled:cursor-default disabled:hover:bg-transparent"
      style={{
        borderBottom:
          "1px solid color-mix(in oklch, var(--border) 50%, transparent)",
      }}
    >
      <div className="flex">
        {visible.map((p, i) => (
          <AvatarChip
            key={p.id}
            person={p}
            size={24}
            overlap={i > 0}
            borderColor="var(--card)"
          />
        ))}
      </div>
      <span className="text-muted-foreground text-xs font-semibold">
        <span className="text-foreground">{count}</span> vibing now
      </span>
      <span className="text-muted-foreground ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold">
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: 9999,
            background: "#34d399",
            boxShadow: "0 0 6px rgba(52,211,153,.7)",
          }}
        />
        Synced
      </span>
    </button>
  );
}

/* ---------- Avatar ---------- */
function gradientFor(id: string): string {
  const pal = [
    "linear-gradient(135deg,#6ec8ff,#b58bff)",
    "linear-gradient(135deg,#ff9671,#ffc75f)",
    "linear-gradient(135deg,#5eb8c4,#4fc3a1)",
    "linear-gradient(135deg,#f78ca2,#f9748f)",
    "linear-gradient(135deg,#ffc75f,#f9f871)",
    "linear-gradient(135deg,#845ec2,#d65db1)",
  ];
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return pal[h % pal.length];
}

function AvatarChip({
  person,
  size = 32,
  overlap = false,
  borderColor = "var(--card)",
}: {
  person: ChatPerson;
  size?: number;
  overlap?: boolean;
  borderColor?: string;
}) {
  const common: CSSProperties = {
    width: size,
    height: size,
    borderRadius: 9999,
    display: "grid",
    placeItems: "center",
    color: "#fff",
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: Math.max(9, Math.round(size * 0.4)),
    marginLeft: overlap ? -Math.round(size / 3) : 0,
    border: `2px solid ${borderColor}`,
    background: person.gradient ?? gradientFor(person.id),
    boxShadow: "0 2px 6px rgba(0,0,0,.18)",
    overflow: "hidden",
    flexShrink: 0,
  };
  if (person.avatarDataUrl) {
    return (
      <span style={common} aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={person.avatarDataUrl}
          alt=""
          width={size}
          height={size}
          draggable={false}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </span>
    );
  }
  return (
    <span style={common} aria-label={person.name}>
      {person.letter}
    </span>
  );
}

/* ---------- Message ---------- */
function Message({
  message,
  people,
  isMine,
  currentUserId,
  onToggleReaction,
  onJumpTo,
}: {
  message: ChatMessage;
  people: ChatPerson[];
  isMine: boolean;
  currentUserId: string | null;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onJumpTo?: (sec: number) => void;
}) {
  const author =
    people.find((p) => p.id === message.authorId) ??
    ({
      id: message.authorId ?? message.authorLabel,
      name: message.authorLabel,
      letter: (message.authorLabel || "A").charAt(0).toUpperCase(),
      avatarDataUrl: message.avatarDataUrl ?? null,
    } as ChatPerson);

  const [hover, setHover] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const body = useMemo(() => renderBody(message.text, people), [
    message.text,
    people,
  ]);
  const reactionEntries = Object.entries(message.reactions ?? {});

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setPickerOpen(false);
      }}
      className="group relative flex gap-2.5 rounded-lg px-3 py-1.5 transition-colors"
      style={{
        background: hover
          ? "color-mix(in oklch, var(--foreground) 4%, transparent)"
          : "transparent",
      }}
    >
      <AvatarChip person={author} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-foreground text-[13px] font-bold">
            {author.name}
          </span>
          {author.isHost ? (
            <span
              className="border-primary/25 bg-primary/12 text-primary inline-flex items-center rounded-full border px-1.5 py-px text-[9px] font-bold uppercase leading-none tracking-wider"
            >
              Host
            </span>
          ) : null}
          {message.pinnedToSec != null ? (
            <button
              type="button"
              onClick={() => onJumpTo?.(message.pinnedToSec as number)}
              disabled={!onJumpTo}
              title="Jump to this moment"
              className="text-primary focus-visible:ring-ring inline-flex items-center gap-1 rounded-full border-0 px-1.5 py-0.5 text-[10px] font-bold leading-none focus-visible:ring-2 disabled:cursor-default"
              style={{
                background:
                  "color-mix(in oklch, var(--primary) 18%, transparent)",
              }}
            >
              <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <circle cx="12" cy="12" r="4" />
              </svg>
              {formatTime(message.pinnedToSec)}
            </button>
          ) : null}
          <span className="text-muted-foreground text-[10px]">
            {formatRelativeTime(message.createdAtIso)}
          </span>
          {message.pending ? (
            <span className="text-muted-foreground text-[9px] italic">
              sending…
            </span>
          ) : null}
        </div>
        {body ? (
          <div
            className="text-foreground mt-0.5 break-words text-[14px] leading-snug"
            style={{ wordBreak: "break-word" }}
          >
            {body}
          </div>
        ) : null}
        {message.gif ? <GifBubble variant={message.gif} /> : null}
        {reactionEntries.length > 0 ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {reactionEntries.map(([emoji, info]) => {
              const mine =
                currentUserId != null && info.userIds.includes(currentUserId);
              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onToggleReaction(message.id, emoji)}
                  className="focus-visible:ring-ring inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] font-semibold transition-colors focus-visible:ring-2"
                  style={{
                    borderColor: mine
                      ? "color-mix(in oklch, var(--primary) 55%, transparent)"
                      : "color-mix(in oklch, var(--primary) 35%, var(--border))",
                    background: mine
                      ? "color-mix(in oklch, var(--primary) 24%, transparent)"
                      : "color-mix(in oklch, var(--primary) 14%, transparent)",
                    color: "var(--foreground)",
                  }}
                  title={`${info.userIds.length} reacted`}
                >
                  <span style={{ fontSize: 13 }}>{emoji}</span>
                  <span className="text-muted-foreground">
                    {info.userIds.length}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {/* Hover toolbar */}
      {hover || pickerOpen ? (
        <div
          className="absolute right-3 top-[-10px] z-10 flex items-center rounded-lg p-0.5 shadow-lg"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "0 8px 20px -8px rgba(0,0,0,.3)",
          }}
        >
          <MiniBtn
            label="Add reaction"
            onClick={() => setPickerOpen((p) => !p)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="9" />
              <path d="M8 14s1.5 2 4 2 4-2 4-2" />
              <circle cx="9" cy="10" r="1" fill="currentColor" />
              <circle cx="15" cy="10" r="1" fill="currentColor" />
            </svg>
          </MiniBtn>
          {message.pinnedToSec == null && !isMine ? (
            <MiniBtn
              label="Reply"
              onClick={() => {
                /* reply is not wired into broadcast yet; keep button for parity */
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 14 4 9l5-5" />
                <path d="M4 9h12a4 4 0 0 1 4 4v4" />
              </svg>
            </MiniBtn>
          ) : null}
        </div>
      ) : null}
      {pickerOpen ? (
        <div
          className="absolute right-3 top-[26px] z-20 flex gap-0.5 rounded-lg p-1.5 shadow-lg"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "0 12px 30px -10px rgba(0,0,0,.4)",
          }}
        >
          {REACTIONS_POOL.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => {
                onToggleReaction(message.id, e);
                setPickerOpen(false);
              }}
              className="hover:bg-primary/12 rounded-md border-0 bg-transparent px-1.5 py-1 text-[18px]"
            >
              {e}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function MiniBtn({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-ring grid size-7 place-items-center rounded-md border-0 bg-transparent transition-colors focus-visible:ring-2"
    >
      {children}
    </button>
  );
}

/* ---------- GIF bubble ---------- */
function GifBubble({ variant }: { variant: string }) {
  const palettes: Record<string, [string, string, string]> = {
    concert: ["#6a2a5e", "#e8945c", "#5eb8c4"],
    dance: ["#1c1412", "#ff9671", "#ffc75f"],
    lofi: ["#2a1c2e", "#f6c98a", "#5eb8c4"],
    stage: ["#3a1a2a", "#ffcc7a", "#e8945c"],
  };
  const p = palettes[variant] ?? palettes.concert;
  const gid = `rcp-gif-${variant}`;
  return (
    <div
      className="mt-1.5 overflow-hidden rounded-xl border"
      style={{
        width: 180,
        height: 110,
        position: "relative",
        borderColor: "var(--border)",
      }}
    >
      <svg viewBox="0 0 180 110" width="100%" height="100%" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={p[0]} />
            <stop offset="100%" stopColor="#1c1412" />
          </linearGradient>
        </defs>
        <rect width="180" height="110" fill={`url(#${gid})`} />
        <path d="M 40 0 L 10 110 L 60 110 Z" fill={p[1]} opacity=".35">
          <animate attributeName="opacity" values=".2;.55;.2" dur="1.6s" repeatCount="indefinite" />
        </path>
        <path d="M 140 0 L 170 110 L 120 110 Z" fill={p[2]} opacity=".35">
          <animate attributeName="opacity" values=".55;.2;.55" dur="1.6s" repeatCount="indefinite" />
        </path>
        <path
          d="M 0 92 Q 20 82 40 92 Q 60 82 80 92 Q 100 82 120 92 Q 140 82 160 92 Q 170 86 180 92 L 180 110 L 0 110 Z"
          fill="#0b0608"
        />
        {[22, 50, 90, 120, 155].map((x, i) => (
          <rect key={i} x={x} y={74} width="2" height="12" fill="#0b0608">
            <animate attributeName="height" values="6;16;6" dur={`${0.4 + i * 0.08}s`} repeatCount="indefinite" />
            <animate attributeName="y" values="80;70;80" dur={`${0.4 + i * 0.08}s`} repeatCount="indefinite" />
          </rect>
        ))}
      </svg>
      <div
        className="absolute bottom-1 left-1 rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wider text-white"
        style={{ background: "rgba(0,0,0,.55)" }}
      >
        GIF
      </div>
    </div>
  );
}

/* ---------- Empty state ---------- */
function EmptyState({ label }: { label: string }) {
  return (
    <div className="text-muted-foreground flex h-full min-h-[200px] flex-col items-center justify-center gap-2 px-6 text-center text-sm">
      <span className="text-2xl" aria-hidden>
        💬
      </span>
      <p>Chat is quiet, {label.split(" ")[0] || "friend"}.</p>
      <p className="text-muted-foreground/80 text-xs">
        Drop the first message, toss a reaction, or pin a GIF to a moment.
      </p>
    </div>
  );
}

/* ---------- Typing indicator ---------- */
function TypingIndicator({ names }: { names: string[] }) {
  if (!names || names.length === 0) {
    return <div style={{ minHeight: 20 }} aria-hidden />;
  }
  const text =
    names.length === 1
      ? `${names[0]} is typing`
      : names.length === 2
        ? `${names[0]} and ${names[1]} are typing`
        : `${names.length} people are typing`;
  return (
    <div className="text-muted-foreground flex items-center gap-1.5 px-4 py-1 text-[11px] font-medium">
      <span className="vibin-typing-dots inline-flex items-center gap-[3px]" aria-hidden>
        <span />
        <span />
        <span />
      </span>
      <span className="italic">{text}</span>
      <style jsx>{`
        .vibin-typing-dots > span {
          width: 4px;
          height: 4px;
          border-radius: 9999px;
          background: var(--muted-foreground);
          animation: rcp-td 1.2s ease-in-out infinite;
        }
        .vibin-typing-dots > span:nth-child(2) {
          animation-delay: 0.15s;
        }
        .vibin-typing-dots > span:nth-child(3) {
          animation-delay: 0.3s;
        }
        @keyframes rcp-td {
          0%,
          60%,
          100% {
            opacity: 0.3;
            transform: translateY(0);
          }
          30% {
            opacity: 1;
            transform: translateY(-2px);
          }
        }
      `}</style>
    </div>
  );
}

/* ---------- Composer ---------- */
function Composer({
  people,
  currentUserId,
  videoTime,
  pinNext,
  setPinNext,
  onSend,
  onQuickReaction,
  onTyping,
}: {
  people: ChatPerson[];
  currentUserId: string | null;
  videoTime: number;
  pinNext: boolean;
  setPinNext: (v: boolean) => void;
  onSend: (payload: SendPayload) => void;
  onQuickReaction?: (emoji: string) => void;
  onTyping?: (isTyping: boolean) => void;
}) {
  const [text, setText] = useState("");
  const [gifOpen, setGifOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const typingStateRef = useRef(false);

  const mentionMatch = /@(\w*)$/.exec(text);
  const mentionOpen = mentionMatch != null;
  const mentionQuery = mentionMatch ? mentionMatch[1].toLowerCase() : "";

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
      }
      if (typingStateRef.current) {
        onTyping?.(false);
      }
    };
  }, [onTyping]);

  const emitTyping = useCallback(
    (isTyping: boolean) => {
      if (typingStateRef.current === isTyping) return;
      typingStateRef.current = isTyping;
      onTyping?.(isTyping);
    },
    [onTyping]
  );

  const handleChange = (value: string) => {
    setText(value);
    if (value.trim().length > 0) {
      emitTyping(true);
      if (typingTimerRef.current) {
        window.clearTimeout(typingTimerRef.current);
      }
      typingTimerRef.current = window.setTimeout(() => emitTyping(false), 2500);
    } else {
      emitTyping(false);
    }
  };

  const send = useCallback(
    (overrides?: Partial<SendPayload>) => {
      const t = text.trim();
      const mentions = extractMentionIds(text, people);
      const payload: SendPayload = {
        text: overrides?.text ?? t,
        mentions: overrides?.mentions ?? mentions,
        gif: overrides?.gif ?? null,
        pinnedToSec:
          overrides?.pinnedToSec ?? (pinNext ? Math.round(videoTime) : null),
      };
      if (!payload.text && !payload.gif && !payload.pinnedToSec) return;
      onSend(payload);
      setText("");
      setPinNext(false);
      setGifOpen(false);
      emitTyping(false);
    },
    [text, people, pinNext, videoTime, onSend, setPinNext, emitTyping]
  );

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const mentionables = useMemo(() => {
    return people
      .filter((p) => p.id !== currentUserId)
      .filter((p) =>
        mentionQuery.length === 0
          ? true
          : p.name.toLowerCase().startsWith(mentionQuery)
      )
      .slice(0, 5);
  }, [people, currentUserId, mentionQuery]);

  return (
    <div
      className="px-3 pb-3.5 pt-2.5"
      style={{
        borderTop:
          "1px solid color-mix(in oklch, var(--border) 50%, transparent)",
        background: "color-mix(in oklch, var(--card) 60%, transparent)",
      }}
    >
      {/* Timestamp pin + quick reactions */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPinNext(!pinNext)}
          className="focus-visible:ring-ring inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold transition-colors focus-visible:ring-2"
          style={{
            border: `1px solid ${pinNext ? "color-mix(in oklch, var(--primary) 55%, transparent)" : "var(--border)"}`,
            background: pinNext
              ? "color-mix(in oklch, var(--primary) 15%, transparent)"
              : "transparent",
            color: pinNext ? "var(--primary)" : "var(--muted-foreground)",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          React at {formatTime(videoTime)}
        </button>
        <div className="ml-auto flex gap-0.5">
          {QUICK_REACTIONS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => onQuickReaction?.(e)}
              title={`Fly ${e}`}
              className="hover:bg-muted/60 rounded-md border-0 bg-transparent px-1.5 py-0.5 text-[18px] transition-colors"
            >
              {e}
            </button>
          ))}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="relative flex items-end gap-1.5"
      >
        <div className="flex shrink-0 items-center gap-1 pb-1">
          <ChipBtn
            label="GIF"
            active={gifOpen}
            onClick={() => setGifOpen(!gifOpen)}
          >
            GIF
          </ChipBtn>
          <ChipBtn
            label="Mention"
            onClick={() => {
              setText((t) => `${t}@`);
              taRef.current?.focus();
            }}
          >
            @
          </ChipBtn>
        </div>
        <textarea
          ref={taRef}
          rows={1}
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => emitTyping(false)}
          onKeyDown={handleKeyDown}
          placeholder={
            pinNext
              ? `Reacting at ${formatTime(videoTime)}…`
              : "Send a message…"
          }
          maxLength={500}
          className="border-border bg-card/70 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring min-w-0 flex-1 resize-none rounded-xl border px-3 py-2.5 text-[14px] leading-snug outline-none transition-colors focus-visible:ring-2"
          style={{ minHeight: 44, maxHeight: 120 }}
        />
        <button
          type="submit"
          aria-label="Send message"
          className="bg-primary text-primary-foreground focus-visible:ring-ring grid size-11 place-items-center rounded-xl border-0 transition-[filter] hover:brightness-105 focus-visible:ring-2 disabled:opacity-45"
          disabled={
            text.trim().length === 0 && !pinNext
          }
          style={{
            boxShadow:
              "0 8px 18px -8px color-mix(in oklch, var(--primary) 70%, transparent)",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M22 2 11 13" />
            <path d="M22 2l-7 20-4-9-9-4z" />
          </svg>
        </button>

        {mentionOpen && mentionables.length > 0 ? (
          <div
            className="absolute bottom-14 left-0 right-14 z-10 rounded-xl p-1 shadow-xl"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              boxShadow: "0 12px 30px -10px rgba(0,0,0,.4)",
            }}
          >
            {mentionables.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setText((t) =>
                    t.replace(/@\w*$/, `@${p.name.split(" ")[0]} `)
                  );
                  taRef.current?.focus();
                }}
                className="hover:bg-primary/14 flex w-full items-center gap-2 rounded-lg border-0 bg-transparent px-2 py-1.5 text-left transition-colors"
              >
                <AvatarChip person={p} size={22} />
                <span className="text-foreground text-[13px] font-semibold">
                  {p.name}
                </span>
              </button>
            ))}
          </div>
        ) : null}

        {gifOpen ? (
          <div
            className="absolute bottom-14 right-0 z-10 rounded-xl p-2 shadow-xl"
            style={{
              width: 260,
              background: "var(--card)",
              border: "1px solid var(--border)",
              boxShadow: "0 20px 40px -12px rgba(0,0,0,.45)",
            }}
          >
            <input
              className="border-border bg-card/70 text-foreground placeholder:text-muted-foreground focus-visible:ring-ring mb-2 w-full rounded-lg border px-2.5 py-2 text-[13px] outline-none focus-visible:ring-2"
              placeholder="Search GIFs…"
              onFocus={(e) => e.currentTarget.select()}
            />
            <div className="grid grid-cols-2 gap-1.5">
              {GIF_VARIANTS.map((v, i) => (
                <button
                  key={`${v}-${i}`}
                  type="button"
                  onClick={() =>
                    send({ gif: v, text: "", pinnedToSec: null })
                  }
                  className="overflow-hidden rounded-lg border-0 bg-transparent p-0"
                >
                  <GifBubble variant={v} />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </form>
    </div>
  );
}

function ChipBtn({
  label,
  onClick,
  active = false,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="hover:bg-muted/60 focus-visible:ring-ring text-muted-foreground inline-flex h-7 min-w-[28px] items-center justify-center rounded-md border px-1.5 text-[10px] font-bold transition-colors focus-visible:ring-2"
      style={{
        borderColor: active
          ? "color-mix(in oklch, var(--primary) 55%, transparent)"
          : "var(--border)",
        background: active
          ? "color-mix(in oklch, var(--primary) 15%, transparent)"
          : "transparent",
        color: active ? "var(--primary)" : undefined,
      }}
    >
      {children}
    </button>
  );
}

/* ---------- helpers ---------- */

function renderBody(text: string, people: ChatPerson[]): ReactNode {
  if (!text) return null;
  const parts = text.split(/(@\w+)/g);
  return parts.map((chunk, i) => {
    if (chunk.startsWith("@")) {
      const name = chunk.slice(1).toLowerCase();
      const isKnown = people.some(
        (p) => p.name.split(" ")[0].toLowerCase() === name
      );
      return (
        <span
          key={i}
          style={{
            color: isKnown ? "var(--accent)" : "var(--muted-foreground)",
            fontWeight: 600,
            background: isKnown
              ? "color-mix(in oklch, var(--accent) 14%, transparent)"
              : "transparent",
            padding: "1px 4px",
            borderRadius: 4,
          }}
        >
          {chunk}
        </span>
      );
    }
    return <span key={i}>{chunk}</span>;
  });
}

function extractMentionIds(text: string, people: ChatPerson[]): string[] {
  const matches = text.match(/@(\w+)/g) ?? [];
  const ids: string[] = [];
  for (const m of matches) {
    const name = m.slice(1).toLowerCase();
    const p = people.find(
      (pp) => pp.name.split(" ")[0].toLowerCase() === name
    );
    if (p && !ids.includes(p.id)) ids.push(p.id);
  }
  return ids;
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function formatRelativeTime(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const now = Date.now();
  const diff = Math.max(0, now - t);
  if (diff < 10_000) return "now";
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}
