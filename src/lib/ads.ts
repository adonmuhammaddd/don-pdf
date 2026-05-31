/**
 * EthicalAds — privacy-first, cookieless, *no-tracking* contextual ads aimed
 * at developers. Chosen over AdSense because it doesn't track users, which
 * keeps DonDevTool honest about its privacy stance.
 *
 * Leave the publisher ID empty and the app stays fully offline / zero-deps:
 * <EthicalAd> renders nothing and no remote script is ever loaded. Set it
 * (after approval at https://www.ethicalads.io/publishers/) to enable a single
 * tasteful ad — EthicalAds does not set cookies or track visitors, and never
 * receives the data you process in the tools (that stays in your browser).
 */
export const ETHICAL_ADS_PUBLISHER = "" // e.g. "dondevtool"

export const adsEnabled = ETHICAL_ADS_PUBLISHER.length > 0
