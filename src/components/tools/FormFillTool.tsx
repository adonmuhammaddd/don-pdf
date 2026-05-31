"use client";

import { useState } from "react";
import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFOptionList,
  PDFRadioGroup,
  PDFTextField,
} from "pdf-lib";
import { FileDrop, RunButton } from "@/components/pdfui";
import { TerminalWindow } from "@/components/ui";
import { baseName, downloadBlob } from "@/lib/pdf";

type FieldType = "text" | "checkbox" | "dropdown" | "radio" | "optionlist" | "other";
interface FieldDesc {
  name: string;
  type: FieldType;
  options?: string[];
}

export default function FormFillTool() {
  const [name, setName] = useState("");
  const [bytes, setBytes] = useState<ArrayBuffer | null>(null);
  const [fields, setFields] = useState<FieldDesc[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [flatten, setFlatten] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const load = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setNote(null);
    try {
      const buf = await file.arrayBuffer();
      const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
      const form = pdf.getForm();
      const descs: FieldDesc[] = [];
      const vals: Record<string, string> = {};
      const chk: Record<string, boolean> = {};
      for (const f of form.getFields()) {
        const fname = f.getName();
        if (f instanceof PDFTextField) {
          descs.push({ name: fname, type: "text" });
          vals[fname] = f.getText() ?? "";
        } else if (f instanceof PDFCheckBox) {
          descs.push({ name: fname, type: "checkbox" });
          chk[fname] = f.isChecked();
        } else if (f instanceof PDFDropdown) {
          descs.push({ name: fname, type: "dropdown", options: f.getOptions() });
          vals[fname] = f.getSelected()[0] ?? "";
        } else if (f instanceof PDFRadioGroup) {
          descs.push({ name: fname, type: "radio", options: f.getOptions() });
          vals[fname] = f.getSelected() ?? "";
        } else if (f instanceof PDFOptionList) {
          descs.push({ name: fname, type: "optionlist", options: f.getOptions() });
          vals[fname] = f.getSelected()[0] ?? "";
        } else {
          descs.push({ name: fname, type: "other" });
        }
      }
      setName(file.name);
      setBytes(buf);
      setFields(descs);
      setValues(vals);
      setChecks(chk);
      setLoaded(true);
      if (descs.length === 0) {
        setNote({ kind: "err", msg: "This PDF has no fillable form fields. Use Fill & Sign to overlay text instead." });
      }
    } catch (e) {
      setNote({ kind: "err", msg: `Couldn't read PDF: ${(e as Error).message}` });
    }
  };

  const reset = () => {
    setBytes(null);
    setFields([]);
    setValues({});
    setChecks({});
    setLoaded(false);
    setName("");
    setNote(null);
  };

  const run = async () => {
    if (!bytes) return;
    setBusy(true);
    setNote(null);
    try {
      const pdf = await PDFDocument.load(bytes, { ignoreEncryption: true });
      const form = pdf.getForm();
      for (const d of fields) {
        try {
          if (d.type === "text") {
            form.getTextField(d.name).setText(values[d.name] ?? "");
          } else if (d.type === "checkbox") {
            const cb = form.getCheckBox(d.name);
            if (checks[d.name]) cb.check();
            else cb.uncheck();
          } else if (d.type === "dropdown") {
            if (values[d.name]) form.getDropdown(d.name).select(values[d.name]);
          } else if (d.type === "radio") {
            if (values[d.name]) form.getRadioGroup(d.name).select(values[d.name]);
          } else if (d.type === "optionlist") {
            if (values[d.name]) form.getOptionList(d.name).select(values[d.name]);
          }
        } catch {
          /* skip fields that reject a value */
        }
      }
      if (flatten) form.flatten();
      const out = await pdf.save();
      const stem = baseName(name);
      downloadBlob(out, `${stem}-filled.pdf`);
      setNote({ kind: "ok", msg: `Filled ${fields.length} field${fields.length === 1 ? "" : "s"}${flatten ? " (flattened)" : ""} → ${stem}-filled.pdf` });
    } catch (e) {
      setNote({ kind: "err", msg: `Fill failed: ${(e as Error).message}` });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {!loaded && (
        <TerminalWindow title={<><b>fill forms</b> — source PDF</>} glow>
          <FileDrop
            accept="application/pdf"
            multiple={false}
            onFiles={load}
            label="Drop a fillable PDF here"
            hint="reads native AcroForm fields — nothing is uploaded"
          />
        </TerminalWindow>
      )}

      {loaded && (
        <>
          <div className="pdf-actions" style={{ marginTop: 0 }}>
            <RunButton onClick={run} busy={busy} disabled={fields.length === 0}>
              Fill &amp; download
            </RunButton>
            <button type="button" className="btn" onClick={reset} disabled={busy}>Load another</button>
            <label className="opt" style={{ flexDirection: "row", alignItems: "center", gap: "var(--s2)" }}>
              <input type="checkbox" checked={flatten} onChange={(e) => setFlatten(e.target.checked)} />
              <span style={{ textTransform: "none" }}>flatten (lock values, no longer editable)</span>
            </label>
            <span style={{ color: "var(--text-2)", fontSize: "var(--fs-sm)" }}>{name} · {fields.length} fields</span>
          </div>

          {fields.length > 0 && (
            <div className="form-fields">
              {fields.map((f) => (
                <div className="form-field" key={f.name}>
                  <label className="form-field-label" title={f.name}>{f.name}</label>
                  {f.type === "text" && (
                    <input
                      type="text"
                      value={values[f.name] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    />
                  )}
                  {f.type === "checkbox" && (
                    <label className="form-check">
                      <input
                        type="checkbox"
                        checked={checks[f.name] ?? false}
                        onChange={(e) => setChecks((c) => ({ ...c, [f.name]: e.target.checked }))}
                      />
                      <span>{checks[f.name] ? "checked" : "unchecked"}</span>
                    </label>
                  )}
                  {(f.type === "dropdown" || f.type === "radio" || f.type === "optionlist") && (
                    <select
                      value={values[f.name] ?? ""}
                      onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                    >
                      <option value="">— none —</option>
                      {f.options?.map((o) => (
                        <option key={o} value={o}>{o}</option>
                      ))}
                    </select>
                  )}
                  {f.type === "other" && <span className="form-field-na">unsupported field type</span>}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {note && <div className={`pdf-note ${note.kind}`}>{note.msg}</div>}
    </div>
  );
}
