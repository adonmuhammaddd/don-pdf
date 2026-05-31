"use client";

import { useState } from "react";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { FileDrop, ProgressBar, RunButton } from "@/components/pdfui";
import { Segmented, TerminalWindow } from "@/components/ui";
import { baseName, downloadBlob, parsePageRange } from "@/lib/pdf";

type Mode = "range" | "single" | "chunk";

interface Loaded {
  name: string;
  bytes: ArrayBuffer;
  pages: number;
}

export default function SplitTool() {
  const [doc, setDoc] = useState<Loaded | null>(null);
  const [mode, setMode] = useState<Mode>("range");
  const [range, setRange] = useState("");
  const [chunk, setChunk] = useState(1);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
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
    setProgress(0);
    setNote(null);
    try {
      const src = await PDFDocument.load(doc.bytes, { ignoreEncryption: true });
      const stem = baseName(doc.name);

      if (mode === "range") {
        const indices = parsePageRange(range, doc.pages);
        const out = await PDFDocument.create();
        const copied = await out.copyPages(src, indices);
        copied.forEach((p) => out.addPage(p));
        const bytes = await out.save();
        downloadBlob(bytes, `${stem}-extract.pdf`);
        setNote({ kind: "ok", msg: `Extracted ${indices.length} pages → ${stem}-extract.pdf` });
      } else {
        // Build groups of page indices.
        const groups: number[][] = [];
        const size = mode === "single" ? 1 : Math.max(1, chunk);
        for (let i = 0; i < doc.pages; i += size) {
          groups.push(Array.from({ length: Math.min(size, doc.pages - i) }, (_, k) => i + k));
        }
        const zip = new JSZip();
        for (let g = 0; g < groups.length; g++) {
          const out = await PDFDocument.create();
          const copied = await out.copyPages(src, groups[g]);
          copied.forEach((p) => out.addPage(p));
          const bytes = await out.save();
          const first = groups[g][0] + 1;
          const last = groups[g][groups[g].length - 1] + 1;
          const label = first === last ? `p${first}` : `p${first}-${last}`;
          zip.file(`${stem}-${label}.pdf`, bytes);
          setProgress((g + 1) / groups.length);
        }
        const blob = await zip.generateAsync({ type: "blob" });
        downloadBlob(blob, `${stem}-split.zip`);
        setNote({ kind: "ok", msg: `Split into ${groups.length} files → ${stem}-split.zip` });
      }
    } catch (e) {
      setNote({ kind: "err", msg: `Split failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <TerminalWindow title={<><b>split</b> — source PDF</>} glow>
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
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: "range", label: "Extract range" },
                { value: "single", label: "Each page" },
                { value: "chunk", label: "Every N pages" },
              ]}
            />
            {mode === "range" && (
              <label className="opt">
                <span>pages</span>
                <input
                  type="text"
                  value={range}
                  onChange={(e) => setRange(e.target.value)}
                  placeholder="e.g. 1-3, 5, 8-10"
                />
              </label>
            )}
            {mode === "chunk" && (
              <label className="opt">
                <span>pages per file</span>
                <input
                  type="number"
                  min={1}
                  max={doc.pages}
                  value={chunk}
                  onChange={(e) => setChunk(Math.max(1, Number(e.target.value)))}
                />
              </label>
            )}
          </div>

          <div className="pdf-actions">
            <RunButton onClick={run} busy={busy}>
              {mode === "range" ? "Extract pages" : "Split & download .zip"}
            </RunButton>
            <button type="button" className="btn" onClick={() => setDoc(null)} disabled={busy}>
              Clear
            </button>
          </div>

          {busy && mode !== "range" && <ProgressBar value={progress} />}
        </>
      )}

      {note && <div className={`pdf-note ${note.kind}`}>{note.msg}</div>}
    </div>
  );
}
