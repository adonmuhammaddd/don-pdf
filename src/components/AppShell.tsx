"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CATEGORIES, CAT_ABBR, TOOLS } from "@/components/registry";
import Welcome from "@/components/Welcome";
import {
  Badge,
  Icon,
  Mascot,
  MASCOT_AVATAR,
  ToastHost,
} from "@/components/ui";
import { EthicalAd } from "@/components/EthicalAd";
import { useTweaks } from "@/lib/useTweaks";

function useRoute(): [string, (id: string) => void] {
  const get = () =>
    (typeof window === "undefined" ? "home" : window.location.hash.replace(/^#/, "")) ||
    "home";
  const [route, setRoute] = useState("home");
  useEffect(() => {
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
  const { tweaks, set } = useTweaks();
  const [route, go] = useRoute();
  const [query, setQuery] = useState("");
  const [drawer, setDrawer] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K → open drawer + focus search.
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setDrawer(true);
        setTimeout(() => searchRef.current?.focus(), 30);
      }
    };
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const nav = useCallback(
    (id: string) => {
      go(id);
      setDrawer(false);
    },
    [go],
  );

  const tool = TOOLS.find((t) => t.id === route);
  const isHome = route === "home";
  const path = isHome
    ? "~/don-pdf — zsh"
    : tool
      ? `~/don-pdf/${tool.id} — zsh`
      : "~/don-pdf/404 — zsh";

  return (
    <div className={`app ${drawer ? "drawer-open" : ""}`}>
      <div className="backdrop" onClick={() => setDrawer(false)} />

      <Sidebar
        route={route}
        nav={nav}
        query={query}
        setQuery={setQuery}
        searchRef={searchRef}
      />

      <main className="main">
        <div className="topbar">
          <button className="menu-btn" onClick={() => setDrawer(true)} aria-label="menu">
            <Icon name="menu" />
          </button>
          <div className="lights">
            <i className="r" />
            <i className="y" />
            <i className="g" />
          </div>
          <span className="tabpath">
            {path.split("—")[0]}
            <b>—{path.split("—")[1]}</b>
          </span>
          <span className="spacer" />
          <NavTweaks
            theme={tweaks.theme}
            setTheme={(v) => set("theme", v)}
            accent={tweaks.accent}
            setAccent={(v) => set("accent", v)}
          />
          <div className="keyhint">
            <span>
              <b>⌘K</b> search
            </span>
            <span>
              <b>❯</b>{" "}
              {isHome ? "home" : tool ? tool.category.split(" ")[0].toLowerCase() : "unknown"}
            </span>
          </div>
        </div>

        <div className="content">
          {isHome && <Welcome go={nav} />}
          {!isHome && tool && <ToolView tool={tool} />}
          {!isHome && !tool && <NotFound route={route} go={nav} />}
        </div>
      </main>

      <ToastHost />
    </div>
  );
}

/* ---------------- Navbar tweaks (theme + accent) ---------------- */
function NavTweaks({
  theme,
  setTheme,
  accent,
  setAccent,
}: {
  theme: "dark" | "light";
  setTheme: (v: "dark" | "light") => void;
  accent: "green" | "amber";
  setAccent: (v: "green" | "amber") => void;
}) {
  return (
    <div className="nav-tweaks">
      <div className="nav-toggle" role="group" aria-label="Theme">
        <button
          className={theme === "light" ? "on" : ""}
          onClick={() => setTheme("light")}
          aria-label="Light theme"
          title="Light"
        >
          <Icon name="sun" size={13} />
        </button>
        <button
          className={theme === "dark" ? "on" : ""}
          onClick={() => setTheme("dark")}
          aria-label="Dark theme"
          title="Dark"
        >
          <Icon name="moon" size={13} />
        </button>
      </div>
      <div className="nav-toggle nav-toggle-acc" role="group" aria-label="Accent">
        <button
          className={accent === "green" ? "on" : ""}
          onClick={() => setAccent("green")}
          aria-label="Green accent"
          title="Green"
        >
          <span className="acc-dot acc-green" />
        </button>
        <button
          className={accent === "amber" ? "on" : ""}
          onClick={() => setAccent("amber")}
          aria-label="Amber accent"
          title="Amber"
        >
          <span className="acc-dot acc-amber" />
        </button>
      </div>
    </div>
  );
}

/* ---------------- Sidebar ---------------- */
function Sidebar({
  route,
  nav,
  query,
  setQuery,
  searchRef,
}: {
  route: string;
  nav: (id: string) => void;
  query: string;
  setQuery: (v: string) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
}) {
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      TOOLS.filter(
        (t) =>
          !q ||
          t.name.toLowerCase().includes(q) ||
          t.id.includes(q) ||
          t.category.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q),
      ),
    [q],
  );

  const hl = (name: string): ReactNode => {
    if (!q) return name;
    const i = name.toLowerCase().indexOf(q);
    if (i < 0) return name;
    return (
      <>
        {name.slice(0, i)}
        <mark>{name.slice(i, i + q.length)}</mark>
        {name.slice(i + q.length)}
      </>
    );
  };

  return (
    <aside className="sidebar">
      <button className="brand" onClick={() => nav("home")} style={{ cursor: "pointer", textAlign: "left" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- small static avatar */}
        <img className="brand-avatar" src={MASCOT_AVATAR} alt="Don" />
        <div>
          <div className="brand-name">
            Don<b>PDF</b><span className="cursor" />
          </div>
          <div className="brand-sub">{TOOLS.length} tools · no uploads</div>
        </div>
      </button>

      <div className="search-wrap">
        <div className="search">
          <span className="prompt">❯</span>
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="search tools…"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filtered[0]) nav(filtered[0].id);
              if (e.key === "Escape") setQuery("");
            }}
          />
          <kbd>⌘K</kbd>
        </div>
      </div>

      <nav className="nav">
        <button
          className={`nav-item ${route === "home" ? "active" : ""}`}
          onClick={() => nav("home")}
        >
          <Icon className="ic" name="home" /> Home
        </button>
        {CATEGORIES.map((cat) => {
          const items = filtered.filter((t) => t.category === cat);
          if (!items.length) return null;
          return (
            <div key={cat}>
              <div className="cat">{cat}</div>
              {items.map((t) => (
                <button
                  key={t.id}
                  className={`nav-item ${route === t.id ? "active" : ""}`}
                  onClick={() => nav(t.id)}
                >
                  <span className="ic" style={{ fontSize: 12, fontWeight: 700 }}>
                    {t.glyph}
                  </span>
                  {hl(t.name)}
                  {t.live && (
                    <span
                      style={{
                        marginLeft: "auto",
                        width: 6,
                        height: 6,
                        borderRadius: 9,
                        background: "var(--accent)",
                        boxShadow: "0 0 6px var(--accent-glow)",
                      }}
                    />
                  )}
                </button>
              ))}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="nav-empty">
            <span className="tok-punc">{">"}</span> no tool matches “{query}”.
            <br />
            Try “merge”, “split”, “rotate”…
          </div>
        )}
      </nav>

      <div className="side-foot">
        <EthicalAd />
        <div className="statusline">
          <span className="seg accent">NORMAL</span>
          <span className="seg">
            <span className="dot" />
            private
          </span>
          <span className="seg grow" style={{ justifyContent: "flex-end" }}>
            v1.0.0
          </span>
        </div>
      </div>
    </aside>
  );
}

/* ---------------- Tool view ---------------- */
function ToolView({ tool }: { tool: (typeof TOOLS)[number] }) {
  const Comp = tool.Component;
  return (
    <div className="content-inner">
      <div className="tool-head">
        <div className="crumb">
          ~/don-pdf/<b>{tool.id}</b> · ~/{CAT_ABBR[tool.category]}
        </div>
        <div className="flex items-center gap4" style={{ flexWrap: "wrap" }}>
          <h1>{tool.name}</h1>
          <Badge kind="ok">live</Badge>
        </div>
        <p>{tool.description}</p>
      </div>
      <Comp />
    </div>
  );
}

/* ---------------- 404 ---------------- */
function NotFound({ route, go }: { route: string; go: (id: string) => void }) {
  return (
    <div className="content-inner">
      <div className="cnf">
        <Mascot className="em-mascot" />
        <div>
          <div className="muted" style={{ fontSize: "var(--fs-sm)" }}>
            don@don-pdf ~ %
          </div>
          <h1 style={{ marginTop: 8 }}>command not found</h1>
        </div>
        <p className="muted" style={{ maxWidth: "46ch" }}>
          <code>{route}</code>: no such tool here. Don checked twice.
        </p>
        <button className="btn primary" onClick={() => go("home")}>
          <Icon name="home" size={13} />
          cd ~/home
        </button>
      </div>
    </div>
  );
}
