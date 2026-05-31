"use client";

import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { FileDrop, RunButton } from "@/components/pdfui";
import { Banner, Segmented } from "@/components/ui";
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
  const [target, setTarget] = useState<"all" | "range">("all");
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
      const indices = target === "all" ? pdf.getPageIndices() : parsePageRange(range, doc.pages);
      const pages = pdf.getPages();
      for (const idx of indices) {
        const page = pages[idx];
        const cb = page.getCropBox();
        const w = cb.width - left - right;
        const h = cb.height - top - bottom;
        if (w <= 0 || h <= 0) throw new Error(`Crop too large for page ${idx + 1} (${Math.round(cb.width)}×${Math.round(cb.height)} pt).`);
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

  if (!doc) {
    return (
      <FileDrop
        accept="application/pdf"
        multiple={false}
        onFiles={load}
        icon="crop"
        title={<>Drop a PDF or <span className="em">browse</span></>}
        sub="Trim margins from every page, with a live preview."
      />
    );
  }

  const numField = (label: string, val: number, set: (n: number) => void) => (
    <div className="field" style={{ marginBottom: 0 }}>
      <label>{label}</label>
      <input className="input" type="number" min={0} value={val} onChange={(e) => set(Number(e.target.value))} />
    </div>
  );

  return (
    <div className="stack" style={{ gap: "var(--s-5)" }}>
      <div className="split-layout">
        <div className="panel">
          <div className="panel-title with-sub">{doc.name}</div>
          <div className="panel-sub">{doc.pages} pages · page 1 is {Math.round(doc.ptW)}×{Math.round(doc.ptH)} pt</div>
          <div className="field-row">
            {numField("Top (pt)", top, setTop)}
            {numField("Right (pt)", right, setRight)}
          </div>
          <div className="field-row" style={{ marginTop: "var(--s-4)" }}>
            {numField("Bottom (pt)", bottom, setBottom)}
            {numField("Left (pt)", left, setLeft)}
          </div>
          <div className="field" style={{ marginTop: "var(--s-5)", marginBottom: 0 }}>
            <label>Apply to</label>
            <Segmented
              value={target}
              onChange={setTarget}
              options={[
                { value: "all", label: "All pages" },
                { value: "range", label: "Range" },
              ]}
            />
            {target === "range" && (
              <input className="input mono" style={{ marginTop: 8 }} value={range} onChange={(e) => setRange(e.target.value)} placeholder="e.g. 1-3" />
            )}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Preview · page 1</div>
          <div className="crop-preview" style={{ aspectRatio: `${doc.ptW} / ${doc.ptH}`, width: 260 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL preview */}
            <img src={doc.thumb} alt="page 1 preview" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            <div
              className="crop-box"
              style={{
                left: pct(left, doc.ptW),
                right: pct(right, doc.ptW),
                top: pct(top, doc.ptH),
                bottom: pct(bottom, doc.ptH),
                boxShadow: "0 0 0 9999px var(--overlay)",
              }}
            />
          </div>
        </div>
      </div>

      <div className="run-bar">
        <RunButton onClick={run} busy={busy} icon="crop">
          Crop &amp; download
        </RunButton>
        <button type="button" className="btn btn-ghost" onClick={() => setDoc(null)} disabled={busy}>
          Choose another
        </button>
      </div>

      {note && (
        <Banner kind={note.kind === "ok" ? "success" : "error"} title={note.kind === "ok" ? "Done" : "Couldn't crop"}>
          {note.msg}
        </Banner>
      )}
    </div>
  );
}
