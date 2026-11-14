"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import type { Beat } from "@/lib/plan";
import { cx } from "../ui";

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
      <span className="label flex justify-between">
        <span>{label}</span>
        {max && <span className={cx("text-xs font-semibold", len > max ? "text-red-500" : "text-slate-400")}>{len}/{max}</span>}
      </span>
      <input className={cx("input", big && "text-lg font-semibold")} value={value ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function NumIn({ label, value, onChange, min, max, step = 1, className }: { label: string; value: number | undefined; onChange: (v: number) => void; min?: number; max?: number; step?: number; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="label">{label}</span>
      <input
        type="number"
        className="input"
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
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-50 text-2xl">{value || "❔"}</span>
        <input className="input w-20 text-center text-xl" value={value ?? ""} onChange={(e) => onChange(e.target.value)} aria-label={label} />
      </div>
    </label>
  );
}

export function SelectIn<T extends string>({ label, value, options, onChange, className }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <label className={cx("block", className)}>
      <span className="label">{label}</span>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
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
  const words = at !== undefined && beats[at] ? Array.from(new Set(beats[at].say.split(/\s+/).map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, "")).filter(Boolean))) : [];
  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="block min-w-[160px] flex-1">
        <span className="label">{label}</span>
        <select
          className="input py-2 text-sm"
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
          <select className="input py-2 text-sm" value={word ?? ""} onChange={(e) => onChange(at, e.target.value || undefined)}>
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
        <span className="text-xs text-slate-400">
          {items.length}/{max}
        </span>
      </div>
      <div className="space-y-2.5">
        {items.map((it, i) => (
          <div key={i} className="flex gap-2 rounded-2xl border-2 border-brand-100 bg-white p-3">
            <div className="min-w-0 flex-1">{render(it, (v) => onChange(items.map((x, k) => (k === i ? v : x))), i)}</div>
            <div className="flex flex-col gap-0.5">
              <button type="button" aria-label="Move up" onClick={() => move(i, -1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-brand-50 disabled:opacity-30" disabled={i === 0}>
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="Move down"
                onClick={() => move(i, 1)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-brand-50 disabled:opacity-30"
                disabled={i === items.length - 1}
              >
                <ArrowDown className="h-4 w-4" />
              </button>
              <button type="button" aria-label="Remove" onClick={() => onChange(items.filter((_, k) => k !== i))} className="rounded-lg p-1.5 text-red-500 hover:bg-red-50">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
      {items.length < max && (
        <button
          type="button"
          onClick={() => onChange([...items, make()])}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-brand-200 py-2 text-sm font-bold text-brand-600 hover:border-brand-400 hover:bg-brand-50"
        >
          <Plus className="h-4 w-4" /> {addLabel}
        </button>
      )}
    </div>
  );
}
