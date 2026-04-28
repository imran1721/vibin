"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type ThemeChoice = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  choice: ThemeChoice;
  resolved: ResolvedTheme;
  setChoice: (next: ThemeChoice) => void;
  toggle: () => void;
};

const STORAGE_KEY = "vibin:theme";

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readStoredChoice(): ThemeChoice {
  if (typeof window === "undefined") return "system";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === "light" || raw === "dark" || raw === "system") return raw;
  } catch {}
  return "system";
}

function resolve(choice: ThemeChoice): ResolvedTheme {
  if (choice === "light" || choice === "dark") return choice;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

const THEME_COLOR_LIGHT = "#faf8f5";
const THEME_COLOR_DARK = "#1c1412";

function applyMetaThemeColor(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  const value = resolved === "dark" ? THEME_COLOR_DARK : THEME_COLOR_LIGHT;
  // Drop any prefers-color-scheme variants Next.js may have emitted; we drive
  // the OS status-bar color from the resolved app theme instead.
  document
    .querySelectorAll('meta[name="theme-color"][media]')
    .forEach((el) => el.parentElement?.removeChild(el));
  let tag = document.querySelector(
    'meta[name="theme-color"]:not([media])'
  ) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.name = "theme-color";
    document.head.appendChild(tag);
  }
  tag.content = value;
}

function applyToDocument(choice: ThemeChoice) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (choice === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", choice);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");

  useEffect(() => {
    const c = readStoredChoice();
    const r = resolve(c);
    setChoiceState(c);
    setResolved(r);
    applyToDocument(c);
    applyMetaThemeColor(r);
  }, []);

  useEffect(() => {
    if (choice !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r: ResolvedTheme = mq.matches ? "dark" : "light";
      setResolved(r);
      applyMetaThemeColor(r);
    };
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, [choice]);

  const setChoice = (next: ThemeChoice) => {
    const r = resolve(next);
    setChoiceState(next);
    setResolved(r);
    applyToDocument(next);
    applyMetaThemeColor(r);
    try {
      if (next === "system") window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, next);
    } catch {}
  };

  const toggle = () => setChoice(resolved === "dark" ? "light" : "dark");

  return (
    <ThemeContext.Provider value={{ choice, resolved, setChoice, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    return {
      choice: "system",
      resolved: "dark",
      setChoice: () => {},
      toggle: () => {},
    };
  }
  return ctx;
}

/** Inline script for `<head>` that applies the saved theme before paint. */
export const THEME_INIT_SCRIPT = `
(function(){try{var k='${STORAGE_KEY}';var v=localStorage.getItem(k);if(v==='light'||v==='dark'){document.documentElement.setAttribute('data-theme',v);}}catch(e){}})();
`.trim();
