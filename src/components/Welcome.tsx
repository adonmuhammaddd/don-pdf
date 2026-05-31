"use client";

import { CATEGORIES, TOOLS } from "@/components/registry";
import { Icon } from "@/components/ui";

export default function Welcome({ go }: { go: (id: string) => void }) {
  return (
    <div className="home">
      <section className="hero">
        <div>
          <div className="hero-greet">
            <span aria-hidden="true">👋</span> Hai Don — welcome back
          </div>
          <h1>
            Every PDF tool you need, <span className="accent">right here.</span>
          </h1>
          <p className="hero-lead">
            Merge, split, sign, compress, convert — fast and free. Files are
            processed on your device, so nothing ever leaves your computer.
          </p>
          <div className="hero-cta">
            <button className="btn btn-primary btn-lg" onClick={() => go("merge")}>
              <Icon name="merge" size={18} /> Merge PDFs
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => go("fill-sign")}>
              <Icon name="sign" size={18} /> Fill &amp; Sign
            </button>
          </div>
          <div className="trust-row">
            <span className="chip">
              <Icon name="shield" size={15} /> 100% private
            </span>
            <span className="chip">
              <Icon name="bolt" size={15} /> No upload wait
            </span>
            <span className="chip">
              <Icon name="check" size={15} /> Always free
            </span>
          </div>
        </div>
        <div className="hero-mascot">
          <div className="mascot-disc">
            {/* eslint-disable-next-line @next/next/no-img-element -- hero mascot */}
            <img src="/mascot.png" alt="DonPDF mascot" />
          </div>
          <div className="mascot-bubble">
            <Icon name="lock" size={15} strokeWidth={2} /> Your files stay with you
          </div>
        </div>
      </section>

      <div className="sec-head">
        <h2>All tools</h2>
        <span className="count">{TOOLS.length} tools · {CATEGORIES.length} categories</span>
      </div>

      {CATEGORIES.map((cat) => {
        const tools = TOOLS.filter((t) => t.category === cat);
        if (!tools.length) return null;
        return (
          <div className="cat-block" key={cat}>
            <div className="cat-label">
              <span className="dot" />
              {cat}
            </div>
            <div className="tool-grid">
              {tools.map((t) => (
                <button className="tool-tile" key={t.id} onClick={() => go(t.id)}>
                  <span className="tt-icon">
                    <Icon name={t.icon} size={22} strokeWidth={1.7} />
                  </span>
                  <span className="tt-name">{t.name}</span>
                  <span className="tt-desc">{t.description}</span>
                  <span className="tt-go">
                    <Icon name="arrowRight" size={18} />
                  </span>
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
