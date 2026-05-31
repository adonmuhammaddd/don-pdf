"use client";

import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { SUPPORT_LINKS } from "@/lib/support";

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ---------------- Icons (simple stroke geometry) ---------------- */
type IconName =
  | "search" | "copy" | "check" | "sun" | "moon" | "menu" | "x"
  | "refresh" | "arrow" | "swap" | "bolt" | "home" | "play" | "dl"
  | "info" | "warn";

const PATHS: Record<IconName, ReactNode> = {
  search: <><circle cx="7" cy="7" r="5" /><path d="M11 11l4 4" /></>,
  copy: <><rect x="6" y="6" width="9" height="9" rx="1.5" /><path d="M11 6V3.5A1.5 1.5 0 0 0 9.5 2h-6A1.5 1.5 0 0 0 2 3.5v6A1.5 1.5 0 0 0 3.5 11H6" /></>,
  check: <path d="M3 8.5l3.5 3.5L14 4" />,
  sun: <><circle cx="8" cy="8" r="3.2" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M13 3l-1.4 1.4M4.4 11.6L3 13" /></>,
  moon: <path d="M13.5 9.2A5.5 5.5 0 1 1 6.8 2.5 4.4 4.4 0 0 0 13.5 9.2Z" />,
  menu: <path d="M2 4h12M2 8h12M2 12h12" />,
  x: <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />,
  refresh: <><path d="M13.5 7a5.5 5.5 0 1 0-.7 4" /><path d="M13.5 2.5V6H10" /></>,
  arrow: <path d="M3 8h9M9 5l3 3-3 3" />,
  swap: <><path d="M4 5h8l-2-2M12 11H4l2 2" /></>,
  bolt: <path d="M9 1L3 9h4l-1 6 6-8H8l1-6Z" />,
  home: <><path d="M2.5 8L8 3l5.5 5" /><path d="M4 7.5V13h8V7.5" /></>,
  play: <path d="M5 3l8 5-8 5V3Z" />,
  dl: <><path d="M8 2v8M5 7l3 3 3-3" /><path d="M3 13h10" /></>,
  info: <><circle cx="8" cy="8" r="6" /><path d="M8 7.5v3.5M8 5h.01" /></>,
  warn: <><path d="M8 2l6 11H2L8 2Z" /><path d="M8 6.5v3M8 11.5h.01" /></>,
};

export function Icon({
  name,
  size = 16,
  className = "",
}: {
  name: IconName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      className={className}
      style={{ fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round" }}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

/* ---------------- Toasts ---------------- */
export type ToastType = "ok" | "err" | "info";
let toastSeq = 0;

export function toast(text: string, type: ToastType = "ok"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ddt-toast", { detail: { text, type } }));
}

export function ToastHost() {
  const [items, setItems] = useState<{ id: number; text: string; type: ToastType }[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const { text, type } = (e as CustomEvent<{ text: string; type: ToastType }>).detail;
      const id = ++toastSeq;
      setItems((x) => [...x, { id, text, type }]);
      setTimeout(() => setItems((x) => x.filter((i) => i.id !== id)), 2200);
    };
    window.addEventListener("ddt-toast", on);
    return () => window.removeEventListener("ddt-toast", on);
  }, []);

  return (
    <div className="toast-stack">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <Icon className="ti" name={t.type === "err" ? "warn" : "check"} size={15} />
          <span className="tx">{t.text}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- Copy ---------------- */
export function copyText(text: string, label = "copied to clipboard"): void {
  const done = () => toast(label, "ok");
  navigator.clipboard.writeText(text).then(done, done);
}

export function CopyButton({
  text,
  label,
  corner,
}: {
  text: string;
  label?: string;
  corner?: boolean;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      disabled={!text}
      className={cx("copy-btn", done && "done", corner && "copy-corner")}
      onClick={() => {
        copyText(text, label);
        setDone(true);
        setTimeout(() => setDone(false), 1100);
      }}
    >
      <Icon name={done ? "check" : "copy"} size={12} />
      {done ? "OK" : "COPY"}
    </button>
  );
}

/* ---------------- Terminal window ---------------- */
export function TerminalWindow({
  title,
  right,
  children,
  glow,
  className = "",
  bodyStyle,
}: {
  title: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  glow?: boolean;
  className?: string;
  bodyStyle?: CSSProperties;
}) {
  return (
    <div className={cx("twin", glow && "glow", className)}>
      <div className="twin-bar">
        <div className="lights">
          <i className="r" />
          <i className="y" />
          <i className="g" />
        </div>
        <span className="twin-title">{title}</span>
        {right && <div className="right">{right}</div>}
      </div>
      <div className="twin-body" style={bodyStyle}>
        {children}
      </div>
    </div>
  );
}

/* ---------------- Controls ---------------- */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="seg-ctl" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={value === o.value ? "on" : ""}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Chip({
  on,
  onClick,
  preset,
  children,
}: {
  on?: boolean;
  onClick?: () => void;
  preset?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={cx("chip", preset && "preset", on && "on")}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function Badge({
  kind = "dim",
  children,
}: {
  kind?: "ok" | "err" | "warn" | "dim";
  children: ReactNode;
}) {
  return <span className={`badge ${kind}`}>{children}</span>;
}

export function FieldLabel({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="field-label" style={{ justifyContent: right ? "space-between" : "flex-start" }}>
      <span>{children}</span>
      {right}
    </div>
  );
}

/* ---------------- Support / donate ---------------- */
export function SupportLinks() {
  if (SUPPORT_LINKS.length === 0) return null;
  return (
    <div className="support">
      <div className="support-head">
        <span className="prompt">❯</span> support don
      </div>
      <div className="support-links">
        {SUPPORT_LINKS.map((l) => (
          <a
            key={l.id}
            className="support-link"
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`Dukung lewat ${l.label}`}
          >
            <span className="sg" aria-hidden="true">
              {l.glyph}
            </span>
            {l.label}
          </a>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Mascot ---------------- */
export const MASCOT_SRC = "/mascot.png";
export const MASCOT_AVATAR = "/mascot-avatar.png";

export function Mascot({
  src = MASCOT_SRC,
  className = "",
  style,
  tint = true,
  scan = true,
}: {
  src?: string;
  className?: string;
  style?: CSSProperties;
  tint?: boolean;
  scan?: boolean;
}) {
  return (
    <div
      className={cx("mascot", tint && "tint", scan && "scan", className)}
      style={{ ...style, "--mascot-mask": `url(${src})` } as CSSProperties}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- mask alignment needs a plain <img> */}
      <img src={src} alt="Don, your dev companion" draggable={false} />
    </div>
  );
}

export function Speech({
  who,
  children,
}: {
  who?: string;
  children: ReactNode;
}) {
  return (
    <div className="speech">
      {who && <div className="who">{who}</div>}
      {children}
    </div>
  );
}

/* ---------------- Output box ---------------- */
export function OutputBox({
  children,
  copyValue,
  copyLabel,
  short,
  className = "",
  style,
}: {
  children: ReactNode;
  copyValue?: string;
  copyLabel?: string;
  short?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cx("outbox", short && "short", className)} style={style}>
      {copyValue != null && <CopyButton text={copyValue} label={copyLabel} corner />}
      {children}
    </div>
  );
}

/* ---------------- Empty state ---------------- */
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <Mascot className="em-mascot" />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
