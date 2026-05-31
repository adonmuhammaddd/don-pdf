# DonPDF

A local, **privacy-first PDF toolkit** in a retro-terminal UI. Merge, split,
organize, rotate, and convert PDFs — entirely in your browser. Your files are
**never uploaded**: no server, no tracking, no accounts.

Part of the Don\* tool family — shares its stack and design system with
[DonDevTool](https://github.com/adonmuhammaddd/dondevtool).

## Tools (Phase 1)

| Tool            | What it does                                                    |
| --------------- | --------------------------------------------------------------- |
| **Merge PDF**   | Combine multiple PDFs into one, in any order.                   |
| **Split PDF**   | Extract a page range, split each page, or every N pages (.zip). |
| **Organize**    | Reorder, rotate, and delete pages visually, then export.        |
| **Rotate PDF**  | Rotate all or selected pages by 90/180/270°.                    |
| **PDF → Image** | Render each page to JPG/PNG (download individually or as .zip). |
| **Image → PDF** | Combine JPG/PNG images into one PDF (match size or fit to A4).  |

See [`PLAN.md`](./PLAN.md) for the roadmap (Phase 2 client-side extras, Phase 3
server-side conversions).

## Stack

- **Next.js 16** (App Router, Turbopack) with `output: "export"` — ships as a
  folder of static files, hash-routed, no Node server.
- **React 19** + **TypeScript** + **Tailwind v4**.
- **pdf-lib** — structural PDF edits. **pdfjs-dist** — page rasterisation.
  **jszip** — multi-file `.zip` outputs. All client-side.

## Develop

```bash
npm install
npm run dev      # http://localhost:3000  (copies pdf.js worker first)
npm run build    # → static site in out/
npm run lint
```

`predev`/`prebuild` run `scripts/copy-pdf-worker.mjs`, which copies the pdf.js
worker into `public/pdf.worker.min.mjs` so it can be served same-origin.

## Deploy

Upload the `out/` folder to any static host (cPanel, Netlify, Vercel static,
GitHub Pages…). No server runtime required.

## Privacy

Every tool reads your file into memory in the browser and writes the result back
as a download. Nothing is ever sent to a server. The optional EthicalAds slot
(disabled by default, see `src/lib/ads.ts`) is cookieless and never sees your
files.
