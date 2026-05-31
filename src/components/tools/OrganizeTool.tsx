"use client";

import { useState } from "react";
import { degrees, PDFDocument } from "pdf-lib";
import { FileDrop, ProgressBar, RunButton } from "@/components/pdfui";
import { Banner, Icon, cx } from "@/components/ui";
import { baseName, downloadBlob, openPdfjsDoc, renderThumbnail } from "@/lib/pdf";

interface PageItem {
  key: string;
  idx: number;
  baseRot: number;
  rot: number;
  deleted: boolean;
  thumb: string;
}

export default function OrganizeTool() {
  const [name, setName] = useState("");
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
        const { url } = await renderThumbnail(doc, i, 200);
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
        pg.setRotation(degrees((kept[i].baseRot + kept[i].rot) % 360));
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

  if (pages.length === 0) {
    return (
      <div className="stack" style={{ gap: "var(--s-5)" }}>
        <FileDrop
          accept="application/pdf"
          multiple={false}
          onFiles={load}
          icon="organize"
          title={loading ? "Rendering pages…" : <>Drop a PDF or <span className="em">browse</span></>}
          sub={loading ? "One moment." : "Reorder, rotate, and delete pages, then export."}
        />
        {loading && <ProgressBar value={progress} label="Loading pages" />}
        {note && <Banner kind="error">{note.msg}</Banner>}
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: "var(--s-5)" }}>
      <div className="run-bar" style={{ marginTop: 0 }}>
        <RunButton onClick={run} busy={busy} icon="download">
          Export {keptCount} page{keptCount === 1 ? "" : "s"}
        </RunButton>
        <button type="button" className="btn btn-ghost" onClick={reset} disabled={busy}>
          Load another
        </button>
        <span className="note">{name} · {pages.length} pages</span>
      </div>

      <div className="page-grid">
        {pages.map((p, i) => {
          const total = (p.baseRot + p.rot) % 360;
          return (
            <div className={cx("page-card", p.deleted && "deleted")} key={p.key}>
              {total !== 0 && <span className="pc-badge">{total}°</span>}
              {p.deleted && <span className="pc-flag">removed</span>}
              <div className="pc-sheet">
                {/* eslint-disable-next-line @next/next/no-img-element -- local data-URL thumbnail */}
                <img
                  src={p.thumb}
                  alt={`Page ${p.idx + 1}`}
                  style={{ width: "100%", height: "100%", objectFit: "contain", transform: p.rot ? `rotate(${p.rot}deg)` : undefined }}
                />
                <div className="pc-overlay">
                  <button type="button" className="icon-btn" onClick={() => move(p.key, -1)} disabled={i === 0} aria-label="Move left">
                    <Icon name="chevronRight" size={16} style={{ transform: "rotate(180deg)" }} />
                  </button>
                  <button type="button" className="icon-btn" onClick={() => rotate(p.key)} aria-label="Rotate">
                    <Icon name="rotate" size={16} />
                  </button>
                  <button type="button" className="icon-btn danger" onClick={() => toggleDelete(p.key)} aria-label={p.deleted ? "Restore" : "Delete"}>
                    <Icon name={p.deleted ? "undo" : "trash"} size={16} />
                  </button>
                  <button type="button" className="icon-btn" onClick={() => move(p.key, 1)} disabled={i === pages.length - 1} aria-label="Move right">
                    <Icon name="chevronRight" size={16} />
                  </button>
                </div>
              </div>
              <div className="pc-bar">
                <span>#{i + 1}</span>
                <span>p{p.idx + 1}</span>
              </div>
            </div>
          );
        })}
      </div>

      {note && (
        <Banner kind={note.kind === "ok" ? "success" : "error"} title={note.kind === "ok" ? "Done" : "Couldn't export"}>
          {note.msg}
        </Banner>
      )}
    </div>
  );
}
