# DonPDF — Claude notes

Privacy-first, **client-side-only** PDF toolkit. Sibling of DonDevTool: same
stack (Next 16 export, React 19, Tailwind v4, TS) and the same retro-terminal
design system (copied verbatim: `tokens.css`, `terminal.css`, `fonts.css`,
`ui.tsx`, `useTweaks.ts`, `EthicalAd.tsx`, `support.ts`, `ads.ts`).

## Hard rule

**Nothing gets uploaded.** Every tool: `File` → `ArrayBuffer` → process in
browser → Blob download. If a feature can't run client-side (PDF→Excel/Word/PPT,
OCR), it does **not** go in this app's core — it's Phase 3, fenced off behind an
explicit upload notice or a local sidecar. Don't quietly add a server.

## Architecture

- `src/components/registry.ts` — single source of truth for tools. Add an entry
  (`id`, `name`, `category`, `glyph`, `Component`) and the shell, sidebar,
  search, and home catalog wire it up automatically. Categories:
  `"Organize & merge"`, `"Convert"`.
- `src/components/AppShell.tsx` — hash-routed shell (sidebar + topbar + ⌘K
  search), copied from DonDevTool with DonPDF branding.
- `src/components/tools/*Tool.tsx` — one component per tool.
- `src/components/pdfui.tsx` — shared PDF UI: `FileDrop`, `FileList`,
  `ProgressBar`, `RunButton`.
- `src/lib/pdf.ts` — shared logic: file/blob plumbing, `parsePageRange`, pdf.js
  loader + page/thumbnail rasterisers.
- `src/app/pdf.css` — PDF-specific styles on top of the terminal tokens.

## pdf.js worker

pdf.js needs its worker same-origin. `scripts/copy-pdf-worker.mjs` copies it to
`public/pdf.worker.min.mjs` on `predev`/`prebuild`; `lib/pdf.ts:workerUrl()`
resolves it against `document.baseURI` (so subpath deploys work). Don't import
the worker through the bundler — `output: export` + Turbopack makes that fragile.

## Libraries

- `pdf-lib` — merge/split/rotate/assemble/image→pdf. Pure JS → testable in Node.
- `pdfjs-dist` — render pages to images + thumbnails. Note: `page.render()` takes
  `{ canvasContext, viewport }` — there is no `canvas` field in v4's types.
- `jszip` — `.zip` outputs (split-all, pdf→images-all).

## Verify

- Node smoke test of pdf-lib ops (merge/split/rotate/organize) — fast, no browser.
- Browser flows (pdf.js render, organize thumbnails, downloads) verified with
  Playwright driving system Chrome (`channel: "chrome"`). Lint ignores
  `public/**` so the minified worker isn't scanned.

## Commits

Per repo-owner preference: **do not** add Claude as a git co-author.
