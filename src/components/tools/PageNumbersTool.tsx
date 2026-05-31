"use client";

import { useState } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { FileDrop, RunButton } from "@/components/pdfui";
import { Segmented, TerminalWindow } from "@/components/ui";
import { baseName, downloadBlob, parsePageRange } from "@/lib/pdf";

interface Loaded {
  name: string;
  bytes: ArrayBuffer;
  pages: number;
}
type Pos = "bl" | "bc" | "br" | "tl" | "tc" | "tr";
const FORMATS: { value: string; label: string }[] = [
  { value: "{n}", label: "1" },
  { value: "{n} / {total}", label: "1 / N" },
  { value: "Page {n}", label: "Page 1" },
  { value: "Page {n} of {total}", label: "Page 1 of N" },
];

export default function PageNumbersTool() {
  const [doc, setDoc] = useState<Loaded | null>(null);
  const [pos, setPos] = useState<Pos>("bc");
  const [format, setFormat] = useState(FORMATS[0].value);
  const [start, setStart] = useState(1);
  const [size, setSize] = useState(11);
  const [margin, setMargin] = useState(36);
  const [allPages, setAllPages] = useState(true);
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
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const indices = allPages ? pdf.getPageIndices() : parsePageRange(range, doc.pages);
      const total = indices.length;
      const pages = pdf.getPages();
      indices.forEach((idx, k) => {
        const page = pages[idx];
        const { width, height } = page.getSize();
        const text = format
          .replaceAll("{n}", String(start + k))
          .replaceAll("{total}", String(start + total - 1));
        const tw = font.widthOfTextAtSize(text, size);
        const top = pos[0] === "t";
        const col = pos[1];
        const x = col === "l" ? margin : col === "r" ? width - margin - tw : (width - tw) / 2;
        const y = top ? height - margin - size : margin;
        page.drawText(text, { x, y, size, font, color: rgb(0.2, 0.2, 0.2) });
      });
      const out = await pdf.save();
      const stem = baseName(doc.name);
      downloadBlob(out, `${stem}-numbered.pdf`);
      setNote({ kind: "ok", msg: `Numbered ${total} page${total === 1 ? "" : "s"} → ${stem}-numbered.pdf` });
    } catch (e) {
      setNote({ kind: "err", msg: `Failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <TerminalWindow title={<><b>page numbers</b> — source PDF</>} glow>
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
              <span>position</span>
              <select value={pos} onChange={(e) => setPos(e.target.value as Pos)}>
                <option value="bc">Bottom center</option>
                <option value="br">Bottom right</option>
                <option value="bl">Bottom left</option>
                <option value="tc">Top center</option>
                <option value="tr">Top right</option>
                <option value="tl">Top left</option>
              </select>
            </label>
            <label className="opt">
              <span>format</span>
              <select value={format} onChange={(e) => setFormat(e.target.value)}>
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </label>
            <label className="opt">
              <span>start at</span>
              <input type="number" min={0} value={start} onChange={(e) => setStart(Number(e.target.value))} />
            </label>
            <label className="opt">
              <span>font size</span>
              <input type="number" min={6} max={48} value={size} onChange={(e) => setSize(Number(e.target.value))} />
            </label>
            <label className="opt">
              <span>margin</span>
              <input type="number" min={0} max={120} value={margin} onChange={(e) => setMargin(Number(e.target.value))} />
            </label>
          </div>

          <div className="opt-row">
            <label className="opt">
              <span>apply to</span>
              <Segmented
                value={allPages ? "all" : "range"}
                onChange={(v) => setAllPages(v === "all")}
                options={[
                  { value: "all", label: "All pages" },
                  { value: "range", label: "Range" },
                ]}
              />
            </label>
            {!allPages && (
              <label className="opt">
                <span>pages</span>
                <input type="text" value={range} onChange={(e) => setRange(e.target.value)} placeholder="e.g. 2-10" />
              </label>
            )}
          </div>

          <div className="pdf-actions">
            <RunButton onClick={run} busy={busy}>Add page numbers</RunButton>
            <button type="button" className="btn" onClick={() => setDoc(null)} disabled={busy}>Clear</button>
          </div>
        </>
      )}

      {note && <div className={`pdf-note ${note.kind}`}>{note.msg}</div>}
    </div>
  );
}
