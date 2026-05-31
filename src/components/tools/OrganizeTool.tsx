"use client";

import { useState } from "react";
import { degrees, PDFDocument } from "pdf-lib";
import { FileDrop, ProgressBar, RunButton } from "@/components/pdfui";
import { TerminalWindow } from "@/components/ui";
import { baseName, downloadBlob, openPdfjsDoc, renderThumbnail } from "@/lib/pdf";

interface PageItem {
  key: string;
  idx: number; // original 0-based page index
  baseRot: number; // rotation already on the page
  rot: number; // added rotation (cw)
  deleted: boolean;
  thumb: string;
}

export default function OrganizeTool() {
  const [name, setName] = useState<string>("");
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setNote(null);
    setLoading(true);
    setProgress(0);
    setPages([]);
    try {
      const buf = await file.arrayBuffer();
      const pdfLib = await PDFDocument.load(buf, { ignoreEncryption: true });
      const baseRots = pdfLib.getPages().map((p) => p.getRotation().angle);
      const doc = await openPdfjsDoc(buf);
      const total = doc.numPages;
      const items: PageItem[] = [];
      for (let i = 1; i <= total; i++) {
        const { url } = await renderThumbnail(doc, i, 150);
        items.push({
          key: `${i}-${Math.random().toString(36).slice(2)}`,
          idx: i - 1,
          baseRot: baseRots[i - 1] ?? 0,
          rot: 0,
          deleted: false,
          thumb: url,
        });
        setProgress(i / total);
      }
      doc.destroy();
      setName(file.name);
      setBytes(buf);
      setPages(items);
    } catch (e) {
      setNote({ kind: "err", msg: `Couldn't read PDF: ${(e as Error).message}` });
    } finally {
      setLoading(false);
    }
  };

  const move = (key: string, dir: -1 | 1) =>
    setPages((p) => {
      const i = p.findIndex((x) => x.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= p.length) return p;
      const next = [...p];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  const rotate = (key: string) =>
    setPages((p) => p.map((x) => (x.key === key ? { ...x, rot: (x.rot + 90) % 360 } : x)));
  const toggleDelete = (key: string) =>
    setPages((p) => p.map((x) => (x.key === key ? { ...x, deleted: !x.deleted } : x)));

  const reset = () => {
    setBytes(null);
    setPages([]);
    setName("");
    setNote(null);
  };

  const keptCount = pages.filter((p) => !p.deleted).length;

  const run = async () => {
    if (!bytes) return;
    if (keptCount === 0) {
      setNote({ kind: "err", msg: "All pages are deleted — nothing to export." });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const src = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const out = await PDFDocument.create();
      const kept = pages.filter((p) => !p.deleted);
      const copied = await out.copyPages(src, kept.map((p) => p.idx));
      copied.forEach((pg, i) => {
        const total = (kept[i].baseRot + kept[i].rot) % 360;
        pg.setRotation(degrees(total));
        out.addPage(pg);
      });
      const result = await out.save();
      const stem = baseName(name);
      downloadBlob(result, `${stem}-organized.pdf`);
      setNote({ kind: "ok", msg: `Exported ${kept.length} pages → ${stem}-organized.pdf` });
    } catch (e) {
      setNote({ kind: "err", msg: `Export failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {pages.length === 0 && (
        <TerminalWindow title={<><b>organize</b> — source PDF</>} glow>
          <FileDrop
            accept="application/pdf"
            multiple={false}
            onFiles={load}
            label={loading ? "Rendering pages…" : "Drop a PDF here"}
            hint={loading ? undefined : "reorder, rotate & delete pages — nothing is uploaded"}
          />
          {loading && <ProgressBar value={progress} label="loading" />}
        </TerminalWindow>
      )}

      {pages.length > 0 && (
        <>
          <div className="pdf-actions" style={{ marginTop: 0 }}>
            <RunButton onClick={run} busy={busy}>
              Export {keptCount} page{keptCount === 1 ? "" : "s"}
            </RunButton>
            <button type="button" className="btn" onClick={reset} disabled={busy}>
              Load another
            </button>
            <span style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>
              {name} · {pages.length} pages
            </span>
          </div>

          <div className="page-grid">
            {pages.map((p, i) => (
              <div className={`page-cell${p.deleted ? " del" : ""}`} key={p.key}>
                {(p.baseRot + p.rot) % 360 !== 0 && (
                  <span className="page-rot">{(p.baseRot + p.rot) % 360}°</span>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL thumbnail */}
                <img
                  className="page-thumb"
                  src={p.thumb}
                  alt={`Page ${p.idx + 1}`}
                  style={{ transform: `rotate(${p.rot}deg)` }}
                />
                <span className="page-no">
                  #{i + 1} <span style={{ color: "var(--text-2)" }}>(p{p.idx + 1})</span>
                </span>
                <div className="page-ops">
                  <button type="button" onClick={() => move(p.key, -1)} disabled={i === 0} title="Move left">
                    ←
                  </button>
                  <button type="button" onClick={() => rotate(p.key)} title="Rotate 90°">
                    ↻
                  </button>
                  <button type="button" onClick={() => toggleDelete(p.key)} title={p.deleted ? "Restore" : "Delete"}>
                    {p.deleted ? "↺" : "✕"}
                  </button>
                  <button
                    type="button"
                    onClick={() => move(p.key, 1)}
                    disabled={i === pages.length - 1}
                    title="Move right"
                  >
                    →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {note && <div className={`pdf-note ${note.kind}`}>{note.msg}</div>}
    </div>
  );
}
