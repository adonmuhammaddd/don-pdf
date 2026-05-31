"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as RPointerEvent,
} from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { FileDrop, ProgressBar, RunButton } from "@/components/pdfui";
import { Icon, TerminalWindow } from "@/components/ui";
import { baseName, downloadBlob, hexToRgb, openPdfjsDoc, renderPageToBlob } from "@/lib/pdf";

interface RPage {
  url: string;
  ptW: number;
  ptH: number;
}
type AnnType = "text" | "sig";
interface Ann {
  id: string;
  page: number; // 0-based
  type: AnnType;
  xFrac: number; // top-left, fraction of page box
  yFrac: number;
  // text
  text?: string;
  fsFrac?: number; // font size as fraction of page height
  color?: string;
  // signature
  img?: string; // dataURL (png)
  wFrac?: number; // width as fraction of page width
  aspect?: number; // h/w of the image
}

const uid = () => Math.random().toString(36).slice(2);

export default function FillSignTool() {
  const [name, setName] = useState("");
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [pages, setPages] = useState<RPage[]>([]);
  const [cur, setCur] = useState(0);
  const [anns, setAnns] = useState<Ann[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [padOpen, setPadOpen] = useState(false);
  const [lastSig, setLastSig] = useState<{ img: string; aspect: number } | null>(null);
  const [note, setNote] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const pageBoxRef = useRef<HTMLDivElement>(null);
  // {id, startX, startY, ox, oy, w, h, mode}
  const dragRef = useRef<null | {
    id: string;
    startX: number;
    startY: number;
    ox: number;
    oy: number;
    w: number;
    h: number;
    mode: "move" | "resize";
  }>(null);

  const load = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setNote(null);
    setLoading(true);
    setProgress(0);
    try {
      const buf = await file.arrayBuffer();
      const doc = await openPdfjsDoc(buf);
      const total = doc.numPages;
      const out: RPage[] = [];
      for (let i = 1; i <= total; i++) {
        const r = await renderPageToBlob(doc, i, { scale: 1.6, type: "image/jpeg", quality: 0.85 });
        out.push({ url: URL.createObjectURL(r.blob), ptW: r.width / 1.6, ptH: r.height / 1.6 });
        setProgress(i / total);
      }
      doc.destroy();
      setName(file.name);
      setBytes(buf);
      setPages(out);
      setCur(0);
      setAnns([]);
    } catch (e) {
      setNote({ kind: "err", msg: `Couldn't read PDF: ${(e as Error).message}` });
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    pages.forEach((p) => URL.revokeObjectURL(p.url));
    setPages([]);
    setBytes(null);
    setAnns([]);
    setSelected(null);
    setName("");
    setNote(null);
  };

  const update = useCallback((id: string, patch: Partial<Ann>) => {
    setAnns((p) => p.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }, []);
  const removeAnn = (id: string) => {
    setAnns((p) => p.filter((a) => a.id !== id));
    setSelected((s) => (s === id ? null : s));
  };

  const addText = (value: string) => {
    const a: Ann = {
      id: uid(), page: cur, type: "text", xFrac: 0.1, yFrac: 0.1,
      text: value, fsFrac: 0.025, color: "#1a1a1a",
    };
    setAnns((p) => [...p, a]);
    setSelected(a.id);
  };
  const addSignature = (img: string, aspect: number) => {
    const a: Ann = {
      id: uid(), page: cur, type: "sig", xFrac: 0.1, yFrac: 0.7,
      img, aspect, wFrac: 0.3,
    };
    setAnns((p) => [...p, a]);
    setSelected(a.id);
    setLastSig({ img, aspect });
  };

  // ---- drag / resize ----
  const onPointerDown = (e: RPointerEvent, ann: Ann, mode: "move" | "resize") => {
    e.preventDefault();
    e.stopPropagation();
    const box = pageBoxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    dragRef.current = {
      id: ann.id, startX: e.clientX, startY: e.clientY,
      ox: mode === "resize" ? ann.wFrac ?? 0.3 : ann.xFrac,
      oy: ann.yFrac, w: rect.width, h: rect.height, mode,
    };
    setSelected(ann.id);
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      if (d.mode === "move") {
        const nx = Math.max(0, Math.min(0.99, d.ox + (e.clientX - d.startX) / d.w));
        const ny = Math.max(0, Math.min(0.99, d.oy + (e.clientY - d.startY) / d.h));
        update(d.id, { xFrac: nx, yFrac: ny });
      } else {
        const nw = Math.max(0.05, Math.min(1, d.ox + (e.clientX - d.startX) / d.w));
        update(d.id, { wFrac: nw });
      }
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [update]);

  // ---- export ----
  const run = async () => {
    if (!bytes) return;
    if (anns.length === 0) {
      setNote({ kind: "err", msg: "Add some text or a signature first." });
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const font = await pdf.embedFont(StandardFonts.Helvetica);
      const docPages = pdf.getPages();
      // Cache embedded signature images by dataURL.
      const sigCache = new Map<string, Awaited<ReturnType<typeof pdf.embedPng>>>();
      for (const a of anns) {
        const page = docPages[a.page];
        if (!page) continue;
        const { width: ptW, height: ptH } = page.getSize();
        if (a.type === "text") {
          const size = (a.fsFrac ?? 0.025) * ptH;
          const { r, g, b } = hexToRgb(a.color ?? "#1a1a1a");
          const lines = (a.text ?? "").replace(/\r/g, "").split("\n");
          lines.forEach((line, li) => {
            page.drawText(line, {
              x: a.xFrac * ptW,
              y: ptH * (1 - a.yFrac) - size * (li + 1),
              size, font, color: rgb(r, g, b),
            });
          });
        } else if (a.type === "sig" && a.img) {
          let png = sigCache.get(a.img);
          if (!png) {
            const buf = await (await fetch(a.img)).arrayBuffer();
            png = await pdf.embedPng(buf);
            sigCache.set(a.img, png);
          }
          const w = (a.wFrac ?? 0.3) * ptW;
          const h = w * (a.aspect ?? 0.4);
          page.drawImage(png, { x: a.xFrac * ptW, y: ptH * (1 - a.yFrac) - h, width: w, height: h });
        }
      }
      const result = await pdf.save();
      const stem = baseName(name);
      downloadBlob(result, `${stem}-signed.pdf`);
      setNote({ kind: "ok", msg: `Stamped ${anns.length} item${anns.length === 1 ? "" : "s"} → ${stem}-signed.pdf` });
    } catch (e) {
      setNote({ kind: "err", msg: `Export failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  const sel = anns.find((a) => a.id === selected) ?? null;
  const today = new Date().toLocaleDateString();

  return (
    <div>
      {pages.length === 0 && (
        <TerminalWindow title={<><b>fill &amp; sign</b> — source PDF</>} glow>
          <FileDrop
            accept="application/pdf"
            multiple={false}
            onFiles={load}
            label={loading ? "Rendering pages…" : "Drop a PDF here"}
            hint={loading ? undefined : "add text & a signature, drag to place — nothing is uploaded"}
          />
          {loading && <ProgressBar value={progress} label="loading" />}
        </TerminalWindow>
      )}

      {pages.length > 0 && (
        <>
          <div className="fs-toolbar">
            <button type="button" className="btn" onClick={() => addText("Text")}>+ Text</button>
            <button type="button" className="btn" onClick={() => addText(today)}>+ Date</button>
            <button
              type="button"
              className="btn"
              onClick={() => (lastSig ? addSignature(lastSig.img, lastSig.aspect) : setPadOpen(true))}
            >
              ✎ Signature
            </button>
            {lastSig && (
              <button type="button" className="btn" onClick={() => setPadOpen(true)}>Draw new</button>
            )}
            <span className="spacer" />
            {sel?.type === "text" && (
              <span className="fs-textctl">
                <input
                  type="range" min={12} max={60} step={1}
                  value={Math.round((sel.fsFrac ?? 0.025) * 1000)}
                  onChange={(e) => update(sel.id, { fsFrac: Number(e.target.value) / 1000 })}
                  title="Font size"
                />
                <input
                  type="text" value={sel.color ?? "#1a1a1a"}
                  onChange={(e) => update(sel.id, { color: e.target.value })}
                  style={{ width: 78 }} title="Color"
                />
              </span>
            )}
          </div>

          <div className="pdf-actions" style={{ marginTop: "var(--s3)" }}>
            <RunButton onClick={run} busy={busy}>Apply &amp; download</RunButton>
            <button type="button" className="btn" onClick={reset} disabled={busy}>Load another</button>
            <span className="fs-pager">
              <button type="button" onClick={() => setCur((c) => Math.max(0, c - 1))} disabled={cur === 0}>←</button>
              page {cur + 1} / {pages.length}
              <button type="button" onClick={() => setCur((c) => Math.min(pages.length - 1, c + 1))} disabled={cur === pages.length - 1}>→</button>
            </span>
          </div>

          <div className="fs-stage" onMouseDown={() => setSelected(null)}>
            <div
              className="fs-page"
              ref={pageBoxRef}
              style={{ aspectRatio: `${pages[cur].ptW} / ${pages[cur].ptH}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
              <img src={pages[cur].url} alt={`Page ${cur + 1}`} draggable={false} />
              {anns.filter((a) => a.page === cur).map((a) => {
                const style: CSSProperties = { left: `${a.xFrac * 100}%`, top: `${a.yFrac * 100}%` };
                const isSel = a.id === selected;
                return (
                  <div
                    key={a.id}
                    className={`fs-ann${isSel ? " sel" : ""}`}
                    style={style}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <div className="fs-grip" onPointerDown={(e) => onPointerDown(e, a, "move")} title="Drag to move">⠿</div>
                    <button className="fs-del" type="button" onClick={() => removeAnn(a.id)} title="Remove">×</button>
                    {a.type === "text" ? (
                      <div
                        className="fs-text"
                        style={{ fontSize: `${(a.fsFrac ?? 0.025) * 100}cqh`, color: a.color }}
                        contentEditable
                        suppressContentEditableWarning
                        onFocus={() => setSelected(a.id)}
                        onBlur={(e) => update(a.id, { text: e.currentTarget.innerText })}
                      >
                        {a.text}
                      </div>
                    ) : (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element -- local dataURL signature */}
                        <img className="fs-sig" style={{ width: `${(a.wFrac ?? 0.3) * 100}cqw` }} src={a.img} alt="signature" draggable={false} />
                        <div className="fs-resize" onPointerDown={(e) => onPointerDown(e, a, "resize")} title="Drag to resize" />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {note && <div className={`pdf-note ${note.kind}`}>{note.msg}</div>}

      {padOpen && (
        <SignaturePad
          onCancel={() => setPadOpen(false)}
          onSave={(img, aspect) => { setPadOpen(false); addSignature(img, aspect); }}
        />
      )}
    </div>
  );
}

/* ---------------- Signature pad modal ---------------- */
function SignaturePad({
  onSave,
  onCancel,
}: {
  onSave: (img: string, aspect: number) => void;
  onCancel: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const dirty = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const ctx = () => canvasRef.current?.getContext("2d") ?? null;
  const pos = (e: RPointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const down = (e: RPointerEvent) => {
    drawing.current = true;
    dirty.current = true;
    last.current = pos(e);
  };
  const move = (e: RPointerEvent) => {
    if (!drawing.current) return;
    const c = ctx();
    if (!c || !last.current) return;
    const p = pos(e);
    c.strokeStyle = "#16140f";
    c.lineWidth = 2.6;
    c.lineCap = "round";
    c.lineJoin = "round";
    c.beginPath();
    c.moveTo(last.current.x, last.current.y);
    c.lineTo(p.x, p.y);
    c.stroke();
    last.current = p;
  };
  const up = () => { drawing.current = false; last.current = null; };
  const clear = () => {
    const c = ctx();
    if (c && canvasRef.current) c.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    dirty.current = false;
  };
  const save = () => {
    const c = canvasRef.current;
    if (!c || !dirty.current) return;
    onSave(c.toDataURL("image/png"), c.height / c.width);
  };

  return (
    <div className="sigpad-back" onMouseDown={onCancel}>
      <div className="sigpad" onMouseDown={(e) => e.stopPropagation()}>
        <div className="sigpad-head">
          <span>Draw your signature</span>
          <button type="button" className="fs-del" onClick={onCancel}><Icon name="x" size={14} /></button>
        </div>
        <canvas
          ref={canvasRef}
          className="sigpad-canvas"
          width={560}
          height={220}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
        />
        <div className="sigpad-actions">
          <button type="button" className="btn" onClick={clear}>Clear</button>
          <button type="button" className="btn primary" onClick={save}>Use signature</button>
        </div>
      </div>
    </div>
  );
}
