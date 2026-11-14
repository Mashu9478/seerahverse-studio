"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useLayoutEffect, useRef, type ReactNode, type TextareaHTMLAttributes } from "react";
import type { Beat } from "@/lib/plan";
import { cx } from "../ui";

/** Textarea that grows with its content. */
export function AutoTextarea({ className, value, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return <textarea ref={ref} value={value} rows={2} className={cx("input resize-none overflow-hidden", className)} {...rest} />;
}

function Counter({ len, max }: { len: number; max: number }) {
  const pct = Math.min(1, len / max);
  const over = len > max;
  return (
    <span className="flex items-center gap-1.5 normal-case tracking-normal">
      <span className="relative h-1 w-10 overflow-hidden rounded-full bg-white/10">
        <span
          className={cx("absolute inset-y-0 left-0 rounded-full", over ? "bg-red-500" : pct > 0.85 ? "bg-amber-400" : "bg-brand-400")}
          style={{ width: `${pct * 100}%` }}
        />
      </span>
      <span className={cx("text-[11px] font-semibold tabular-nums", over ? "text-red-600" : "text-fg-subtle")}>
        {len}/{max}
      </span>
    </span>
  );
}

export function TextIn({
  label,
  value,
  onChange,
  max,
  placeholder,
  className,
  big,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  max?: number;
  placeholder?: string;
  className?: string;
  big?: boolean;
}) {
  const len = (value ?? "").length;
  return (
    <label className={cx("block", className)}>
      <span className="label flex items-center justify-between gap-2">
        <span>{label}</span>
        {max && <Counter len={len} max={max} />}
      </span>
      <input
        className={cx("input", big && "font-display text-lg font-semibold", !!max && len > max && "border-red-500/60 focus:border-red-500/80")}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function NumIn({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  className,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="label">{label}</span>
      <input
        type="number"
        className="input tabular-nums"
        value={value ?? ""}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
      />
    </label>
  );
}

export function EmojiIn({ label = "Emoji", value, onChange, className }: { label?: string; value: string | undefined; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="label">{label}</span>
      <div className="flex items-center gap-2">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.1] to-white/[0.02] text-2xl">
          {value || "❔"}
        </span>
        <input className="input w-20 text-center text-xl" value={value ?? ""} onChange={(e) => onChange(e.target.value)} aria-label={label} />
      </div>
    </label>
  );
}

export function SelectIn<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <label className={cx("block", className)}>
      <span className="label">{label}</span>
      <select className="input cursor-pointer" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Choose the beat (and optionally a word in it) when an element appears. */
export function AtPicker({
  beats,
  at,
  word,
  onChange,
  label = "Appears on",
  noWord,
}: {
  beats: Beat[];
  at: number | undefined;
  word?: string;
  onChange: (at: number | undefined, word?: string) => void;
  label?: string;
  noWord?: boolean;
}) {
  const words =
    at !== undefined && beats[at]
      ? Array.from(new Set(beats[at].say.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, "")).filter(Boolean)))
      : [];
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block min-w-[160px] flex-1">
        <span className="label">{label}</span>
        <select
          className="input cursor-pointer py-2 text-sm"
          value={at === undefined ? "" : String(at)}
          onChange={(e) => onChange(e.target.value === "" ? undefined : parseInt(e.target.value, 10), undefined)}
        >
          <option value="">Scene start</option>
          {beats.map((b, i) => (
            <option key={i} value={i}>
              Beat {i + 1}: {b.say.slice(0, 40)}
              {b.say.length > 40 ? "…" : ""}
            </option>
          ))}
        </select>
      </label>
      {!noWord && at !== undefined && (
        <label className="block w-36">
          <span className="label">…on the word</span>
          <select className="input cursor-pointer py-2 text-sm" value={word ?? ""} onChange={(e) => onChange(at, e.target.value || undefined)}>
            <option value="">(start of beat)</option>
            {words.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

const miniBtn =
  "grid h-7 w-7 place-items-center rounded-lg text-fg-subtle transition hover:bg-white/[0.08] hover:text-fg disabled:pointer-events-none disabled:opacity-25";

/** Generic list editor with add / remove / reorder. */
export function ListEditor<T>({
  title,
  items,
  onChange,
  make,
  render,
  max = 10,
  addLabel = "Add",
}: {
  title: string;
  items: T[];
  onChange: (v: T[]) => void;
  make: () => T;
  render: (item: T, set: (v: T) => void, i: number) => ReactNode;
  max?: number;
  addLabel?: string;
}) {
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= items.length) return;
    const c = [...items];
    [c[i], c[j]] = [c[j], c[i]];
    onChange(c);
  };
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label mb-0">{title}</span>
        <span className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-fg-subtle">
          {items.length}/{max}
        </span>
      </div>
      <div className="space-y-2.5">
        {items.map((it, i) => (
          <div
            key={i}
            className="group/item flex gap-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 transition focus-within:border-brand-400/40 focus-within:bg-white/[0.04] hover:border-white/15"
          >
            <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/[0.06] text-[11px] font-bold text-fg-muted">{i + 1}</span>
            <div className="min-w-0 flex-1">{render(it, (v) => onChange(items.map((x, k) => (k === i ? v : x))), i)}</div>
            <div className="flex flex-col gap-0.5 opacity-60 transition group-hover/item:opacity-100 group-focus-within/item:opacity-100">
              <button type="button" aria-label="Move up" onClick={() => move(i, -1)} className={miniBtn} disabled={i === 0}>
                <ArrowUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" aria-label="Move down" onClick={() => move(i, 1)} className={miniBtn} disabled={i === items.length - 1}>
                <ArrowDown className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                aria-label="Remove"
                onClick={() => onChange(items.filter((_, k) => k !== i))}
                className={cx(miniBtn, "hover:bg-red-100 hover:text-red-600")}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {items.length < max && (
        <button
          type="button"
          onClick={() => onChange([...items, make()])}
          className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 py-2.5 text-[13px] font-semibold text-fg-muted transition hover:border-brand-400/50 hover:bg-brand-500/[0.07] hover:text-brand-800"
        >
          <Plus className="h-4 w-4" /> {addLabel}
        </button>
      )}
    </div>
  );
}
