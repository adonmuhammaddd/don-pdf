"use client";

import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { FileDrop, FileList, RunButton, type NamedFile } from "@/components/pdfui";
import { TerminalWindow } from "@/components/ui";
import { downloadBlob } from "@/lib/pdf";

const uid = () => Math.random().toString(36).slice(2);

export default function MergeTool() {
  const [items, setItems] = useState<NamedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const addFiles = (files: File[]) => {
    const pdfs = files.filter((f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"));
    setItems((prev) => [...prev, ...pdfs.map((file) => ({ id: uid(), file }))]);
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
    if (items.length < 2) {
      setNote({ kind: "err", msg: "Add at least two PDFs to merge." });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const out = await PDFDocument.create();
      let pages = 0;
      for (const it of items) {
        const bytes = await it.file.arrayBuffer();
        const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
        const copied = await out.copyPages(src, src.getPageIndices());
        copied.forEach((p) => out.addPage(p));
        pages += copied.length;
      }
      const result = await out.save();
      downloadBlob(result, "merged.pdf");
      setNote({ kind: "ok", msg: `Merged ${items.length} files → merged.pdf (${pages} pages).` });
    } catch (e) {
      setNote({ kind: "err", msg: `Merge failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <TerminalWindow title={<><b>merge</b> — drop PDFs in order</>} glow>
        <FileDrop
          accept="application/pdf"
          onFiles={addFiles}
          label="Drop PDF files here"
          hint="add two or more — drag to reorder with ↑ ↓ — nothing is uploaded"
        />
        <FileList items={items} onRemove={remove} onMove={move} />
      </TerminalWindow>

      <div className="pdf-actions">
        <RunButton onClick={run} busy={busy} disabled={items.length < 2}>
          Merge {items.length > 0 ? `${items.length} PDFs` : "PDFs"}
        </RunButton>
        {items.length > 0 && (
          <button type="button" className="btn" onClick={() => setItems([])} disabled={busy}>
            Clear
          </button>
        )}
      </div>

      {note && <div className={`pdf-note ${note.kind}`}>{note.msg}</div>}
    </div>
  );
}
