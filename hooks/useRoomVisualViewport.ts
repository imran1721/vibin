"use client";

import { useLayoutEffect } from "react";

const VV_H = "--vibin-vv-h";
const KB_INSET = "--vibin-keyboard-inset";

function apply() {
  if (typeof window === "undefined") return;
  const vv = window.visualViewport;
  if (!vv) return;

  const h = vv.height;
  const inset = Math.max(0, window.innerHeight - vv.offsetTop - vv.height);

  document.documentElement.style.setProperty(VV_H, `${h}px`);
  document.documentElement.style.setProperty(KB_INSET, `${inset}px`);
}

function clear() {
  document.documentElement.style.removeProperty(VV_H);
  document.documentElement.style.removeProperty(KB_INSET);
}

/**
 * Tracks Visual Viewport (mobile keyboard / browser chrome) and sets CSS vars on
 * `:root` so fixed bottom UI can sit above the keyboard:
 * - `--vibin-vv-h`: visible viewport height (use for room shell height)
 * - `--vibin-keyboard-inset`: px to add to `bottom` for fixed bars
 */
export function useRoomVisualViewport() {
  useLayoutEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    window.addEventListener("orientationchange", apply);

    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      window.removeEventListener("orientationchange", apply);
      clear();
    };
  }, []);
}
