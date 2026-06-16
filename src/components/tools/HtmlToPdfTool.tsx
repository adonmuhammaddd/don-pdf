"use client";

import { useState } from "react";
import { FileDrop, FileList, RunButton, type NamedFile } from "@/components/pdfui";
import { Banner, Segmented, Check } from "@/components/ui";
import { downloadBlob, baseName } from "@/lib/pdf";

const uid = () => Math.random().toString(36).slice(2);

type Source = "file" | "paste";
type PageSize = "a4" | "letter" | "auto";
type Orientation = "portrait" | "landscape";

// Page dimensions in PDF points (1pt = 1/72in).
const SIZES: Record<Exclude<PageSize, "auto">, { w: number; h: number }> = {
  a4: { w: 595.28, h: 841.89 },
  letter: { w: 612, h: 792 },
};
const MARGIN = 24; // pt
const isHtml = (f: File) => f.type === "text/html" || /\.html?$/i.test(f.name);

/**
 * Renders user HTML into a sandboxed, off-screen iframe so we can measure and
 * rasterise it. `allow-same-origin` (without `allow-scripts`) lets us read the
 * iframe document while keeping any embedded <script> inert — nothing executes,
 * nothing leaves the page.
 */
function renderInIframe(html: string, widthPx: number): Promise<{ frame: HTMLIFrameElement; body: HTMLElement }> {
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-same-origin");
    frame.style.cssText = `position:fixed;left:-10000px;top:0;border:0;width:${widthPx}px;height:10px;background:#fff;`;
    frame.onload = () => {
      const doc = frame.contentDocument;
      if (!doc?.body) {
        reject(new Error("Couldn't read the rendered HTML."));
        return;
      }
      // Let layout settle (fonts / images), then hand back the body.
      requestAnimationFrame(() => resolve({ frame, body: doc.body }));
    };
    frame.onerror = () => reject(new Error("Failed to render the HTML."));
    frame.srcdoc = html;
    document.body.appendChild(frame);
  });
}

export default function HtmlToPdfTool() {
  const [source, setSource] = useState<Source>("paste");
  const [items, setItems] = useState<NamedFile[]>([]);
  const [html, setHtml] = useState("");
  const [pageSize, setPageSize] = useState<PageSize>("a4");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [margin, setMargin] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const addFiles = (files: File[]) => {
    const html = files.filter(isHtml);
    if (html.length === 0) {
      setNote({ kind: "err", msg: "Please choose an .html file." });
      return;
    }
    setItems([{ id: uid(), file: html[0] }]); // single file
    setNote(null);
  };
  const remove = (id: string) => setItems((p) => p.filter((i) => i.id !== id));

  const run = async () => {
    setBusy(true);
    setNote(null);
    let frameEl: HTMLIFrameElement | null = null;
    try {
      const file = items[0]?.file;
      const markup = source === "file" ? (file ? await file.text() : "") : html;
      if (!markup.trim()) throw new Error("There's no HTML to convert yet.");

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import("html2canvas-pro"),
        import("jspdf"),
      ]);

      const land = orientation === "landscape";
      const base = pageSize === "auto" ? SIZES.a4 : SIZES[pageSize];
      const pageW = land ? base.h : base.w;
      const pad = margin ? MARGIN : 0;
      // px width of the printable area at 96dpi (1pt = 1/72in, 1px = 1/96in).
      const contentPx = Math.round(((pageW - pad * 2) * 96) / 72);

      const { frame, body } = await renderInIframe(markup, contentPx);
      frameEl = frame;
      const canvas = await html2canvas(body, {
        scale: 2,
        backgroundColor: "#ffffff",
        useCORS: true,
        width: contentPx,
        windowWidth: contentPx,
      });

      const pxToPt = (pageW - pad * 2) / canvas.width;
      const fileName = `${baseName(file?.name ?? "document")}.pdf`;

      if (pageSize === "auto") {
        // One page sized exactly to the content.
        const w = canvas.width * pxToPt + pad * 2;
        const h = canvas.height * pxToPt + pad * 2;
        const pdf = new jsPDF({ unit: "pt", format: [w, h] });
        pdf.addImage(canvas, "PNG", pad, pad, canvas.width * pxToPt, canvas.height * pxToPt);
        downloadBlob(pdf.output("blob"), fileName);
      } else {
        const pageH = land ? base.w : base.h;
        const contentHpt = pageH - pad * 2;
        const sliceHpx = Math.floor(contentHpt / pxToPt); // canvas px per page
        const pages = Math.max(1, Math.ceil(canvas.height / sliceHpx));
        const pdf = new jsPDF({ unit: "pt", orientation, format: pageSize });

        for (let p = 0; p < pages; p++) {
          if (p > 0) pdf.addPage(pageSize, orientation);
          const y0 = p * sliceHpx;
          const h = Math.min(sliceHpx, canvas.height - y0);
          const slice = document.createElement("canvas");
          slice.width = canvas.width;
          slice.height = h;
          const ctx = slice.getContext("2d");
          if (!ctx) throw new Error("Canvas 2D context unavailable.");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, slice.width, slice.height);
          ctx.drawImage(canvas, 0, y0, canvas.width, h, 0, 0, canvas.width, h);
          pdf.addImage(slice, "PNG", pad, pad, canvas.width * pxToPt, h * pxToPt);
        }
        downloadBlob(pdf.output("blob"), fileName);
      }
      setNote({ kind: "ok", msg: `Converted to ${fileName}` });
    } catch (e) {
      setNote({ kind: "err", msg: `Conversion failed: ${(e as Error).message}` });
    } finally {
      frameEl?.remove();
      setBusy(false);
    }
  };

  const ready = source === "file" ? items.length > 0 : html.trim().length > 0;

  return (
    <div className="stack" style={{ gap: "var(--s-5)" }}>
      <Segmented
        value={source}
        onChange={setSource}
        block
        options={[
          { value: "paste", label: "Paste HTML", icon: "code" },
          { value: "file", label: "Upload .html", icon: "upload" },
        ]}
      />

      {source === "file" ? (
        <>
          <FileDrop
            accept="text/html,.html,.htm"
            multiple={false}
            onFiles={addFiles}
            icon="code"
            title={<>Drop an .html file or <span className="em">browse</span></>}
            sub="The page is rendered and converted entirely on your device."
          />
          {items.length > 0 && <FileList items={items} onRemove={remove} />}
        </>
      ) : (
        <div className="field">
          <label>HTML source</label>
          <textarea
            className="textarea mono"
            spellCheck={false}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            placeholder={"<h1>Invoice</h1>\n<p>Paste any HTML — including inline <style> — here.</p>"}
            style={{ minHeight: 200 }}
          />
        </div>
      )}

      <div className="field">
        <label>Page size</label>
        <Segmented
          value={pageSize}
          onChange={setPageSize}
          options={[
            { value: "a4", label: "A4" },
            { value: "letter", label: "Letter" },
            { value: "auto", label: "Fit content" },
          ]}
        />
      </div>

      {pageSize !== "auto" && (
        <div className="field">
          <label>Orientation</label>
          <Segmented
            value={orientation}
            onChange={setOrientation}
            options={[
              { value: "portrait", label: "Portrait" },
              { value: "landscape", label: "Landscape" },
            ]}
          />
        </div>
      )}

      <Check checked={margin} onChange={setMargin} label="Add page margins" sub="A little breathing room around the content." />

      <div className="run-bar">
        <RunButton onClick={run} busy={busy} disabled={!ready} icon="html2pdf">
          Convert to PDF
        </RunButton>
        {ready && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setItems([]);
              setHtml("");
              setNote(null);
            }}
            disabled={busy}
          >
            Clear
          </button>
        )}
      </div>

      {note && (
        <Banner kind={note.kind === "ok" ? "success" : "error"} title={note.kind === "ok" ? "Done" : "Couldn't convert"}>
          {note.msg}
        </Banner>
      )}
    </div>
  );
}
