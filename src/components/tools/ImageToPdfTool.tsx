"use client";

import { useState } from "react";
import { PDFDocument, type PDFImage } from "pdf-lib";
import { FileDrop, FileList, RunButton, type NamedFile } from "@/components/pdfui";
import { Banner, Segmented } from "@/components/ui";
import { downloadBlob } from "@/lib/pdf";

const uid = () => Math.random().toString(36).slice(2);
const A4 = { w: 595.28, h: 841.89 };
const MARGIN = 36;
type PageMode = "match" | "a4";

const isImage = (f: File) =>
  f.type === "image/jpeg" || f.type === "image/png" || /\.(jpe?g|png)$/i.test(f.name);

export default function ImageToPdfTool() {
  const [items, setItems] = useState<NamedFile[]>([]);
  const [pageMode, setPageMode] = useState<PageMode>("match");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const addFiles = (files: File[]) => {
    const imgs = files.filter(isImage);
    setItems((prev) => [...prev, ...imgs.map((file) => ({ id: uid(), file }))]);
    setNote(null);
  };
  const remove = (id: string) => setItems((p) => p.filter((i) => i.id !== id));
  const move = (id: string, dir: -1 | 1) =>
    setItems((p) => {
      const i = p.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const run = async () => {
    if (items.length === 0) return;
    setBusy(true);
    setNote(null);
    try {
      const out = await PDFDocument.create();
      for (const it of items) {
        const bytes = await it.file.arrayBuffer();
        const isPng = it.file.type === "image/png" || /\.png$/i.test(it.file.name);
        const img: PDFImage = isPng ? await out.embedPng(bytes) : await out.embedJpg(bytes);
        if (pageMode === "match") {
          const page = out.addPage([img.width, img.height]);
          page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
        } else {
          const page = out.addPage([A4.w, A4.h]);
          const maxW = A4.w - MARGIN * 2;
          const maxH = A4.h - MARGIN * 2;
          const scale = Math.min(maxW / img.width, maxH / img.height, 1);
          const w = img.width * scale;
          const h = img.height * scale;
          page.drawImage(img, { x: (A4.w - w) / 2, y: (A4.h - h) / 2, width: w, height: h });
        }
      }
      const result = await out.save();
      downloadBlob(result, "images.pdf");
      setNote({ kind: "ok", msg: `Combined ${items.length} image${items.length === 1 ? "" : "s"} → images.pdf` });
    } catch (e) {
      setNote({ kind: "err", msg: `Conversion failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: "var(--s-5)" }}>
      <FileDrop
        accept="image/jpeg,image/png"
        onFiles={addFiles}
        icon="image"
        title={<>Drop JPG / PNG or <span className="em">browse</span></>}
        sub="One image per page — drag to reorder before converting."
      />
      {items.length > 0 && (
        <>
          <FileList items={items} onRemove={remove} onMove={move} />
          <div className="field">
            <label>Page size</label>
            <Segmented
              value={pageMode}
              onChange={setPageMode}
              options={[
                { value: "match", label: "Match image" },
                { value: "a4", label: "Fit to A4" },
              ]}
            />
          </div>
        </>
      )}

      <div className="run-bar">
        <RunButton onClick={run} busy={busy} disabled={items.length === 0} icon="img2pdf">
          Create PDF
        </RunButton>
        {items.length > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => setItems([])} disabled={busy}>
            Clear
          </button>
        )}
      </div>

      {note && (
        <Banner kind={note.kind === "ok" ? "success" : "error"} title={note.kind === "ok" ? "Done" : "Couldn't convert"}>
          {note.msg}
        </Banner>
      )}
    </div>
  );
}
