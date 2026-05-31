"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";
export type Accent = "green" | "amber";

export interface Tweaks {
  theme: Theme;
  accent: Accent;
  scanlines: number;
  glow: boolean;
  blink: boolean;
}

const DEFAULTS: Tweaks = {
  theme: "light",
  accent: "amber",
  scanlines: 20,
  glow: true,
  blink: true,
};

const KEY: Record<keyof Tweaks, string> = {
  theme: "dpdf:theme",
  accent: "dpdf:accent",
  scanlines: "dpdf:scanlines",
  glow: "dpdf:glow",
  blink: "dpdf:blink",
};

function read(): Tweaks {
  if (typeof window === "undefined") return DEFAULTS;
  const s = window.localStorage;
  return {
    theme: (s.getItem(KEY.theme) as Theme) || DEFAULTS.theme,
    accent: (s.getItem(KEY.accent) as Accent) || DEFAULTS.accent,
    scanlines: s.getItem(KEY.scanlines) != null ? Number(s.getItem(KEY.scanlines)) : DEFAULTS.scanlines,
    glow: (s.getItem(KEY.glow) ?? "on") !== "off",
    blink: (s.getItem(KEY.blink) ?? "on") !== "off",
  };
}

function apply(t: Tweaks): void {
  const r = document.documentElement;
  r.setAttribute("data-theme", t.theme);
  r.setAttribute("data-accent", t.accent);
  r.setAttribute("data-glow", t.glow ? "on" : "off");
  r.setAttribute("data-blink", t.blink ? "on" : "off");
  r.style.setProperty("--scanline-opacity", (t.scanlines / 100).toFixed(3));
}

/** Reads tweaks from localStorage, applies them to <html>, and persists changes. */
export function useTweaks() {
  const [tweaks, setTweaks] = useState<Tweaks>(DEFAULTS);

  // Hydrate from localStorage after mount (the inline bootstrap already set the
  // <html> attributes pre-paint, so there is no visual flash here).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client hydration from localStorage
    setTweaks(read());
  }, []);

  const set = useCallback(<K extends keyof Tweaks>(key: K, value: Tweaks[K]) => {
    setTweaks((prev) => {
      const next = { ...prev, [key]: value };
      apply(next);
      try {
        const v =
          typeof value === "boolean"
            ? value
              ? "on"
              : "off"
            : String(value);
        window.localStorage.setItem(KEY[key], v);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return { tweaks, set };
}
