"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { cx, Icon } from "@/components/ui";
import { formatBytes } from "@/lib/pdf";

/* ---------------- Drop zone ---------------- */

export function FileDrop({
  accept,
  multiple = true,
  onFiles,
  hint,
  label = "Drop files here",
}: {
  accept: string; // e.g. "application/pdf" or "image/*"
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  hint?: ReactNode;
  label?: string;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const pick = useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      onFiles(Array.from(list));
    },
    [onFiles],
  );

  return (
    <div
      className={cx("dropzone", drag && "drag")}
      onDragOver={(e) => {
        e.preventDefault();
        setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrag(false);
        pick(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        hidden
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = ""; // allow re-selecting the same file
        }}
      />
      <div className="dropzone-glyph" aria-hidden="true">
        <Icon name="dl" size={26} />
      </div>
      <div className="dropzone-label">{label}</div>
      <div className="dropzone-hint">{hint ?? "or click to browse — nothing is uploaded"}</div>
    </div>
  );
}

/* ---------------- Reorderable file list ---------------- */

export interface NamedFile {
  id: string;
  file: File;
}

export function FileList({
  items,
  onRemove,
  onMove,
  meta,
}: {
  items: NamedFile[];
  onRemove: (id: string) => void;
  onMove?: (id: string, dir: -1 | 1) => void;
  meta?: (f: NamedFile, index: number) => ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <ul className="file-list">
      {items.map((it, i) => (
        <li className="file-row" key={it.id}>
          <span className="file-idx">{i + 1}</span>
          <span className="file-name" title={it.file.name}>
            {it.file.name}
          </span>
          <span className="file-meta">{meta ? meta(it, i) : formatBytes(it.file.size)}</span>
          {onMove && (
            <span className="file-move">
              <button
                type="button"
                disabled={i === 0}
                onClick={() => onMove(it.id, -1)}
                aria-label="Move up"
                title="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={i === items.length - 1}
                onClick={() => onMove(it.id, 1)}
                aria-label="Move down"
                title="Move down"
              >
                ↓
              </button>
            </span>
          )}
          <button
            type="button"
            className="file-x"
            onClick={() => onRemove(it.id)}
            aria-label="Remove"
            title="Remove"
          >
            <Icon name="x" size={13} />
          </button>
        </li>
      ))}
    </ul>
  );
}

/* ---------------- Progress bar ---------------- */

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value * 100)));
  return (
    <div className="pbar-wrap">
      <div className="pbar">
        <div className="pbar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="pbar-label">{label ?? `${pct}%`}</span>
    </div>
  );
}

/* ---------------- Run / action button ---------------- */

export function RunButton({
  onClick,
  busy,
  disabled,
  children,
}: {
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="btn primary run-btn"
      onClick={onClick}
      disabled={busy || disabled}
    >
      {busy ? (
        <>
          <span className="spin" aria-hidden="true" /> working…
        </>
      ) : (
        <>
          <Icon name="play" size={13} /> {children}
        </>
      )}
    </button>
  );
}
