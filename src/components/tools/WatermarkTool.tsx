"use client";

import { useState } from "react";
import { degrees, PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";
import { FileDrop, RunButton } from "@/components/pdfui";
import { Segmented, TerminalWindow } from "@/components/ui";
import { baseName, downloadBlob, hexToRgb, parsePageRange } from "@/lib/pdf";

interface Loaded {
  name: string;
  bytes: ArrayBuffer;
  pages: number;
}
type Mode = "center" | "tiled";
type Source = "text" | "image";
interface WImage {
  name: string;
  bytes: ArrayBuffer;
  isPng: boolean;
}

export default function WatermarkTool() {
  const [doc, setDoc] = useState<Loaded | null>(null);
  const [source, setSource] = useState<Source>("text");
  const [text, setText] = useState("CONFIDENTIAL");
  const [img, setImg] = useState<WImage | null>(null);
  const [size, setSize] = useState(48); // text: font pt · image: % of page width
  const [imgScale, setImgScale] = useState(40); // % of page width
  const [opacity, setOpacity] = useState(20);
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

  const loadImage = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    const isPng = file.type === "image/png" || /\.png$/i.test(file.name);
    setImg({ name: file.name, bytes: await file.arrayBuffer(), isPng });
  };

  const run = async () => {
    if (!doc) return;
    if (source === "text" && !text.trim()) {
      setNote({ kind: "err", msg: "Enter watermark text." });
      return;
    }
    if (source === "image" && !img) {
      setNote({ kind: "err", msg: "Add a watermark image (PNG / JPG)." });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const pdf = await PDFDocument.load(doc.bytes, { ignoreEncryption: true });
      const op = Math.max(0, Math.min(1, opacity / 100));
      const rad = (rotation * Math.PI) / 180;
      const indices = allPages ? pdf.getPageIndices() : parsePageRange(range, doc.pages);
      const pages = pdf.getPages();

      let font: Awaited<ReturnType<typeof pdf.embedFont>> | null = null;
      let stamp: PDFImage | null = null;
      let textW = 0;
      if (source === "text") {
        font = await pdf.embedFont(StandardFonts.HelveticaBold);
        textW = font.widthOfTextAtSize(text, size);
      } else {
        stamp = img!.isPng ? await pdf.embedPng(img!.bytes) : await pdf.embedJpg(img!.bytes);
      }

      for (const idx of indices) {
        const page = pages[idx];
        const { width, height } = page.getSize();

        if (source === "text" && font) {
          const common = { size, font, color: (() => { const { r, g, b } = hexToRgb(color); return rgb(r, g, b); })(), opacity: op, rotate: degrees(rotation) };
          if (mode === "center") {
            page.drawText(text, { ...common, x: width / 2 - (textW / 2) * Math.cos(rad), y: height / 2 - (textW / 2) * Math.sin(rad) });
          } else {
            const stepX = Math.max(160, textW * 0.8 + 80);
            const stepY = 150;
            for (let y = 0; y < height + stepY; y += stepY)
              for (let x = -textW; x < width + stepX; x += stepX) page.drawText(text, { ...common, x, y });
          }
        } else if (stamp) {
          const w = (imgScale / 100) * width;
          const h = w * (stamp.height / stamp.width);
          const common = { width: w, height: h, opacity: op, rotate: degrees(rotation) };
          if (mode === "center") {
            // Position so the image's centre lands on the page centre after rotation.
            page.drawImage(stamp, {
              ...common,
              x: width / 2 - (w / 2) * Math.cos(rad) + (h / 2) * Math.sin(rad),
              y: height / 2 - (w / 2) * Math.sin(rad) - (h / 2) * Math.cos(rad),
            });
          } else {
            const stepX = w + 60;
            const stepY = h + 60;
            for (let y = 0; y < height + stepY; y += stepY)
              for (let x = 0; x < width + stepX; x += stepX) page.drawImage(stamp, { ...common, x, y });
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
            <label className="opt">
              <span>watermark</span>
              <Segmented
                value={source}
                onChange={setSource}
                options={[
                  { value: "text", label: "Text" },
                  { value: "image", label: "Image" },
                ]}
              />
            </label>
            {source === "text" ? (
              <label className="opt" style={{ flex: "1 1 200px" }}>
                <span>text</span>
                <input type="text" value={text} onChange={(e) => setText(e.target.value)} placeholder="CONFIDENTIAL" />
              </label>
            ) : (
              <label className="opt">
                <span>font / size</span>
                <input type="number" min={5} max={100} value={imgScale} onChange={(e) => setImgScale(Number(e.target.value))} title="width % of page" />
              </label>
            )}
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

          {source === "image" && (
            <TerminalWindow title={<><b>watermark image</b> — PNG / JPG (PNG recommended for transparency)</>}>
              <FileDrop
                accept="image/png,image/jpeg"
                multiple={false}
                onFiles={loadImage}
                label={img ? img.name : "Drop watermark image"}
                hint={img ? "loaded" : "PNG with transparency works best — nothing is uploaded"}
              />
            </TerminalWindow>
          )}

          <div className="opt-row">
            {source === "text" && (
              <>
                <label className="opt">
                  <span>font size</span>
                  <input type="number" min={8} max={160} value={size} onChange={(e) => setSize(Number(e.target.value))} />
                </label>
                <label className="opt">
                  <span>color</span>
                  <input type="text" value={color} onChange={(e) => setColor(e.target.value)} placeholder="#888888" />
                </label>
              </>
            )}
            <label className="opt">
              <span>opacity %</span>
              <input type="number" min={1} max={100} value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} />
            </label>
            <label className="opt">
              <span>rotation°</span>
              <input type="number" min={-90} max={90} value={rotation} onChange={(e) => setRotation(Number(e.target.value))} />
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
