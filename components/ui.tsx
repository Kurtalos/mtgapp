"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "mana" | "violet" | "amber" | "danger" | "info";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral: "bg-white/5 text-slate-300 border-white/10",
    mana: "bg-mana/10 text-mana border-mana/30",
    violet: "bg-violet/10 text-violet border-violet/30",
    amber: "bg-amber/10 text-amber border-amber/30",
    danger: "bg-danger/10 text-danger border-danger/30",
    info: "bg-sky-400/10 text-sky-300 border-sky-400/30",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`animate-rise card max-h-[92vh] w-full overflow-y-auto rounded-b-none p-5 shadow-2xl scrollbar-thin sm:rounded-b-2xl ${
          wide ? "sm:max-w-lg" : "sm:max-w-sm"
        }`}
        style={{ paddingBottom: "calc(1.25rem + var(--sab))" }}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h2 className="text-base font-extrabold tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:bg-white/5 hover:text-white"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex gap-1 rounded-xl bg-surface-2 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`flex-1 rounded-lg px-2 py-2 text-xs font-extrabold uppercase tracking-wide transition-colors ${
            value === option.value
              ? "bg-mana text-black"
              : "text-slate-400 hover:text-white"
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "danger" | "mana" | "violet";
}) {
  const toneClass =
    tone === "danger"
      ? "text-danger"
      : tone === "mana"
        ? "text-mana"
        : tone === "violet"
          ? "text-violet"
          : "text-white";
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-center">
      <div className={`tnum text-lg font-black leading-tight ${toneClass}`}>
        {value}
      </div>
      <div className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </div>
    </div>
  );
}
