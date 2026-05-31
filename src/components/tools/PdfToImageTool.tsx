"use client";

import { useState } from "react";
import JSZip from "jszip";
import { FileDrop, ProgressBar, RunButton } from "@/components/pdfui";
import { Banner, Icon, Segmented } from "@/components/ui";
import {
  baseName,
  downloadBlob,
  openPdfjsDoc,
  renderPageToBlob,
  type ImageType,
} from "@/lib/pdf";

interface Loaded {
  name: string;
  bytes: ArrayBuffer;
}
interface Result {
  page: number;
  blob: Blob;
  url: string;
}
type Fmt = "image/jpeg" | "image/png";
const SCALES: Record<string, number> = { Screen: 1.5, Print: 2.5, Hi: 4 };

export default function PdfToImageTool() {
  const [doc, setDoc] = useState<Loaded | null>(null);
  const [fmt, setFmt] = useState<Fmt>("image/jpeg");
  const [quality, setQuality] = useState<keyof typeof SCALES>("Print");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Result[]>([]);
  const [note, setNote] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const clearResults = () => {
    results.forEach((r) => URL.revokeObjectURL(r.url));
    setResults([]);
  };

  const load = (files: File[]) => {
    const file = files[0];
    if (!file) return;
    clearResults();
    setNote(null);
    file.arrayBuffer().then((bytes) => setDoc({ name: file.name, bytes }));
  };

  const ext = fmt === "image/png" ? "png" : "jpg";

  const run = async () => {
    if (!doc) return;
    setBusy(true);
    setProgress(0);
    setNote(null);
    clearResults();
    const pdfjsDoc = await openPdfjsDoc(doc.bytes).catch((e) => {
      setNote({ kind: "err", msg: `Couldn't read PDF: ${(e as Error).message}` });
      return null;
    });
    if (!pdfjsDoc) {
      setBusy(false);
      return;
    }
    try {
      const total = pdfjsDoc.numPages;
      const out: Result[] = [];
      for (let i = 1; i <= total; i++) {
        const r = await renderPageToBlob(pdfjsDoc, i, {
          scale: SCALES[quality],
          type: fmt as ImageType,
          quality: fmt === "image/jpeg" ? 0.92 : undefined,
        });
        out.push({ page: i, blob: r.blob, url: URL.createObjectURL(r.blob) });
        setProgress(i / total);
      }
      setResults(out);
      setNote({ kind: "ok", msg: `Rendered ${total} page${total === 1 ? "" : "s"} as ${ext.toUpperCase()}.` });
    } catch (e) {
      setNote({ kind: "err", msg: `Render failed: ${(e as Error).message}` });
    } finally {
      pdfjsDoc.destroy();
      setBusy(false);
    }
  };

  const downloadAll = async () => {
    if (!doc || results.length === 0) return;
    const stem = baseName(doc.name);
    const zip = new JSZip();
    results.forEach((r) => {
      const n = String(r.page).padStart(String(results.length).length, "0");
      zip.file(`${stem}-p${n}.${ext}`, r.blob);
    });
    const blob = await zip.generateAsync({ type: "blob" });
    downloadBlob(blob, `${stem}-images.zip`);
  };

  const stem = doc ? baseName(doc.name) : "page";

  if (!doc) {
    return (
      <FileDrop
        accept="application/pdf"
        multiple={false}
        onFiles={load}
        icon="pdf2img"
        title={<>Drop a PDF or <span className="em">browse</span></>}
        sub="Each page becomes a separate image, rendered on your device."
      />
    );
  }

  return (
    <div className="stack" style={{ gap: "var(--s-5)" }}>
      <div className="panel">
        <div className="panel-title with-sub">{doc.name}</div>
        <div className="panel-sub">Rendered in your browser via pdf.js</div>
        <div className="field-row">
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Format</label>
            <Segmented
              value={fmt}
              onChange={setFmt}
              options={[
                { value: "image/jpeg", label: "JPG" },
                { value: "image/png", label: "PNG" },
              ]}
            />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Quality</label>
            <Segmented
              value={quality}
              onChange={setQuality}
              options={[
                { value: "Screen", label: "Screen" },
                { value: "Print", label: "Print" },
                { value: "Hi", label: "Hi-res" },
              ]}
            />
          </div>
        </div>
      </div>

      {busy && <ProgressBar value={progress} label="Rendering pages" />}

      <div className="run-bar">
        <RunButton onClick={run} busy={busy} icon="pdf2img">
          Render pages
        </RunButton>
        {results.length > 0 && !busy && (
          <button type="button" className="btn btn-secondary" onClick={downloadAll}>
            <Icon name="download" size={16} /> Download all (.zip)
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={() => { setDoc(null); clearResults(); }} disabled={busy}>
          Choose another
        </button>
      </div>

      {note && (
        <Banner kind={note.kind === "ok" ? "success" : "error"} title={note.kind === "ok" ? "Done" : "Couldn't render"}>
          {note.msg}
        </Banner>
      )}

      {results.length > 0 && (
        <div className="result-grid">
          {results.map((r) => (
            <div className="result-card" key={r.page}>
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img
                src={r.url}
                alt={`Page ${r.page}`}
                style={{ display: "block", width: "100%", aspectRatio: "1 / 1.3", objectFit: "contain", background: "#fff" }}
              />
              <div className="result-foot">
                <span className="file-name">{`${stem}-p${r.page}.${ext}`}</span>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => downloadBlob(r.blob, `${stem}-p${r.page}.${ext}`)}
                  aria-label="Download"
                >
                  <Icon name="download" size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
