"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureAnonymousSession } from "@/lib/auth";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
    <div className="mx-auto flex w-full max-w-md flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Jam</h1>
        <p className="text-foreground/60 mt-2 text-sm leading-relaxed">
          Start a session, share the link, and let friends queue YouTube videos
          while you host playback—like a listening party.
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          disabled={busy}
          onClick={() => void startJam()}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-60 rounded-2xl px-5 py-4 text-base font-semibold text-black"
        >
          {busy ? "Starting…" : "Start a jam"}
        </button>
      </div>

      <div className="border-foreground/10 flex flex-col gap-3 border-t pt-6">
        <label htmlFor="join-id" className="text-sm font-medium">
          Join with room ID
        </label>
        <input
          id="join-id"
          value={joinId}
          onChange={(e) => setJoinId(e.target.value)}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          className="border-foreground/15 bg-background focus:ring-amber-500/40 rounded-xl border px-4 py-3 font-mono text-sm outline-none focus:ring-2"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={joinJam}
          className="border-foreground/20 hover:bg-foreground/5 rounded-2xl border px-5 py-3 text-sm font-medium"
        >
          Join jam
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-sm" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
