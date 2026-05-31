"use client";

import { CATEGORIES, CAT_ABBR, TOOLS } from "@/components/registry";
import { Mascot, Speech, SupportLinks } from "@/components/ui";

const BOOT: [string, string, boolean?][] = [
  ["ok", "mount local filesystem … done"],
  ["ok", `load ${TOOLS.length} pdf tools … done`],
  ["ok", "no uploads · files stay in your browser"],
  ["ac", "ready — drop a PDF to begin", true],
];

export default function Welcome({ go }: { go: (id: string) => void }) {
  return (
    <div className="content-inner">
      <div className="boot-grid">
        <div>
          <div className="boot-lines" style={{ marginBottom: "var(--s6)" }}>
            {BOOT.map(([k, msg, cur], i) => (
              <div className="ln" key={i} style={{ whiteSpace: "nowrap" }}>
                <span className={k === "ok" ? "ok" : "ac"} style={{ flex: "none", width: 54 }}>
                  {k === "ok" ? "[ ok ]" : "[ >> ]"}
                </span>
                <span style={{ color: "var(--text-0)" }}>
                  {msg}
                  {cur && <span className="cursor" style={{ marginLeft: 4 }} />}
                </span>
              </div>
            ))}
          </div>
          <div className="hello">
            <h1>
              Hai Don <span className="wave">👋</span>
              <br />
              welcome to <span className="accent">DonPDF</span>
            </h1>
            <p>
              Your local PDF workshop. Merge, split, organize, rotate and
              convert PDFs in one tab — {TOOLS.length} tools, all running
              entirely in your browser. Your files never get uploaded — no
              server, no tracking, no accounts.
            </p>
            <div className="quick">
              <button className="btn primary" onClick={() => go("merge")}>
                <span style={{ fontWeight: 700 }}>⧉</span> Merge PDF
              </button>
              <button className="btn" onClick={() => go("split")}>
                <span style={{ fontWeight: 700 }}>✂</span> Split PDF
              </button>
              <button className="btn" onClick={() => go("pdf-to-jpg")}>
                <span style={{ fontWeight: 700 }}>⊞</span> PDF → Image
              </button>
            </div>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <Mascot className="hero-mascot" />
          <div style={{ maxWidth: 230, margin: "0 auto", marginTop: "calc(-1 * var(--s5))" }}>
            <Speech who="don@don-pdf ~ %">
              Pick a tool on the left, or hit{" "}
              <kbd style={{ border: "1px solid var(--border)", borderRadius: 3, padding: "0 5px" }}>
                ⌘K
              </kbd>{" "}
              to search. Nothing leaves this tab.
            </Speech>
          </div>
        </div>
      </div>

      <div className="catalog-head">
        <h2>all tools</h2>
        <span className="count">{TOOLS.length} tools · {CATEGORIES.length} categories</span>
      </div>
      {CATEGORIES.map((cat) => (
        <div className="cat-block" key={cat}>
          <div className="cat">
            {cat}{" "}
            <span style={{ color: "var(--text-2)", letterSpacing: ".04em" }}>
              ~/{CAT_ABBR[cat]}
            </span>
          </div>
          <div className="card-grid">
            {TOOLS.filter((t) => t.category === cat).map((t) => (
              <button className="tcard" key={t.id} onClick={() => go(t.id)}>
                <div className="tcard-top">
                  <span className="tcard-ic" style={{ fontWeight: 700 }}>
                    {t.glyph}
                  </span>
                  <span className="tcard-no">{t.live ? "● live" : ""}</span>
                </div>
                <h3>{t.name}</h3>
                <p>{t.description}</p>
                <span className="go">open ❯</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="home-support">
        <SupportLinks />
      </div>
    </div>
  );
}
