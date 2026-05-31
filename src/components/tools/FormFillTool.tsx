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
import { Banner, Check } from "@/components/ui";
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
  const [note, setNote] = useState<{ kind: "ok" | "err" | "warn"; msg: string } | null>(null);

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
        setNote({ kind: "warn", msg: "This PDF has no fillable form fields. Use Fill & Sign to overlay text instead." });
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

  if (!loaded) {
    return (
      <div className="stack" style={{ gap: "var(--s-5)" }}>
        <FileDrop
          accept="application/pdf"
          multiple={false}
          onFiles={load}
          icon="forms"
          title={<>Drop a fillable PDF or <span className="em">browse</span></>}
          sub="We'll detect the form fields so you can fill them in."
        />
        {note && <Banner kind={note.kind === "err" ? "error" : "warn"}>{note.msg}</Banner>}
      </div>
    );
  }

  return (
    <div className="stack" style={{ gap: "var(--s-5)" }}>
      <div className="panel">
        <div className="panel-title with-sub">{name}</div>
        <div className="panel-sub">{fields.length} form field{fields.length === 1 ? "" : "s"} detected</div>

        {fields.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: "var(--s-4)" }}>
            {fields.map((f) => (
              <div className="field" key={f.name} style={{ marginBottom: 0 }}>
                <label title={f.name} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</label>
                {f.type === "text" && (
                  <input className="input" value={values[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
                )}
                {f.type === "checkbox" && (
                  <Check checked={checks[f.name] ?? false} onChange={(v) => setChecks((c) => ({ ...c, [f.name]: v }))} label={checks[f.name] ? "Checked" : "Unchecked"} />
                )}
                {(f.type === "dropdown" || f.type === "radio" || f.type === "optionlist") && (
                  <select className="select" value={values[f.name] ?? ""} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}>
                    <option value="">— none —</option>
                    {f.options?.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                )}
                {f.type === "other" && <span className="hint">Unsupported field type</span>}
              </div>
            ))}
          </div>
        )}

        {fields.length > 0 && (
          <div style={{ marginTop: "var(--s-5)" }}>
            <Check checked={flatten} onChange={setFlatten} label="Flatten when done" sub="Locks the values so the form can't be edited again." />
          </div>
        )}
      </div>

      <div className="run-bar">
        <RunButton onClick={run} busy={busy} disabled={fields.length === 0} icon="forms">
          Fill &amp; download
        </RunButton>
        <button type="button" className="btn btn-ghost" onClick={reset} disabled={busy}>
          Choose another
        </button>
      </div>

      {note && (
        <Banner kind={note.kind === "ok" ? "success" : note.kind === "warn" ? "warn" : "error"} title={note.kind === "ok" ? "Done" : undefined}>
          {note.msg}
        </Banner>
      )}
    </div>
  );
}
