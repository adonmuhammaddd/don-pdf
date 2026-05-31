"use client";

import { useState } from "react";
import { degrees, PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { FileDrop, RunButton } from "@/components/pdfui";
import { Segmented, TerminalWindow } from "@/components/ui";
import { baseName, downloadBlob, hexToRgb, parsePageRange } from "@/lib/pdf";

interface Loaded {
  name: string;
  bytes: ArrayBuffer;
  pages: number;
}
type Mode = "center" | "tiled";

export default function WatermarkTool() {
  const [doc, setDoc] = useState<Loaded | null>(null);
  const [text, setText] = useState("CONFIDENTIAL");
  const [size, setSize] = useState(48);
  const [opacity, setOpacity] = useState(20); // percent
  const [rotation, setRotation] = useState(45);
  const [color, setColor] = useState("#888888");
  const [mode, setMode] = useState<Mode>("center");
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
    if (!text.trim()) {
      setNote({ kind: "err", msg: "Enter watermark text." });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const pdf = await PDFDocument.load(doc.bytes, { ignoreEncryption: true });
      const font = await pdf.embedFont(StandardFonts.HelveticaBold);
      const { r, g, b } = hexToRgb(color);
      const op = Math.max(0, Math.min(1, opacity / 100));
      const rad = (rotation * Math.PI) / 180;
      const indices = allPages ? pdf.getPageIndices() : parsePageRange(range, doc.pages);
      const pages = pdf.getPages();
      const tw = font.widthOfTextAtSize(text, size);

      for (const idx of indices) {
        const page = pages[idx];
        const { width, height } = page.getSize();
        const common = { size, font, color: rgb(r, g, b), opacity: op, rotate: degrees(rotation) };
        if (mode === "center") {
          page.drawText(text, {
            ...common,
            x: width / 2 - (tw / 2) * Math.cos(rad),
            y: height / 2 - (tw / 2) * Math.sin(rad),
          });
        } else {
          const stepX = Math.max(160, tw * 0.8 + 80);
          const stepY = 150;
          for (let y = 0; y < height + stepY; y += stepY) {
            for (let x = -tw; x < width + stepX; x += stepX) {
              page.drawText(text, { ...common, x, y });
            }
          }
        }
      }
      const out = await pdf.save();
      const stem = baseName(doc.name);
      downloadBlob(out, `${stem}-watermarked.pdf`);
      setNote({ kind: "ok", msg: `Watermarked ${indices.length} page${indices.length === 1 ? "" : "s"} → ${stem}-watermarked.pdf` });
    } catch (e) {
      setNote({ kind: "err", msg: `Failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <TerminalWindow title={<><b>watermark</b> — source PDF</>} glow>
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
            <label className="opt" style={{ flex: "1 1 220px" }}>
              <span>text</span>
              <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="CONFIDENTIAL" />
            </label>
            <label className="opt">
              <span>layout</span>
              <Segmented
                value={mode}
                onChange={setMode}
                options={[
                  { value: "center", label: "Center" },
                  { value: "tiled", label: "Tiled" },
                ]}
              />
            </label>
          </div>

          <div className="opt-row">
            <label className="opt">
              <span>font size</span>
              <input type="number" min={8} max={160} value={size} onChange={(e) => setSize(Number(e.target.value))} />
            </label>
            <label className="opt">
              <span>opacity %</span>
              <input type="number" min={1} max={100} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
            </label>
            <label className="opt">
              <span>rotation°</span>
              <input type="number" min={-90} max={90} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} />
            </label>
            <label className="opt">
              <span>color</span>
              <input type="text" value={color} onChange={(e) => setColor(e.target.value)} placeholder="#888888" />
            </label>
            <label className="opt">
              <span>apply to</span>
              <Segmented
                value={allPages ? "all" : "range"}
                onChange={(v) => setAllPages(v === "all")}
                options={[
                  { value: "all", label: "All" },
                  { value: "range", label: "Range" },
                ]}
              />
            </label>
            {!allPages && (
              <label className="opt">
                <span>pages</span>
                <input type="text" value={range} onChange={(e) => setRange(e.target.value)} placeholder="e.g. 1-3" />
              </label>
            )}
          </div>

          <div className="pdf-actions">
            <RunButton onClick={run} busy={busy}>Apply watermark</RunButton>
            <button type="button" className="btn" onClick={() => setDoc(null)} disabled={busy}>Clear</button>
          </div>
        </>
      )}

      {note && <div className={`pdf-note ${note.kind}`}>{note.msg}</div>}
    </div>
  );
}
