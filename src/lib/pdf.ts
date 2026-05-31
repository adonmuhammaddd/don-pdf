/**
 * Shared client-side PDF helpers. Everything here runs in the browser — files
 * are read as ArrayBuffers and never uploaded. `pdf-lib` handles structural
 * edits (merge / split / rotate / assemble); `pdfjs-dist` handles rasterising
 * pages to images and rendering thumbnails.
 */
import type { PDFDocumentProxy } from "pdfjs-dist";

export const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB soft guard

/* ---------------- File / blob plumbing ---------------- */

export function readArrayBuffer(file: File): Promise<ArrayBuffer> {
  return file.arrayBuffer();
}

export function downloadBlob(data: Blob | Uint8Array, filename: string): void {
  const blob =
    data instanceof Blob ? data : new Blob([data as BlobPart], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the download a tick to start before revoking.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Strips a trailing extension for building output filenames. */
export function baseName(name: string): string {
  return name.replace(/\.[^/.]+$/, "");
}

/* ---------------- Page-range parsing ---------------- */

/**
 * Parses a human page range like "1-3, 5, 8-10" into zero-based indices,
 * clamped/validated against `total` (1-based input). Throws on malformed input.
 */
export function parsePageRange(input: string, total: number): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  const parts = input
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) throw new Error("Empty range.");

  for (const part of parts) {
    const m = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      let a = parseInt(m[1], 10);
      let b = parseInt(m[2], 10);
      if (a > b) [a, b] = [b, a];
      for (let p = a; p <= b; p++) addPage(p);
    } else if (/^\d+$/.test(part)) {
      addPage(parseInt(part, 10));
    } else {
      throw new Error(`Invalid range segment: "${part}"`);
    }
  }
  if (out.length === 0) throw new Error("No valid pages in range.");
  return out;

  function addPage(p: number) {
    if (p < 1 || p > total) throw new Error(`Page ${p} is out of range (1–${total}).`);
    const idx = p - 1;
    if (!seen.has(idx)) {
      seen.add(idx);
      out.push(idx);
    }
  }
}

/* ---------------- pdf.js (rasterisation) ---------------- */

/**
 * pdf.js needs its worker served from a same-origin URL. We copy the prebuilt
 * worker into /public at build time (scripts/copy-pdf-worker.mjs) and resolve
 * it relative to the document base so subpath deploys keep working.
 */
function workerUrl(): string {
  const base = typeof document !== "undefined" ? document.baseURI : "/";
  return new URL("pdf.worker.min.mjs", base).toString();
}

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
async function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import("pdfjs-dist").then((mod) => {
      mod.GlobalWorkerOptions.workerSrc = workerUrl();
      return mod;
    });
  }
  return pdfjsPromise;
}

/** Opens a pdf.js document from raw bytes. Caller must `.destroy()` when done. */
export async function openPdfjsDoc(bytes: ArrayBuffer): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfjs();
  // Clone the buffer — pdf.js may detach/transfer it to the worker.
  const data = bytes.slice(0);
  return pdfjs.getDocument({ data }).promise;
}

export interface RenderedPage {
  page: number; // 1-based
  blob: Blob;
  width: number;
  height: number;
}

export type ImageType = "image/png" | "image/jpeg";

/** Renders a single page of an already-open pdf.js doc to a canvas blob. */
export async function renderPageToBlob(
  doc: PDFDocumentProxy,
  pageNum: number,
  opts: { scale: number; type: ImageType; quality?: number },
): Promise<RenderedPage> {
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale: opts.scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");
  // White matte so transparent PDFs don't render black when flattened to JPEG.
  if (opts.type === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  await page.render({ canvasContext: ctx, viewport }).promise;
  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, opts.type, opts.quality),
  );
  page.cleanup();
  if (!blob) throw new Error(`Failed to encode page ${pageNum}.`);
  return { page: pageNum, blob, width: canvas.width, height: canvas.height };
}

/** Renders a small data-URL thumbnail for a page (used by the organize grid). */
export async function renderThumbnail(
  doc: PDFDocumentProxy,
  pageNum: number,
  maxEdge = 160,
): Promise<{ url: string; w: number; h: number }> {
  const page = await doc.getPage(pageNum);
  const base = page.getViewport({ scale: 1 });
  const scale = maxEdge / Math.max(base.width, base.height);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return { url: canvas.toDataURL("image/jpeg", 0.7), w: canvas.width, h: canvas.height };
}
