"use client";

import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { FileDrop, RunButton } from "@/components/pdfui";
import { Segmented, TerminalWindow } from "@/components/ui";
import { baseName, downloadBlob, openPdfjsDoc, parsePageRange, renderThumbnail } from "@/lib/pdf";

interface Loaded {
  name: string;
  bytes: ArrayBuffer;
  pages: number;
  ptW: number;
  ptH: number;
  thumb: string;
}

export default function CropTool() {
  const [doc, setDoc] = useState<Loaded | null>(null);
  const [top, setTop] = useState(0);
  const [right, setRight] = useState(0);
  const [bottom, setBottom] = useState(0);
  const [left, setLeft] = useState(0);
  const [allPages, setAllPages] = useState(true);
  const [range, setRange] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setNote(null);
    try {
      const bytes = await file.arrayBuffer();
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const cb = pdf.getPage(0).getCropBox();
      const pj = await openPdfjsDoc(bytes);
      const { url } = await renderThumbnail(pj, 1, 320);
      pj.destroy();
      setDoc({ name: file.name, bytes, pages: pdf.getPageCount(), ptW: cb.width, ptH: cb.height, thumb: url });
      setRange(`1-${pdf.getPageCount()}`);
      setTop(0); setRight(0); setBottom(0); setLeft(0);
    } catch (e) {
      setNote({ kind: "err", msg: `Couldn't read PDF: ${(e as Error).message}` });
    }
  };

  const run = async () => {
    if (!doc) return;
    setBusy(true);
    setNote(null);
    try {
      const pdf = await PDFDocument.load(doc.bytes, { ignoreEncryption: true });
      const indices = allPages ? pdf.getPageIndices() : parsePageRange(range, doc.pages);
      const pages = pdf.getPages();
      for (const idx of indices) {
        const page = pages[idx];
        const cb = page.getCropBox();
        const w = cb.width - left - right;
        const h = cb.height - top - bottom;
        if (w <= 0 || h <= 0) {
          throw new Error(`Crop too large for page ${idx + 1} (${Math.round(cb.width)}×${Math.round(cb.height)} pt).`);
        }
        page.setCropBox(cb.x + left, cb.y + bottom, w, h);
      }
      const out = await pdf.save();
      const stem = baseName(doc.name);
      downloadBlob(out, `${stem}-cropped.pdf`);
      setNote({ kind: "ok", msg: `Cropped ${indices.length} page${indices.length === 1 ? "" : "s"} → ${stem}-cropped.pdf` });
    } catch (e) {
      setNote({ kind: "err", msg: `Crop failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  const pct = (v: number, total: number) => `${Math.max(0, Math.min(100, (v / total) * 100))}%`;

  return (
    <div>
      <TerminalWindow title={<><b>crop</b> — source PDF</>} glow>
        <FileDrop
          accept="application/pdf"
          multiple={false}
          onFiles={load}
          label={doc ? doc.name : "Drop a PDF here"}
          hint={doc ? `${doc.pages} pages · page 1 is ${Math.round(doc.ptW)}×${Math.round(doc.ptH)} pt` : "single file — nothing is uploaded"}
        />
      </TerminalWindow>

      {doc && (
        <>
          <div className="opt-row">
            <label className="opt"><span>top (pt)</span><input type="number" min={0} value={top} onChange={(e) => setTop(Number(e.target.value))} /></label>
            <label className="opt"><span>right (pt)</span><input type="number" min={0} value={right} onChange={(e) => setRight(Number(e.target.value))} /></label>
            <label className="opt"><span>bottom (pt)</span><input type="number" min={0} value={bottom} onChange={(e) => setBottom(Number(e.target.value))} /></label>
            <label className="opt"><span>left (pt)</span><input type="number" min={0} value={left} onChange={(e) => setLeft(Number(e.target.value))} /></label>
            <label className="opt">
              <span>apply to</span>
              <Segmented
                value={allPages ? "all" : "range"}
                onChange={(v) => setAllPages(v === "all")}
                options={[{ value: "all", label: "All" }, { value: "range", label: "Range" }]}
              />
            </label>
            {!allPages && (
              <label className="opt"><span>pages</span><input type="text" value={range} onChange={(e) => setRange(e.target.value)} placeholder="e.g. 1-3" /></label>
            )}
          </div>

          <div className="crop-preview">
            {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL preview */}
            <img src={doc.thumb} alt="page 1 preview" />
            <div
              className="crop-rect"
              style={{
                left: pct(left, doc.ptW),
                right: pct(right, doc.ptW),
                top: pct(top, doc.ptH),
                bottom: pct(bottom, doc.ptH),
              }}
            />
          </div>

          <div className="pdf-actions">
            <RunButton onClick={run} busy={busy}>Crop &amp; download</RunButton>
            <button type="button" className="btn" onClick={() => setDoc(null)} disabled={busy}>Clear</button>
          </div>
        </>
      )}

      {note && <div className={`pdf-note ${note.kind}`}>{note.msg}</div>}
    </div>
  );
}
