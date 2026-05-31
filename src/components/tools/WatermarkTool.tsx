"use client";

import { useState } from "react";
import { degrees, PDFDocument, StandardFonts, rgb, type PDFImage } from "pdf-lib";
import { FileDrop, RunButton } from "@/components/pdfui";
import { Banner, RangeField, Segmented } from "@/components/ui";
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
  const [size, setSize] = useState(48);
  const [imgScale, setImgScale] = useState(40);
  const [opacity, setOpacity] = useState(20);
  const [rotation, setRotation] = useState(45);
  const [color, setColor] = useState("#888888");
  const [mode, setMode] = useState<Mode>("center");
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
      const indices = target === "all" ? pdf.getPageIndices() : parsePageRange(range, doc.pages);
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
          const { r, g, b } = hexToRgb(color);
          const common = { size, font, color: rgb(r, g, b), opacity: op, rotate: degrees(rotation) };
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

  if (!doc) {
    return (
      <FileDrop
        accept="application/pdf"
        multiple={false}
        onFiles={load}
        icon="watermark"
        title={<>Drop a PDF or <span className="em">browse</span></>}
        sub="Stamp text or an image across the pages."
      />
    );
  }

  return (
    <div className="stack" style={{ gap: "var(--s-5)" }}>
      <div className="panel">
        <div className="panel-title with-sub">{doc.name}</div>
        <div className="panel-sub">{doc.pages} pages loaded</div>

        <div className="field-row">
          <div className="field">
            <label>Watermark</label>
            <Segmented
              value={source}
              onChange={setSource}
              options={[
                { value: "text", label: "Text" },
                { value: "image", label: "Image" },
              ]}
            />
          </div>
          <div className="field">
            <label>Layout</label>
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: "center", label: "Center" },
                { value: "tiled", label: "Tiled" },
              ]}
            />
          </div>
        </div>

        {source === "text" ? (
          <>
            <div className="field">
              <label>Text</label>
              <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="CONFIDENTIAL" />
            </div>
            <div className="field-row">
              <div className="field">
                <label>Font size</label>
                <input className="input" type="number" min={8} max={160} value={size} onChange={(e) => setSize(Number(e.target.value))} />
              </div>
              <div className="field">
                <label>Color</label>
                <div className="color-row">
                  <input type="color" className="color-swatch" value={color} onChange={(e) => setColor(e.target.value)} aria-label="Watermark color" />
                  <input className="input mono" style={{ flex: 1 }} value={color} onChange={(e) => setColor(e.target.value)} />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="field">
            <label>Watermark image</label>
            {!img ? (
              <FileDrop accept="image/png,image/jpeg" multiple={false} onFiles={loadImage} compact icon="image" title="Drop a PNG / JPG" sub="PNG with transparency works best." />
            ) : (
              <div className="row spread" style={{ gap: 12 }}>
                <span className="file-name" style={{ flex: 1 }}>{img.name}</span>
                <button type="button" className="btn btn-ghost" onClick={() => setImg(null)}>Change</button>
              </div>
            )}
            <div className="field-row" style={{ marginTop: "var(--s-4)" }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <label>Size (% of width)</label>
                <RangeField value={imgScale} min={5} max={100} onChange={setImgScale} fmt={(v) => `${v}%`} />
              </div>
            </div>
          </div>
        )}

        <div className="field-row">
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Opacity</label>
            <RangeField value={opacity} min={1} max={100} onChange={setOpacity} fmt={(v) => `${v}%`} />
          </div>
          <div className="field" style={{ marginBottom: 0 }}>
            <label>Rotation</label>
            <RangeField value={rotation} min={-90} max={90} onChange={setRotation} fmt={(v) => `${v}°`} />
          </div>
        </div>

        <div className="field" style={{ marginTop: "var(--s-4)", marginBottom: 0 }}>
          <label>Apply to</label>
          <Segmented
            value={target}
            onChange={setTarget}
            options={[
              { value: "all", label: "All pages" },
              { value: "range", label: "Range" },
            ]}
          />
          {target === "range" && (
            <input className="input mono" style={{ marginTop: 8 }} value={range} onChange={(e) => setRange(e.target.value)} placeholder="e.g. 1-3" />
          )}
        </div>
      </div>

      <div className="run-bar">
        <RunButton onClick={run} busy={busy} icon="watermark">
          Apply watermark
        </RunButton>
        <button type="button" className="btn btn-ghost" onClick={() => setDoc(null)} disabled={busy}>
          Choose another
        </button>
      </div>

      {note && (
        <Banner kind={note.kind === "ok" ? "success" : "error"} title={note.kind === "ok" ? "Done" : "Couldn't watermark"}>
          {note.msg}
        </Banner>
      )}
    </div>
  );
}
