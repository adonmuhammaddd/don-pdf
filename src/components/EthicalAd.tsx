"use client";

import { useEffect } from "react";
import { ETHICAL_ADS_PUBLISHER, adsEnabled } from "@/lib/ads";
import { SUPPORT_LINKS } from "@/lib/support";

const REPO_URL = "https://github.com/adonmuhammaddd/don-pdf";

declare global {
  interface Window {
    ethicalads?: { load: () => void };
  }
}

const SCRIPT_SRC = "https://media.ethicalads.io/media/client/ethicalads.min.js";

/**
 * Renders a single EthicalAds slot. No-op (and loads zero remote code) unless a
 * publisher ID is configured in `@/lib/ads`, so the default build stays fully
 * offline and dependency-free.
 */
export function EthicalAd({
  type = "text",
  className = "",
}: {
  type?: "text" | "image";
  className?: string;
}) {
  useEffect(() => {
    if (!adsEnabled) return;
    // Script already present → just (re)scan the DOM for ad slots.
    if (window.ethicalads) {
      window.ethicalads.load();
      return;
    }
    if (document.querySelector(`script[src="${SCRIPT_SRC}"]`)) return;
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    document.body.appendChild(s);
  }, []);

  // No publisher configured (e.g. EthicalAds not approved yet) → show a small
  // house ad asking for support instead of leaving the slot empty.
  if (!adsEnabled) return <HouseAd />;

  return (
    <div className={`ad-slot ${className}`.trim()}>
      <div data-ea-publisher={ETHICAL_ADS_PUBLISHER} data-ea-type={type} />
    </div>
  );
}

/** Fallback self-promo shown in the ad slot until real ads are enabled. */
function HouseAd() {
  const primary = SUPPORT_LINKS[0];
  const href = primary?.url ?? REPO_URL;
  const glyph = primary?.glyph ?? "★";
  const cta = primary ? "Dukung proyek ini" : "Star di GitHub";

  return (
    <div className="ad-slot house-ad">
      <div className="house-ad-card">
        <span className="house-ad-label">{"// community supported"}</span>
        <p className="house-ad-text">
          Suka DonPDF? Bantu biar tetap gratis &amp; tanpa iklan tracking.
        </p>
        <a
          className="house-ad-cta"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span aria-hidden="true">{glyph}</span> {cta}
        </a>
      </div>
    </div>
  );
}
