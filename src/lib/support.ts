/**
 * Donation / sponsor links shown in the sidebar footer.
 *
 * ⚠️  EDIT THESE: replace the `USERNAME` placeholders with your real handles.
 * Set `url` to "" to hide a platform entirely.
 */
export type SupportLink = {
  id: string;
  label: string; // shown in the UI
  glyph: string; // single-char terminal glyph
  url: string;
};

export const SUPPORT_LINKS: SupportLink[] = [
  {
    id: "trakteer",
    label: "Trakteer",
    glyph: "☕",
    url: "https://trakteer.id/don.dev.exe", // TODO: ganti USERNAME
  },
  {
    id: "saweria",
    label: "Saweria",
    glyph: "✦",
    url: "https://saweria.co/babyboyyy", // TODO: ganti USERNAME
  },
  {
    id: "github",
    label: "GitHub Sponsors",
    glyph: "❤",
    url: "https://github.com/sponsors/adonmuhammaddd",
  },
  {
    id: "patreon",
    label: "Patreon",
    glyph: "ⓟ",
    url: "https://www.patreon.com/DonDev", // TODO: ganti USERNAME
  },
].filter((l) => l.url.length > 0);
