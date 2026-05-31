"use client";

import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import { FileDrop, ProgressBar, RunButton } from "@/components/pdfui";
import { Segmented, TerminalWindow } from "@/components/ui";
import { baseName, downloadBlob, formatBytes, openPdfjsDoc, renderPageToBlob } from "@/lib/pdf";

interface Loaded {
  name: string;
  bytes: ArrayBuffer;
  size: number;
}
type Level = "strong" | "balanced" | "light";
const PRESETS: Record<Level, { scale: number; quality: number; label: string }> = {
  strong: { scale: 1.0, quality: 0.5, label: "Strong" },
  balanced: { scale: 1.5, quality: 0.65, label: "Balanced" },
  light: { scale: 2.0, quality: 0.8, label: "Light" },
};

export default function CompressTool() {
  const [doc, setDoc] = useState<Loaded | null>(null);
  const [level, setLevel] = useState<Level>("balanced");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [note, setNote] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setNote(null);
    file.arrayBuffer().then((bytes) => setDoc({ name: file.name, bytes, size: file.size }));
  };

  const run = async () => {
    if (!doc) return;
    setBusy(true);
    setProgress(0);
    setNote(null);
    const pdfjsDoc = await openPdfjsDoc(doc.bytes).catch((e) => {
      setNote({ kind: "err", msg: `Couldn't read PDF: ${(e as Error).message}` });
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
      const result = await out.save();
      const newSize = result.byteLength;
      const stem = baseName(doc.name);
      downloadBlob(result, `${stem}-compressed.pdf`);
      const diff = doc.size - newSize;
      const pct = doc.size > 0 ? Math.round((diff / doc.size) * 100) : 0;
      setNote(
        diff > 0
          ? {
              kind: "ok",
              msg: `${formatBytes(doc.size)} → ${formatBytes(newSize)} (${pct}% smaller). Pages were flattened to images.`,
            }
          : {
              kind: "err",
              msg: `Result (${formatBytes(newSize)}) wasn't smaller than the original (${formatBytes(doc.size)}). This method only helps image-heavy PDFs — try a stronger level, or skip compression.`,
            },
      );
    } catch (e) {
      setNote({ kind: "err", msg: `Compress failed: ${(e as Error).message}` });
    } finally {
      pdfjsDoc.destroy();
      setBusy(false);
    }
  };

  return (
    <div>
      <TerminalWindow title={<><b>compress</b> — source PDF</>} glow>
        <FileDrop
          accept="application/pdf"
          multiple={false}
          onFiles={load}
          label={doc ? doc.name : "Drop a PDF here"}
          hint={doc ? `${formatBytes(doc.size)} loaded` : "single file — nothing is uploaded"}
        />
      </TerminalWindow>

      {doc && (
        <>
          <div className="opt-row">
            <label className="opt">
              <span>compression</span>
              <Segmented
                value={level}
                onChange={setLevel}
                options={[
                  { value: "strong", label: "Strong" },
                  { value: "balanced", label: "Balanced" },
                  { value: "light", label: "Light" },
                ]}
              />
            </label>
          </div>

          <div className="pdf-note">
            Heads-up: this re-renders each page to a JPEG image, so text becomes
            non-selectable. It shrinks scanned / image-heavy PDFs well, but can
            <em> grow</em> text-only PDFs — those are already compact.
          </div>

          <div className="pdf-actions">
            <RunButton onClick={run} busy={busy}>Compress PDF</RunButton>
            <button type="button" className="btn" onClick={() => setDoc(null)} disabled={busy}>Clear</button>
          </div>

          {busy && <ProgressBar value={progress} />}
        </>
      )}

      {note && <div className={`pdf-note ${note.kind}`}>{note.msg}</div>}
    </div>
  );
}
