"use client";

import { useEffect } from "react";

/**
 * Registers a minimal `/sw.js` in production so Chromium can treat the site as installable
 * (manifest + icons + active service worker with fetch handler).
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker.register("/sw.js").catch(() => {
      /* ignore — e.g. unsupported scope or blocked */
    });
  }, []);

  return null;
}
