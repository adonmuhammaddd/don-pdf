"use client";

import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";
const KEY = "dpdf:theme";

/**
 * Reads the theme from localStorage (the inline bootstrap in layout.tsx already
 * applied it to <html> pre-paint, so there's no flash here), and toggles +
 * persists it. Only light/dark — the clean SaaS design has a single brand accent.
 */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time client hydration
    setTheme((localStorage.getItem(KEY) as Theme) || "light");
  }, []);

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return [theme, toggle];
}
