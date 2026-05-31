"use client";

import { useState } from "react";
import { degrees, PDFDocument } from "pdf-lib";
import { FileDrop, RunButton } from "@/components/pdfui";
import { Banner, Segmented } from "@/components/ui";
import { baseName, downloadBlob, parsePageRange } from "@/lib/pdf";

interface Loaded {
  name: string;
  bytes: ArrayBuffer;
  pages: number;
}
type Angle = "90" | "180" | "270";

export default function RotateTool() {
  const [doc, setDoc] = useState<Loaded | null>(null);
  const [angle, setAngle] = useState<Angle>("90");
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
      setDoc({ name: file.name, bytes, pages: pdf.getPageCount() });
      setRange(`1-${pdf.getPageCount()}`);
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
      const delta = Number(angle);
      const indices = target === "all" ? pdf.getPageIndices() : parsePageRange(range, doc.pages);
      const pages = pdf.getPages();
      for (const i of indices) {
        const current = pages[i].getRotation().angle;
        pages[i].setRotation(degrees((current + delta) % 360));
      }
      const out = await pdf.save();
      const stem = baseName(doc.name);
      downloadBlob(out, `${stem}-rotated.pdf`);
      setNote({ kind: "ok", msg: `Rotated ${indices.length} page${indices.length === 1 ? "" : "s"} by ${delta}° → ${stem}-rotated.pdf` });
    } catch (e) {
      setNote({ kind: "err", msg: `Rotate failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  if (!doc) {
    return (
      <FileDrop
        accept="application/pdf"
        multiple={false}
        onFiles={load}
        title={<>Drop a PDF or <span className="em">browse</span></>}
        sub="We'll rotate the pages you choose."
        icon="rotate"
      />
    );
  }

  return (
    <div className="stack" style={{ gap: "var(--s-5)" }}>
      <div className="panel">
        <div className="panel-title with-sub">{doc.name}</div>
        <div className="panel-sub">{doc.pages} pages loaded</div>

        <div className="field">
          <label>Rotate clockwise by</label>
          <Segmented
            value={angle}
            onChange={setAngle}
            options={[
              { value: "90", label: "90°" },
              { value: "180", label: "180°" },
              { value: "270", label: "270°" },
            ]}
          />
        </div>
        <div className="field">
          <label>Apply to</label>
          <Segmented
            value={target}
            onChange={setTarget}
            options={[
              { value: "all", label: "All pages" },
              { value: "range", label: "Page range" },
            ]}
          />
        </div>
        {target === "range" && (
          <div className="field">
            <label>Pages</label>
            <input className="input mono" value={range} onChange={(e) => setRange(e.target.value)} placeholder="e.g. 1-3, 5" />
          </div>
        )}
      </div>

      <div className="run-bar">
        <RunButton onClick={run} busy={busy} icon="rotate">
          Rotate &amp; download
        </RunButton>
        <button type="button" className="btn btn-ghost" onClick={() => setDoc(null)} disabled={busy}>
          Choose another
        </button>
      </div>

      {note && (
        <Banner kind={note.kind === "ok" ? "success" : "error"} title={note.kind === "ok" ? "Done" : "Couldn't rotate"}>
          {note.msg}
        </Banner>
      )}
    </div>
  );
}
