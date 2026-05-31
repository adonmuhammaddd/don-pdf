"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ============================================================
   Icons — 24px geometric line icons (from the design handoff)
   ============================================================ */
const ICON_PATHS: Record<string, string> = {
  // tools
  merge: "M8 4H5a1 1 0 0 0-1 1v5 M3 11h12a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7 M16 19h4a1 1 0 0 0 1-1V7 M18 9.5 20.5 7 18 4.5",
  split: "M4 3.5h10a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Z M10 13.5h10a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1Z M5 14h2 M5 17.5h2.6",
  organize: "M3.5 4.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1Z M13.5 4.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1Z M3.5 14.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1Z M13.5 14.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1Z",
  rotate: "M20.5 12a8.5 8.5 0 1 1-2.5-6 M20.5 3.5v4h-4",
  crop: "M6.5 2v13.5a2 2 0 0 0 2 2H22 M2 6.5h13.5a2 2 0 0 1 2 2V22",
  numbers: "M5 3.5h14a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z M9 16.5h2 M14.5 16.5l1.6-3h-3",
  watermark: "M5 3.5h14a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z M12 8c1.6 2 2.6 3.3 2.6 4.6a2.6 2.6 0 0 1-5.2 0C9.4 11.3 10.4 10 12 8Z",
  sign: "M3 18.5c2.4 0 2.8-3.3 4-7 1-3 1.7-5.2 2.8-5.2 1 0 1 1.6 0 4-1 2.5-1.9 4.2-1.9 5.1 0 .7.4 1 1 1 1.1 0 1.9-1.5 2.5-1.5.5 0 .7.5.9 1 .2.5.6.9 1.2.9 1.1 0 1.9-1.2 2.7-1.2 M17.5 16l3 3",
  forms: "M5 3.5h14a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z M7.5 8.5l1.3 1.3L11.5 7 M14 9h3.5 M7.5 15.2l1.3 1.3L11.5 13.7 M14 15.5h3.5",
  pdf2img: "M4 3.5h8a1 1 0 0 1 1 1V9 M13 8.5h7a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-3 M4 9v7a1 1 0 0 0 1 1h4 M13 12.5a1.2 1.2 0 1 0 2.4 0 1.2 1.2 0 0 0-2.4 0Z M11 19.5l3-2.8 2.2 1.8",
  img2pdf: "M4 4h10a1 1 0 0 1 1 1v5 M14.5 14h5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-8a1 1 0 0 1-1-1v-3 M4 5v8a1 1 0 0 0 1 1h4 M6.5 8a1 1 0 1 0 2 0 1 1 0 0 0-2 0Z M4 13l2.7-2.6 2 1.6",
  compress: "M5 3.5h14a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z M12 7.5v3 M9.8 9.3 12 7l2.2 2.3 M12 16.5v-3 M9.8 14.7 12 17l2.2-2.3",
  // nav / ui
  home: "M3.5 10.5 12 3.5l8.5 7 M5.5 9.2V20h13V9.2 M9.8 20v-5h4.4v5",
  search: "M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Z M20 20l-4-4",
  upload: "M12 16V4 M7.5 8.5 12 4l4.5 4.5 M4.5 15v3.5a1 1 0 0 0 1 1h13a1 1 0 0 0 1-1V15",
  download: "M12 4v12 M7.5 11.5 12 16l4.5-4.5 M4.5 18.5h15",
  plus: "M12 5v14 M5 12h14",
  x: "M6 6l12 12 M18 6 6 18",
  check: "M5 12.5 10 17.5 19 6.5",
  trash: "M4.5 6.5h15 M9 6.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v1.5 M6.5 6.5 7.3 19a1.5 1.5 0 0 0 1.5 1.4h6.4a1.5 1.5 0 0 0 1.5-1.4L18 6.5",
  shield: "M12 3.5 5 6v5.5c0 4.3 2.9 7.4 7 9 4.1-1.6 7-4.7 7-9V6Z M9 12l2 2 4-4.5",
  lock: "M7 10.5V7.5a5 5 0 0 1 10 0v3 M5.5 10.5h13a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1Z",
  sun: "M12 6.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11Z M12 1.5V3 M12 21v1.5 M3.5 3.5 4.6 4.6 M19.4 19.4l1.1 1.1 M1.5 12H3 M21 12h1.5 M3.5 20.5l1.1-1.1 M19.4 4.6l1.1-1.1",
  moon: "M20 14.5A8.5 8.5 0 0 1 9.5 4 7 7 0 1 0 20 14.5Z",
  chevronRight: "M9.5 6 15.5 12 9.5 18",
  arrowRight: "M4 12h15 M13 6l6 6-6 6",
  menu: "M4 7h16 M4 12h16 M4 17h16",
  drag: "M9 6a1 1 0 1 0 0-.01Z M9 12a1 1 0 1 0 0-.01Z M9 18a1 1 0 1 0 0-.01Z M15 6a1 1 0 1 0 0-.01Z M15 12a1 1 0 1 0 0-.01Z M15 18a1 1 0 1 0 0-.01Z",
  image: "M5 4.5h14a.5.5 0 0 1 .5.5v14a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V5a.5.5 0 0 1 .5-.5Z M8.5 10a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z M4.5 16.5 9 12l3 2.5 3-2 4.5 4",
  type: "M5 6.5V5h14v1.5 M12 5v14 M9.5 19h5",
  calendar: "M5 5.5h14a.5.5 0 0 1 .5.5v13a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V6a.5.5 0 0 1 .5-.5Z M4.5 9.5h15 M8.5 3.5v4 M15.5 3.5v4",
  info: "M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17Z M12 11v5.5 M12 7.6v.01",
  alert: "M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17Z M12 7.5v5 M12 16.3v.01",
  bolt: "M13 3 5 13h6l-1 8 8-10h-6Z",
  arrowUp: "M12 20V5 M6 11l6-6 6 6",
  arrowDown: "M12 4v15 M6 13l6 6 6-6",
  undo: "M8 8 4 12l4 4 M4 12h10a5 5 0 0 1 5 5v1",
};

export type IconName = keyof typeof ICON_PATHS;

export function Icon({
  name,
  size = 20,
  className = "",
  strokeWidth = 1.7,
  style,
}: {
  name: IconName | string;
  size?: number;
  className?: string;
  strokeWidth?: number;
  style?: CSSProperties;
}) {
  const d = ICON_PATHS[name];
  if (!d) return null;
  const segs = d.split(" M").map((seg, i) => (i === 0 ? seg : "M" + seg));
  return (
    <svg
      className={cx("ic", className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {segs.map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

/* ============================================================
   Toasts
   ============================================================ */
export type ToastKind = "success" | "error";
let toastSeq = 0;

export function toast(title: string, opts?: { kind?: ToastKind; msg?: string }): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent("dpdf-toast", {
      detail: { title, kind: opts?.kind ?? "success", msg: opts?.msg },
    }),
  );
}

interface ToastItem {
  id: number;
  title: string;
  kind: ToastKind;
  msg?: string;
}

export function ToastHost() {
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const d = (e as CustomEvent<Omit<ToastItem, "id">>).detail;
      const id = ++toastSeq;
      setItems((x) => [...x, { id, ...d }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 3400);
    };
    window.addEventListener("dpdf-toast", on);
    return () => window.removeEventListener("dpdf-toast", on);
  }, []);

  return (
    <div className="toast-wrap">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <div className="t-ic">
            <Icon name={t.kind === "error" ? "alert" : "check"} size={17} strokeWidth={2.2} />
          </div>
          <div className="toast-body">
            <h5>{t.title}</h5>
            {t.msg && <p>{t.msg}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   Controls
   ============================================================ */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  block,
}: {
  value: T;
  options: { value: T; label: string; icon?: string }[];
  onChange: (v: T) => void;
  block?: boolean;
}) {
  return (
    <div className={cx("segmented", block && "block")} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={cx("seg", value === o.value && "active")}
          onClick={() => onChange(o.value)}
        >
          {o.icon && <Icon name={o.icon} size={16} />}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Check({
  checked,
  onChange,
  label,
  sub,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: ReactNode;
  sub?: ReactNode;
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="box">
        <Icon name="check" size={13} strokeWidth={3} />
      </span>
      <span className="ctext">
        {label}
        {sub && <small>{sub}</small>}
      </span>
    </label>
  );
}

export function RangeField({
  value,
  min,
  max,
  step = 1,
  onChange,
  fmt,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
}) {
  return (
    <div className="range-row">
      <input
        className="range"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
      />
      <span className="range-val">{fmt ? fmt(value) : value}</span>
    </div>
  );
}

export function Badge({
  kind = "brand",
  children,
}: {
  kind?: "brand" | "success" | "warn";
  children: ReactNode;
}) {
  return <span className={`badge ${kind}`}>{children}</span>;
}

export type BannerKind = "info" | "success" | "error" | "warn";
export function Banner({
  kind = "info",
  title,
  children,
  icon,
}: {
  kind?: BannerKind;
  title?: ReactNode;
  children?: ReactNode;
  icon?: string;
}) {
  const def: Record<BannerKind, string> = {
    info: "info",
    success: "check",
    error: "alert",
    warn: "alert",
  };
  return (
    <div className={`banner ${kind}`}>
      <Icon name={icon ?? def[kind]} size={18} strokeWidth={2} />
      <div className="banner-body">
        {title && <h4>{title}</h4>}
        {children && <p>{children}</p>}
      </div>
    </div>
  );
}

/* ============================================================
   Modal
   ============================================================ */
export function Modal({
  title,
  onClose,
  children,
  foot,
  wide,
}: {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  foot?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  return (
    <div className="modal-scrim" onMouseDown={onClose}>
      <div
        className="modal"
        style={wide ? { maxWidth: 640 } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose} aria-label="Close" type="button">
            <Icon name="x" size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}
