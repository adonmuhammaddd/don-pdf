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
import { Banner, Check, Icon, Modal, RangeField, Segmented, cx } from "@/components/ui";
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
    pointerId: number;
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
    // Capture the pointer so the release reaches us even if it happens outside
    // the page, over an iframe, or after the browser tried to start a drag.
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* pointer already gone — the buttons check in `move` covers it */
    }
    dragRef.current = {
      id: ann.id,
      pointerId: e.pointerId,
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

  // Pointer (not mouse) events, so dragging works with touch and pen too — a
  // touch never synthesises the mousemove/mouseup this used to listen for.
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      // No button held means we missed the release (a native drag or the OS can
      // swallow pointerup) — end the drag instead of gluing it to the cursor.
      if (e.buttons === 0) {
        dragRef.current = null;
        return;
      }
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
    const ends = ["pointerup", "pointercancel", "lostpointercapture", "blur"] as const;
    window.addEventListener("pointermove", move);
    ends.forEach((t) => window.addEventListener(t, up, true));
    return () => {
      window.removeEventListener("pointermove", move);
      ends.forEach((t) => window.removeEventListener(t, up, true));
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
            New signature
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
                onDragStart={(e) => e.preventDefault()}
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
                    // Don't let the parent start a drag: its pointer capture
                    // would retarget the click away from this button.
                    onPointerDown={(e) => e.stopPropagation()}
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
  const [mode, setMode] = useState<"draw" | "upload">("draw");
  const [upFile, setUpFile] = useState<File | null>(null);
  const [knockout, setKnockout] = useState(true);
  const [upSig, setUpSig] = useState<{ img: string; aspect: number } | null>(null);
  const [upErr, setUpErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Re-process whenever the file or the knockout toggle changes.
  useEffect(() => {
    if (!upFile) return;
    let live = true;
    imageToSignature(upFile, knockout)
      .then((r) => {
        if (!live) return;
        setUpSig(r);
        setUpErr(null);
      })
      .catch((e) => {
        if (!live) return;
        setUpSig(null);
        setUpErr((e as Error).message);
      });
    return () => {
      live = false;
    };
  }, [upFile, knockout]);

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
    if (mode === "upload") {
      if (upSig) onSave(upSig.img, upSig.aspect);
      return;
    }
    const c = canvasRef.current;
    if (!c || !dirty.current) return;
    onSave(c.toDataURL("image/png"), c.height / c.width);
  };

  return (
    <Modal
      title="Add your signature"
      onClose={onCancel}
      foot={
        <>
          {mode === "draw" ? (
            <button type="button" className="btn btn-ghost" onClick={clear}>Clear</button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
              {upFile ? "Choose another" : "Choose image"}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={save} disabled={mode === "draw" ? !hasInk : !upSig}>Use signature</button>
        </>
      }
    >
      <div className="stack" style={{ gap: "var(--s-4)" }}>
        <Segmented
          block
          value={mode}
          onChange={setMode}
          options={[
            { value: "draw", label: "Draw", icon: "sign" },
            { value: "upload", label: "Upload image", icon: "upload" },
          ]}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setUpFile(f);
            e.target.value = "";
          }}
        />
        {/* Keep the canvas mounted so switching tabs doesn't wipe the drawing. */}
        <div className="sig-pad" style={mode === "draw" ? undefined : { display: "none" }}>
          <canvas ref={canvasRef} width={560} height={200} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
          {!hasInk && <div className="sig-hint">Sign here with your mouse or finger</div>}
        </div>
        {mode === "upload" && (
          <>
            <div
              className="sig-pad sig-upload"
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) setUpFile(f);
              }}
            >
              {upSig ? (
                // eslint-disable-next-line @next/next/no-img-element -- local signature dataURL
                <img src={upSig.img} alt="Uploaded signature" />
              ) : (
                <div className="sig-hint">Click or drop a PNG / JPG of your signature</div>
              )}
            </div>
            <Check
              checked={knockout}
              onChange={setKnockout}
              label="Remove white background"
              sub="For a signature scanned or photographed on white paper. Turn off for transparent PNGs you want kept as-is."
            />
            {upErr && <Banner kind="error">{upErr}</Banner>}
          </>
        )}
      </div>
    </Modal>
  );
}

/**
 * Turn an uploaded image into a signature PNG: downscale, optionally knock the
 * paper-white background out to transparent, and trim to the ink. PNG output
 * keeps transparency and is what pdf-lib's embedPng expects.
 */
async function imageToSignature(file: File, knockout: boolean): Promise<{ img: string; aspect: number }> {
  if (!file.type.startsWith("image/")) throw new Error("That file isn't an image.");
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file);
  } catch {
    throw new Error("Couldn't read that image.");
  }
  const MAX = 1200;
  const k = Math.min(1, MAX / Math.max(bmp.width, bmp.height));
  const w = Math.max(1, Math.round(bmp.width * k));
  const h = Math.max(1, Math.round(bmp.height * k));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();

  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  if (knockout) {
    // Luminance ramp: >= HI fully transparent, <= LO untouched, soft in between
    // so anti-aliased stroke edges don't get a white fringe.
    const LO = 170;
    const HI = 225;
    for (let i = 0; i < px.length; i += 4) {
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      if (lum >= HI) px[i + 3] = 0;
      else if (lum > LO) px[i + 3] = Math.round(px[i + 3] * ((HI - lum) / (HI - LO)));
    }
  }

  // Trim to the non-transparent bounds.
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  if (x1 < 0) throw new Error("No signature found — the image is blank after removing the background.");
  const pad = 4;
  x0 = Math.max(0, x0 - pad);
  y0 = Math.max(0, y0 - pad);
  x1 = Math.min(w - 1, x1 + pad);
  y1 = Math.min(h - 1, y1 + pad);
  const tw = x1 - x0 + 1;
  const th = y1 - y0 + 1;
  ctx.putImageData(data, 0, 0);
  const out = document.createElement("canvas");
  out.width = tw;
  out.height = th;
  out.getContext("2d")!.drawImage(c, x0, y0, tw, th, 0, 0, tw, th);
  return { img: out.toDataURL("image/png"), aspect: th / tw };
}
