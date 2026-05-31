"use client";

import { useState } from "react";
import { degrees, PDFDocument } from "pdf-lib";
import { FileDrop, RunButton } from "@/components/pdfui";
import { Segmented, TerminalWindow } from "@/components/ui";
import { baseName, downloadBlob, parsePageRange } from "@/lib/pdf";

interface Loaded {
  name: string;
  bytes: ArrayBuffer;
  pages: number;
}
type Angle = "90" | "180" | "270";
type Target = "all" | "range";

export default function RotateTool() {
  const [doc, setDoc] = useState<Loaded | null>(null);
  const [angle, setAngle] = useState<Angle>("90");
  const [target, setTarget] = useState<Target>("all");
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
      const indices =
        target === "all"
          ? pdf.getPageIndices()
          : parsePageRange(range, doc.pages);
      const pages = pdf.getPages();
      for (const i of indices) {
        const current = pages[i].getRotation().angle;
        pages[i].setRotation(degrees((current + delta) % 360));
      }
      const out = await pdf.save();
      const stem = baseName(doc.name);
      downloadBlob(out, `${stem}-rotated.pdf`);
      setNote({
        kind: "ok",
        msg: `Rotated ${indices.length} page${indices.length === 1 ? "" : "s"} by ${delta}° → ${stem}-rotated.pdf`,
      });
    } catch (e) {
      setNote({ kind: "err", msg: `Rotate failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <TerminalWindow title={<><b>rotate</b> — source PDF</>} glow>
        <FileDrop
          accept="application/pdf"
          multiple={false}
          onFiles={load}
          label={doc ? doc.name : "Drop a PDF here"}
          hint={doc ? `${doc.pages} pages loaded` : "single file — nothing is uploaded"}
        />
      </TerminalWindow>

      {doc && (
        <>
          <div className="opt-row">
            <label className="opt">
              <span>rotate clockwise</span>
              <Segmented
                value={angle}
                onChange={setAngle}
                options={[
                  { value: "90", label: "90°" },
                  { value: "180", label: "180°" },
                  { value: "270", label: "270°" },
                ]}
              />
            </label>
            <label className="opt">
              <span>apply to</span>
              <Segmented
                value={target}
                onChange={setTarget}
                options={[
                  { value: "all", label: "All pages" },
                  { value: "range", label: "Range" },
                ]}
              />
            </label>
            {target === "range" && (
              <label className="opt">
                <span>pages</span>
                <input
                  type="text"
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  placeholder="e.g. 1-3, 5"
                />
              </label>
            )}
          </div>

          <div className="pdf-actions">
            <RunButton onClick={run} busy={busy}>
              Rotate &amp; download
            </RunButton>
            <button type="button" className="btn" onClick={() => setDoc(null)} disabled={busy}>
              Clear
            </button>
          </div>
        </>
      )}

      {note && <div className={`pdf-note ${note.kind}`}>{note.msg}</div>}
    </div>
  );
}
