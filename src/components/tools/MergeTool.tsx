"use client";

import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { FileDrop, FileList, RunButton, type NamedFile } from "@/components/pdfui";
import { Banner } from "@/components/ui";
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
      setNote({ kind: "ok", msg: `Merged ${items.length} files into merged.pdf (${pages} pages).` });
    } catch (e) {
      setNote({ kind: "err", msg: `Merge failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack" style={{ gap: "var(--s-5)" }}>
      <FileDrop
        accept="application/pdf"
        onFiles={addFiles}
        title={<>Drop PDFs or <span className="em">browse</span> to add</>}
        sub="Add as many PDFs as you like — they'll merge top to bottom."
      />
      {items.length > 0 && <FileList items={items} onRemove={remove} onMove={move} />}

      <div className="run-bar">
        <RunButton onClick={run} busy={busy} disabled={items.length < 2} icon="merge">
          Merge {items.length > 0 ? `${items.length} PDFs` : "PDFs"}
        </RunButton>
        {items.length > 0 && (
          <button type="button" className="btn btn-ghost" onClick={() => setItems([])} disabled={busy}>
            Clear
          </button>
        )}
        {items.length < 2 && <span className="note">Add at least 2 files.</span>}
      </div>

      {note && (
        <Banner kind={note.kind === "ok" ? "success" : "error"} title={note.kind === "ok" ? "Done" : "Couldn't merge"}>
          {note.msg}
        </Banner>
      )}
    </div>
  );
}
