# DonPDF — Build Plan

Privacy-first PDF toolkit. A Sejda-style PDF workshop where **every operation
runs in the browser** — files are never uploaded. Same stack & retro-terminal
design system as DonDevTool (Next 16 + React 19 + Tailwind v4 + TS, static
`output: export`).

## Positioning

- **Client-side only.** No server, no uploads, no accounts. The privacy claim is
  the whole pitch — it must stay literally true for everything we ship.
- Brand family with DonDevTool (shared design tokens, mascot, terminal shell).
- Deploys as static files (`out/`) to any static host.

## Tech notes

- `pdf-lib` — structural edits (merge / split / rotate / assemble / image→pdf).
  Pure JS, runs identically in Node (handy for smoke tests).
- `pdfjs-dist` — rasterising pages to images + thumbnails. Needs its worker
  served same-origin → `scripts/copy-pdf-worker.mjs` copies it into `/public`
  on `predev`/`prebuild`; `lib/pdf.ts` points `workerSrc` at it.
- `jszip` — bundling multi-file outputs (split-all, pdf→images) into one `.zip`.

---

## Phase 1 — Client-side core ✅ DONE

All six tools functional, verified in-browser (Playwright + Chrome) and via a
Node smoke test of the pdf-lib operations.

- [x] **Merge PDF** — combine N PDFs, reorder file list.
- [x] **Split PDF** — extract a page range (one PDF) · split each page · every
      N pages (→ `.zip`).
- [x] **Organize Pages** — visual page grid: reorder, rotate per-page, delete /
      restore, export reassembled PDF (thumbnails via pdf.js).
- [x] **Rotate PDF** — rotate all or a page range by 90/180/270°.
- [x] **PDF → Image** — render each page to JPG/PNG at Screen/Print/Hi-res,
      preview grid, per-page download + download-all `.zip`.
- [x] **Image → PDF** — combine JPG/PNG into one PDF (match-image or fit-to-A4).

## Phase 2 — More client-side (next)

Still 100% browser-side, no server needed.

- [ ] **Compress PDF** — downsample/re-encode embedded images (pdf.js render →
      re-embed at lower quality). Realistic wins only on image-heavy PDFs.
- [ ] **Page numbers** — stamp Bates/numbering with position + format options.
- [ ] **Watermark** — text or image watermark, opacity/rotation/tiling.
- [ ] **Delete / extract pages** — quick non-visual variants (Organize already
      covers the visual path).
- [ ] **Fill & Sign** — overlay text fields + drawn/typed signature onto a page
      (canvas capture → pdf-lib `drawImage`/`drawText`). Form-field filling for
      AcroForm PDFs via pdf-lib `getForm()`.
- [ ] **Reorder/Rotate presets**, crop, resize page boxes.

## Phase 3 — Server-side conversions (separate concern)

These genuinely need a backend (table extraction / Office rendering / OCR) and
**break the privacy-first guarantee** — they must be clearly fenced off (opt-in,
explicit "this uploads your file" notice) or run via a local sidecar.

- [ ] **PDF → Excel** — table extraction (Camelot/Tabula-style).
- [ ] **PDF → Word / PowerPoint** — LibreOffice headless or equivalent.
- [ ] **OCR** — scanned-PDF text layer (Tesseract).

Decision pending traction: only build Phase 3 if Phase 1/2 get real usage, and
likely as an optional service rather than folding a server into this static app.

---

## Conventions (mirror DonDevTool)

- Add a tool: create `src/components/tools/XxxTool.tsx`, register it in
  `src/components/registry.ts` (id, name, category, glyph). The shell, search,
  nav, and home catalog pick it up automatically.
- Shared PDF UI lives in `src/components/pdfui.tsx` (FileDrop, FileList,
  ProgressBar, RunButton); shared logic in `src/lib/pdf.ts`.
- Styling: terminal design tokens in `tokens.css`/`terminal.css` (copied from
  DonDevTool, unchanged); PDF-specific classes in `src/app/pdf.css`.
- Never upload. Every tool reads `File` → `ArrayBuffer` and writes a Blob
  download. If a feature can't be done client-side, it belongs in Phase 3.
