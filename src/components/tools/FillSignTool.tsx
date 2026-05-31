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
import { Banner, Icon, Modal, RangeField, cx } from "@/components/ui";
import { baseName, downloadBlob, hexToRgb, openPdfjsDoc, renderPageToBlob } from "@/lib/pdf";

interface RPage {
  url: string;
  ptW: number;
  ptH: number;
}
type AnnType = "text" | "date" | "sig";
interface Ann {
  id: string;
  page: number;
  type: AnnType;
  xFrac: number;
  yFrac: number;
  text?: string;
  fsFrac?: number;
  color?: string;
  img?: string;
  wFrac?: number;
  aspect?: number;
}

const uid = () => Math.random().toString(36).slice(2);

export default function FillSignTool() {
  const [name, setName] = useState("");
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [pages, setPages] = useState<RPage[]>([]);
  const [cur, setCur] = useState(0);
  const [anns, setAnns] = useState<Ann[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [padOpen, setPadOpen] = useState(false);
  const [lastSig, setLastSig] = useState<{ img: string; aspect: number } | null>(null);
  const [note, setNote] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const pageBoxRef = useRef<HTMLDivElement>(null);
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
    setPages([]);
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

  const addText = (value: string, type: AnnType = "text") => {
    const a: Ann = { id: uid(), page: cur, type, xFrac: 0.12, yFrac: 0.12, text: value, fsFrac: 0.025, color: "#1a1a2e" };
    setAnns((p) => [...p, a]);
    setSelected(a.id);
  };
  const addSignature = (img: string, aspect: number) => {
    const a: Ann = { id: uid(), page: cur, type: "sig", xFrac: 0.12, yFrac: 0.7, img, aspect, wFrac: 0.3 };
    setAnns((p) => [...p, a]);
    setSelected(a.id);
    setLastSig({ img, aspect });
  };

  const onPointerDown = (e: RPointerEvent, ann: Ann, mode: "move" | "resize") => {
    if (editing === ann.id) return;
    e.preventDefault();
    e.stopPropagation();
    const box = pageBoxRef.current;
    if (!box) return;
    const rect = box.getBoundingClientRect();
    dragRef.current = {
      id: ann.id,
      startX: e.clientX,
      startY: e.clientY,
      ox: mode === "resize" ? ann.wFrac ?? 0.3 : ann.xFrac,
      oy: ann.yFrac,
      w: rect.width,
      h: rect.height,
      mode,
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
    const up = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [update]);

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
      const sigCache = new Map<string, Awaited<ReturnType<typeof pdf.embedPng>>>();
      for (const a of anns) {
        const page = docPages[a.page];
        if (!page) continue;
        const { width: ptW, height: ptH } = page.getSize();
        if (a.type === "text" || a.type === "date") {
          const size = (a.fsFrac ?? 0.025) * ptH;
          const { r, g, b } = hexToRgb(a.color ?? "#1a1a2e");
          const lines = (a.text ?? "").replace(/\r/g, "").split("\n");
          lines.forEach((line, li) => {
            page.drawText(line, { x: a.xFrac * ptW, y: ptH * (1 - a.yFrac) - size * (li + 1), size, font, color: rgb(r, g, b) });
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

  if (pages.length === 0) {
    return (
      <div className="stack" style={{ gap: "var(--s-5)" }}>
        <FileDrop
          accept="application/pdf"
          multiple={false}
          onFiles={load}
          icon="sign"
          title={loading ? "Rendering pages…" : <>Drop a PDF to <span className="em">fill &amp; sign</span></>}
          sub={loading ? "One moment." : "Add text, dates, and your signature anywhere on the page."}
        />
        {loading && <ProgressBar value={progress} label="Loading pages" />}
        {note && <Banner kind="error">{note.msg}</Banner>}
      </div>
    );
  }

  return (
    <div className="editor-shell">
      <div className="editor-toolbar">
        <button type="button" className="tool-pill" onClick={() => addText("Text", "text")}>
          <Icon name="type" size={16} /> Text
        </button>
        <button type="button" className="tool-pill" onClick={() => addText(today, "date")}>
          <Icon name="calendar" size={16} /> Date
        </button>
        <button type="button" className="tool-pill" onClick={() => (lastSig ? addSignature(lastSig.img, lastSig.aspect) : setPadOpen(true))}>
          <Icon name="sign" size={16} /> Signature
        </button>
        {lastSig && (
          <button type="button" className="tool-pill" onClick={() => setPadOpen(true)}>
            Draw new
          </button>
        )}

        {sel && (sel.type === "text" || sel.type === "date") && (
          <>
            <span className="sep" />
            <div style={{ width: 120 }}>
              <RangeField value={Math.round((sel.fsFrac ?? 0.025) * 1000)} min={12} max={60} onChange={(v) => update(sel.id, { fsFrac: v / 1000 })} fmt={(v) => `${v}`} />
            </div>
            <input type="color" className="color-swatch" value={sel.color ?? "#1a1a2e"} onChange={(e) => update(sel.id, { color: e.target.value })} aria-label="Text color" />
          </>
        )}

        <div className="pager">
          <button type="button" className="icon-btn" onClick={() => setCur((c) => Math.max(0, c - 1))} disabled={cur === 0} aria-label="Previous page">
            <Icon name="chevronRight" size={16} style={{ transform: "rotate(180deg)" }} />
          </button>
          <span className="mono">{cur + 1}</span> / {pages.length}
          <button type="button" className="icon-btn" onClick={() => setCur((c) => Math.min(pages.length - 1, c + 1))} disabled={cur === pages.length - 1} aria-label="Next page">
            <Icon name="chevronRight" size={16} />
          </button>
        </div>
      </div>

      <div className="run-bar" style={{ marginTop: 0 }}>
        <RunButton onClick={run} busy={busy} icon="download">
          Apply &amp; download
        </RunButton>
        <button type="button" className="btn btn-ghost" onClick={reset} disabled={busy}>
          Load another
        </button>
      </div>

      <div className="canvas-stage" onMouseDown={() => { setSelected(null); setEditing(null); }}>
        <div
          className="page-canvas"
          ref={pageBoxRef}
          style={{ aspectRatio: `${pages[cur].ptW} / ${pages[cur].ptH}`, width: "100%", maxWidth: 540, containerType: "size" } as CSSProperties}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
          <img src={pages[cur].url} alt={`Page ${cur + 1}`} draggable={false} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
          {anns.filter((a) => a.page === cur).map((a) => {
            const isSel = a.id === selected;
            const style: CSSProperties = { left: `${a.xFrac * 100}%`, top: `${a.yFrac * 100}%` };
            return (
              <div
                key={a.id}
                className={cx("annot", a.type, isSel && "selected")}
                style={style}
                onPointerDown={(e) => onPointerDown(e, a, "move")}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {a.type === "sig" ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- local signature dataURL */}
                    <img src={a.img} alt="signature" draggable={false} style={{ width: `${(a.wFrac ?? 0.3) * 100}cqw`, height: "auto", display: "block" }} />
                    {isSel && <span className="handle br" onPointerDown={(e) => onPointerDown(e, a, "resize")} />}
                  </>
                ) : (
                  <span
                    style={{ fontSize: `${(a.fsFrac ?? 0.025) * 100}cqh`, color: a.color, whiteSpace: "pre", display: "block", outline: "none" }}
                    contentEditable={editing === a.id}
                    suppressContentEditableWarning
                    onDoubleClick={() => { setEditing(a.id); setSelected(a.id); }}
                    onBlur={(e) => { update(a.id, { text: e.currentTarget.innerText }); setEditing(null); }}
                  >
                    {a.text}
                  </span>
                )}
                {isSel && (
                  <button
                    type="button"
                    onClick={() => removeAnn(a.id)}
                    aria-label="Remove"
                    style={{ position: "absolute", top: -10, right: -10, width: 20, height: 20, borderRadius: "50%", background: "var(--error)", color: "#fff", display: "grid", placeItems: "center", boxShadow: "var(--shadow-sm)" }}
                  >
                    <Icon name="x" size={12} strokeWidth={2.5} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <p className="muted" style={{ fontSize: "var(--text-xs)" }}>
        Tip: double-click text to edit · drag to move · drag the corner dot to resize a signature.
      </p>

      {note && (
        <Banner kind={note.kind === "ok" ? "success" : "error"} title={note.kind === "ok" ? "Done" : "Couldn't export"}>
          {note.msg}
        </Banner>
      )}

      {padOpen && <SignaturePad onCancel={() => setPadOpen(false)} onSave={(img, aspect) => { setPadOpen(false); addSignature(img, aspect); }} />}
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
  const [hasInk, setHasInk] = useState(false);

  const pos = (e: RPointerEvent) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * c.width, y: ((e.clientY - r.top) / r.height) * c.height };
  };
  const down = (e: RPointerEvent) => {
    drawing.current = true;
    dirty.current = true;
    setHasInk(true);
    last.current = pos(e);
  };
  const move = (e: RPointerEvent) => {
    if (!drawing.current) return;
    const c = canvasRef.current?.getContext("2d");
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
  const up = () => {
    drawing.current = false;
    last.current = null;
  };
  const clear = () => {
    const c = canvasRef.current;
    c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
    dirty.current = false;
    setHasInk(false);
  };
  const save = () => {
    const c = canvasRef.current;
    if (!c || !dirty.current) return;
    onSave(c.toDataURL("image/png"), c.height / c.width);
  };

  return (
    <Modal
      title="Draw your signature"
      onClose={onCancel}
      foot={
        <>
          <button type="button" className="btn btn-ghost" onClick={clear}>Clear</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={!hasInk}>Use signature</button>
        </>
      }
    >
      <div className="sig-pad">
        <canvas ref={canvasRef} width={560} height={200} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
        {!hasInk && <div className="sig-hint">Sign here with your mouse or finger</div>}
      </div>
    </Modal>
  );
}
