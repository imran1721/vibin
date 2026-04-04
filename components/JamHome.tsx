"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureAnonymousSession } from "@/lib/auth";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const inputClass =
  "border-border bg-surface-elevated text-foreground placeholder:text-muted-foreground focus-visible:ring-ring min-h-11 w-full rounded-2xl border px-4 py-3 text-base outline-none transition-[box-shadow,background-color] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const secondaryBtnClass =
  "border-border text-foreground hover:bg-muted active:bg-muted/80 focus-visible:ring-ring inline-flex min-h-11 w-full items-center justify-center rounded-2xl border px-5 py-3 text-sm font-semibold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function JamHome() {
  const router = useRouter();
  const [joinId, setJoinId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function startJam() {
    setError(null);
    setBusy(true);
    try {
      const supabase = getSupabaseBrowserClient();
      await ensureAnonymousSession(supabase);
      const { data, error: rpcError } = await supabase.rpc("create_room", {
        p_title: null,
      });
      if (rpcError) throw rpcError;
      const row = data as { id?: string; host_token?: string } | null;
      if (!row?.id || !row?.host_token) {
        throw new Error("Unexpected response from server");
      }
      router.push(`/r/${row.id}?h=${encodeURIComponent(row.host_token)}`);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Could not create jam. Check Supabase and Anonymous auth."
      );
    } finally {
      setBusy(false);
    }
  }

  function joinJam() {
    setError(null);
    const id = joinId.trim();
    if (!UUID_RE.test(id)) {
      setError("Paste a valid jam ID (UUID from the link).");
      return;
    }
    router.push(`/r/${id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-10 sm:max-w-lg">
      <header className="space-y-3">
        <p className="text-accent font-display text-sm font-semibold tracking-wide">
          YouTube listening party
        </p>
        <h1 className="font-display text-foreground text-4xl font-extrabold tracking-tight sm:text-5xl">
          Jam
        </h1>
        <p className="text-muted-foreground max-w-prose text-base leading-relaxed sm:text-[1.05rem]">
          Start a session, share the link, and let friends queue videos while you
          host playback—one speaker, everyone adds tracks.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void startJam()}
          className="bg-primary text-primary-foreground focus-visible:ring-ring hover:brightness-105 active:brightness-95 inline-flex min-h-12 w-full items-center justify-center rounded-2xl px-6 py-3.5 text-base font-bold shadow-lg shadow-black/20 transition-[filter,transform] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:shadow-black/50 enabled:active:scale-[0.99] motion-reduce:enabled:active:scale-100 disabled:cursor-not-allowed disabled:opacity-55"
        >
          {busy ? "Starting…" : "Start a jam"}
        </button>
      </div>

      <div className="border-border flex flex-col gap-4 border-t pt-8">
        <div>
          <label
            htmlFor="join-id"
            className="text-foreground mb-2 block text-sm font-semibold"
          >
            Join with room ID
          </label>
          <input
            id="join-id"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            className={`${inputClass} font-mono text-sm`}
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <button type="button" onClick={joinJam} className={secondaryBtnClass}>
          Join jam
        </button>
      </div>

      {error && (
        <div
          className="border-destructive/35 bg-destructive/10 rounded-2xl border px-4 py-3"
          role="alert"
        >
          <p className="text-destructive text-sm font-medium">{error}</p>
        </div>
      )}
    </div>
  );
}
