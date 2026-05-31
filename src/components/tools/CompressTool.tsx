"use client";

import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { FileDrop, ProgressBar, RunButton } from "@/components/pdfui";
import { Banner, Segmented } from "@/components/ui";
import { baseName, downloadBlob, formatBytes, openPdfjsDoc, renderPageToBlob } from "@/lib/pdf";

interface Loaded {
  name: string;
  bytes: ArrayBuffer;
  size: number;
}
type Level = "strong" | "balanced" | "light";
const PRESETS: Record<Level, { scale: number; quality: number }> = {
  strong: { scale: 1.0, quality: 0.5 },
  balanced: { scale: 1.5, quality: 0.65 },
  light: { scale: 2.0, quality: 0.8 },
};

export default function CompressTool() {
  const [doc, setDoc] = useState<Loaded | null>(null);
  const [level, setLevel] = useState<Level>("balanced");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ before: number; after: number } | null>(null);
  const [note, setNote] = useState<{ kind: "error" | "warn"; msg: string } | null>(null);

  const load = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setNote(null);
    setResult(null);
    file.arrayBuffer().then((bytes) => setDoc({ name: file.name, bytes, size: file.size }));
  };

  const run = async () => {
    if (!doc) return;
    setBusy(true);
    setProgress(0);
    setNote(null);
    setResult(null);
    const pdfjsDoc = await openPdfjsDoc(doc.bytes).catch((e) => {
      setNote({ kind: "error", msg: `Couldn't read PDF: ${(e as Error).message}` });
      return null;
    });
    if (!pdfjsDoc) {
      setBusy(false);
      return;
    }
    try {
      const { scale, quality } = PRESETS[level];
      const out = await PDFDocument.create();
      const total = pdfjsDoc.numPages;
      for (let i = 1; i <= total; i++) {
        const r = await renderPageToBlob(pdfjsDoc, i, { scale, type: "image/jpeg", quality });
        const jpg = await out.embedJpg(await r.blob.arrayBuffer());
        const ptW = r.width / scale;
        const ptH = r.height / scale;
        const page = out.addPage([ptW, ptH]);
        page.drawImage(jpg, { x: 0, y: 0, width: ptW, height: ptH });
        setProgress(i / total);
      }
      const bytes = await out.save();
      const after = bytes.byteLength;
      const stem = baseName(doc.name);
      downloadBlob(bytes, `${stem}-compressed.pdf`);
      if (after < doc.size) {
        setResult({ before: doc.size, after });
      } else {
        setNote({
          kind: "warn",
          msg: `Result (${formatBytes(after)}) wasn't smaller than the original (${formatBytes(doc.size)}). This method only helps image-heavy PDFs — text-only PDFs are already compact. The file still downloaded.`,
        });
      }
    } catch (e) {
      setNote({ kind: "error", msg: `Compress failed: ${(e as Error).message}` });
    } finally {
      pdfjsDoc.destroy();
      setBusy(false);
    }
  };

  if (!doc) {
    return (
      <FileDrop
        accept="application/pdf"
        multiple={false}
        onFiles={load}
        icon="compress"
        title={<>Drop a PDF or <span className="em">browse</span></>}
        sub="Best for scanned or image-heavy PDFs."
      />
    );
  }

  const pct = result ? Math.round(((result.before - result.after) / result.before) * 100) : 0;

  return (
    <div className="stack" style={{ gap: "var(--s-5)" }}>
      <div className="panel">
        <div className="panel-title with-sub">{doc.name}</div>
        <div className="panel-sub">{formatBytes(doc.size)} loaded</div>
        <div className="field">
          <label>Compression level</label>
          <Segmented
            value={level}
            onChange={setLevel}
            options={[
              { value: "strong", label: "Strong" },
              { value: "balanced", label: "Balanced" },
              { value: "light", label: "Light" },
            ]}
          />
        </div>
      </div>

      <Banner kind="info" title="How this works">
        Compression re-renders each page to an image, so text becomes
        non-selectable. It shrinks scanned / image-heavy PDFs well, but won&apos;t
        help text-only PDFs.
      </Banner>

      {busy && <ProgressBar value={progress} label="Compressing" />}

      <div className="run-bar">
        <RunButton onClick={run} busy={busy} icon="compress">
          Compress PDF
        </RunButton>
        <button type="button" className="btn btn-ghost" onClick={() => setDoc(null)} disabled={busy}>
          Choose another
        </button>
      </div>

      {result && (
        <div className="size-result">
          <div className="size-stat">
            <div className="lbl">Before</div>
            <div className="val">{formatBytes(result.before)}</div>
          </div>
          <IconArrow />
          <div className="size-stat after">
            <div className="lbl">After</div>
            <div className="val">{formatBytes(result.after)}</div>
          </div>
          <div className="size-pct">−{pct}%</div>
        </div>
      )}

      {note && (
        <Banner kind={note.kind} title={note.kind === "warn" ? "Not much to compress" : "Couldn't compress"}>
          {note.msg}
        </Banner>
      )}
    </div>
  );
}

function IconArrow() {
  return (
    <svg className="size-arrow" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12h15" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}
