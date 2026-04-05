"use client";

import { useEffect } from "react";
import { getOrCreateAnalyticsClientId } from "@/lib/analytics-client-id";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export function AnalyticsSession() {
  useEffect(() => {
    const clientSessionId = getOrCreateAnalyticsClientId();
    if (!clientSessionId) return;

    let ended = false;
    const sendEnd = () => {
      if (ended) return;
      ended = true;
      const payload = JSON.stringify({
        phase: "end",
        clientSessionId,
      });
      const blob = new Blob([payload], { type: "application/json" });
      if (navigator.sendBeacon?.("/api/analytics/session", blob)) return;
      void fetch("/api/analytics/session", {
        method: "POST",
        body: payload,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      });
    };

    const runStart = async () => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      const w = window.screen?.width;
      const h = window.screen?.height;
      let accessToken: string | null = null;
      try {
        const supabase = getSupabaseBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        accessToken = session?.access_token ?? null;
      } catch {
        /* no client */
      }
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
      await fetch("/api/analytics/session", {
        method: "POST",
        headers,
        body: JSON.stringify({
          phase: "start",
          clientSessionId,
          timezone: tz,
          screenWidth: Number.isFinite(w) ? w : undefined,
          screenHeight: Number.isFinite(h) ? h : undefined,
        }),
      });
    };

    void runStart();

    window.addEventListener("pagehide", sendEnd);
    window.addEventListener("beforeunload", sendEnd);

    return () => {
      window.removeEventListener("pagehide", sendEnd);
      window.removeEventListener("beforeunload", sendEnd);
    };
  }, []);

  return null;
}
