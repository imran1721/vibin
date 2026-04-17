"use client";

import { useLayoutEffect, useState } from "react";

const VV_H = "--vibin-vv-h";
const KB_INSET = "--vibin-keyboard-inset";
/** Below this we treat the inset as URL-bar / chrome noise, not the keyboard. */
const KEYBOARD_THRESHOLD_PX = 80;

/**
 * Tracks Visual Viewport (mobile keyboard / browser chrome) and sets CSS vars on
 * `:root` so fixed bottom UI can sit above the keyboard:
 * - `--vibin-vv-h`: visible viewport height (use for room shell height)
 * - `--vibin-keyboard-inset`: px to add to `bottom` for fixed bars
 *
 * Also returns a React `keyboardOpen` flag so panels can hide chrome (tab bars,
 * reserved padding) and let the chat input sit flush above the keyboard.
 */
export function useRoomVisualViewport() {
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useLayoutEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const apply = () => {
      const h = vv.height;
      const inset = Math.max(0, window.innerHeight - vv.offsetTop - vv.height);
      document.documentElement.style.setProperty(VV_H, `${h}px`);
      document.documentElement.style.setProperty(KB_INSET, `${inset}px`);
      setKeyboardOpen(inset > KEYBOARD_THRESHOLD_PX);
    };

    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    window.addEventListener("orientationchange", apply);

    /** Lock the document so iOS Safari cannot scroll the page up to chase a focused
     *  input — the room shell is `position: fixed` and already covers the visible area. */
    const html = document.documentElement;
    const body = document.body;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevHtmlOverscroll = html.style.overscrollBehavior;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "contain";

    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      window.removeEventListener("orientationchange", apply);
      document.documentElement.style.removeProperty(VV_H);
      document.documentElement.style.removeProperty(KB_INSET);
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      html.style.overscrollBehavior = prevHtmlOverscroll;
      setKeyboardOpen(false);
    };
  }, []);

  return { keyboardOpen };
}
