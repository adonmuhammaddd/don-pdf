"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CATEGORIES, TOOLS, type Tool } from "@/components/registry";
import Welcome from "@/components/Welcome";
import { Icon, ToastHost, cx } from "@/components/ui";
import { useTheme } from "@/lib/theme";

const WIDE = new Set(["organize", "fill-sign", "pdf-to-jpg"]);

function useRoute(): [string, (id: string) => void] {
  const [route, setRoute] = useState("home");
  useEffect(() => {
    const get = () => window.location.hash.replace(/^#/, "") || "home";
    const on = () => setRoute(get());
    on();
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  const go = (id: string) => {
    window.location.hash = id;
  };
  return [route, go];
}

export default function AppShell() {
  const [theme, toggleTheme] = useTheme();
  const [route, go] = useRoute();
  const [navOpen, setNavOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const nav = useCallback(
    (id: string) => {
      go(id);
      setNavOpen(false);
      if (mainRef.current) mainRef.current.scrollTop = 0;
    },
    [go],
  );

  // ⌘K / Ctrl+K → focus the sidebar search (open the drawer on mobile first).
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setNavOpen(true);
        setTimeout(() => document.querySelector<HTMLInputElement>(".search input")?.focus(), 30);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  // Anonymous, cookieless usage ping when a tool is opened (analytics.dondev.id).
  useEffect(() => {
    if (route && route !== "home") {
      window.analytics?.track("tool_opened", { tool: route });
    }
  }, [route]);

  const tool = TOOLS.find((t) => t.id === route);
  const isHome = route === "home";

  return (
    <div className="app">
      <Sidebar
        route={route}
        nav={nav}
        theme={theme}
        toggleTheme={toggleTheme}
        open={navOpen}
      />
      <div className={cx("scrim", navOpen && "show")} onClick={() => setNavOpen(false)} />

      <main className="main" ref={mainRef}>
        <div className="mobile-bar">
          <button className="icon-btn" onClick={() => setNavOpen(true)} aria-label="Menu">
            <Icon name="menu" size={20} />
          </button>
          <div className="sb-wordmark">
            Don<b>PDF</b>
          </div>
        </div>

        <div className="main-scroll">
          {isHome && <Welcome go={nav} />}
          {!isHome && tool && (
            <>
              <ToolHeader tool={tool} />
              <div className={cx("tool-body", WIDE.has(tool.id) && "wide")}>
                <tool.Component />
              </div>
            </>
          )}
          {!isHome && !tool && <NotFound go={nav} />}
        </div>
      </main>

      <ToastHost />
    </div>
  );
}

/* ---------------- Brand mark ---------------- */
function BrandLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 3.2h8l4.8 4.8V20a.8.8 0 0 1-.8.8H6a.8.8 0 0 1-.8-.8V4a.8.8 0 0 1 .8-.8Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M13.6 3.4V8.4h4.8" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path
        d="M8.4 13.2h2.1a1.6 1.6 0 0 1 0 3.2H8.4v-3.2Zm0 0V18"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------------- Sidebar ---------------- */
function Sidebar({
  route,
  nav,
  theme,
  toggleTheme,
  open,
}: {
  route: string;
  nav: (id: string) => void;
  theme: "light" | "dark";
  toggleTheme: () => void;
  open: boolean;
}) {
  const [q, setQ] = useState("");
  const ql = q.trim().toLowerCase();

  const groups = useMemo(
    () =>
      CATEGORIES.map((cat) => ({
        cat,
        tools: TOOLS.filter(
          (t) =>
            t.category === cat &&
            (!ql ||
              t.name.toLowerCase().includes(ql) ||
              t.description.toLowerCase().includes(ql)),
        ),
      })).filter((g) => g.tools.length),
    [ql],
  );

  return (
    <nav className={cx("sidebar", open && "open")}>
      <div className="sb-brand">
        <div className="sb-logo">
          <BrandLogo />
        </div>
        <div className="stack">
          <div className="sb-wordmark">
            Don<b>PDF</b>
          </div>
          <div className="sb-tag">PDF tools, on your device</div>
        </div>
      </div>

      <div className="search">
        <Icon name="search" size={16} className="ic" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tools…"
          spellCheck={false}
          onKeyDown={(e) => {
            if (e.key === "Enter" && groups[0]?.tools[0]) nav(groups[0].tools[0].id);
            if (e.key === "Escape") setQ("");
          }}
        />
        {!q && <kbd>⌘K</kbd>}
      </div>

      <div className="sb-scroll">
        <button
          className={cx("nav-item", route === "home" && "active")}
          onClick={() => nav("home")}
          style={{ marginBottom: 12 }}
        >
          <Icon name="home" size={19} className="ic" />
          Home
        </button>
        {groups.length === 0 && <div className="nav-empty">No tools match “{q}”.</div>}
        {groups.map((g) => (
          <div className="nav-group" key={g.cat}>
            <div className="nav-cat">{g.cat}</div>
            {g.tools.map((t) => (
              <button
                key={t.id}
                className={cx("nav-item", route === t.id && "active")}
                onClick={() => nav(t.id)}
              >
                <Icon name={t.icon} size={19} className="ic" />
                <span style={{ flex: 1 }}>{t.name}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="sb-foot">
        <div className="privacy">
          <Icon name="shield" size={20} className="ic" strokeWidth={1.8} />
          <div className="privacy-txt">
            <b>Private by design</b>
            <span>Files are processed locally</span>
          </div>
        </div>
        <div className="theme-row">
          <span>
            <Icon name={theme === "dark" ? "moon" : "sun"} size={16} />
            {theme === "dark" ? "Dark" : "Light"} mode
          </span>
          <button
            className="toggle"
            onClick={toggleTheme}
            role="switch"
            aria-checked={theme === "dark"}
            aria-label="Toggle theme"
          >
            <span className="knob">
              <Icon name={theme === "dark" ? "moon" : "sun"} size={12} strokeWidth={2} />
            </span>
          </button>
        </div>
      </div>
    </nav>
  );
}

/* ---------------- Tool header ---------------- */
function ToolHeader({ tool }: { tool: Tool }) {
  return (
    <div className="tool-header">
      <div className="th-icon">
        <Icon name={tool.icon} size={24} strokeWidth={1.7} />
      </div>
      <div className="th-text">
        <h1>{tool.name}</h1>
        <p>{tool.tagline}</p>
      </div>
      <span className="live-pill">
        <span className="live-dot" />
        On-device
      </span>
    </div>
  );
}

/* ---------------- 404 ---------------- */
function NotFound({ go }: { go: (id: string) => void }): ReactNode {
  return (
    <div className="notfound">
      <div className="mascot-frame oops">
        {/* eslint-disable-next-line @next/next/no-img-element -- small static mascot */}
        <img src="/mascot.png" alt="" />
      </div>
      <div className="code">404</div>
      <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, letterSpacing: "-0.02em" }}>
        This tool wandered off
      </h2>
      <p className="muted" style={{ maxWidth: "36ch" }}>
        We couldn&apos;t find that page. Let&apos;s get you back to the tools.
      </p>
      <button className="btn btn-primary btn-lg" onClick={() => go("home")}>
        <Icon name="home" size={18} />
        Back to home
      </button>
    </div>
  );
}
