"use client";

import { useState } from "react";
import { Copy, Hash, Tag, X } from "lucide-react";
import { toast } from "sonner";
import type { YoutubeMeta } from "@/lib/plan";
import { cx } from "../ui";
import { AutoTextarea } from "./fields";

function ChipInput({
  items,
  onChange,
  placeholder,
  prefix,
  icon,
}: {
  items: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  prefix?: string;
  icon: React.ReactNode;
}) {
  const [draft, setDraft] = useState("");
  function add(raw: string) {
    const parts = raw
      .split(prefix ? /[\s,]+/ : /,/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (prefix && !t.startsWith(prefix) ? prefix + t : t));
    if (!parts.length) return;
    onChange(Array.from(new Set([...items, ...parts])));
    setDraft("");
  }
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.04] p-2 transition focus-within:border-brand-400/70 focus-within:ring-4 focus-within:ring-brand-500/20">
      <div className="flex flex-wrap gap-1.5">
        {items.map((t) => (
          <span
            key={t}
            className="group inline-flex items-center gap-1 rounded-lg bg-white/[0.07] py-1 pl-2 pr-1 text-xs font-semibold text-fg ring-1 ring-inset ring-white/10"
          >
            {t}
            <button
              type="button"
              aria-label={`Remove ${t}`}
              onClick={() => onChange(items.filter((x) => x !== t))}
              className="rounded p-0.5 text-fg-subtle transition hover:bg-white/10 hover:text-fg"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <span className="flex min-w-[140px] flex-1 items-center gap-1.5 px-1">
          <span className="text-fg-subtle">{icon}</span>
          <input
            className="w-full bg-transparent py-1 text-sm text-fg outline-none placeholder:text-fg-subtle"
            value={draft}
            placeholder={placeholder}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === "," || (prefix && e.key === " ")) {
                e.preventDefault();
                add(draft);
              } else if (e.key === "Backspace" && !draft && items.length) {
                onChange(items.slice(0, -1));
              }
            }}
            onBlur={() => add(draft)}
            onPaste={(e) => {
              const t = e.clipboardData.getData("text");
              if (/[,\n]/.test(t)) {
                e.preventDefault();
                add(t.replace(/\n/g, ","));
              }
            }}
          />
        </span>
      </div>
    </div>
  );
}

export function YoutubePanel({ value, onChange }: { value: YoutubeMeta; onChange: (v: YoutubeMeta) => void }) {
  const len = value.title.length;
  const copy = (text: string, what: string) =>
    navigator.clipboard.writeText(text).then(
      () => toast.success(`${what} copied`),
      () => toast.error("Couldn't copy"),
    );
  return (
    <div className="space-y-5">
      <label className="block">
        <span className="label flex items-center justify-between">
          Title
          <span className={cx("normal-case tracking-normal tabular-nums", len > 70 ? "text-amber-600" : "text-fg-subtle", len > 100 && "text-red-600")}>
            {len}/70
          </span>
        </span>
        <div className="relative">
          <input className="input pr-10 font-display font-semibold" value={value.title} onChange={(e) => onChange({ ...value, title: e.target.value })} />
          <button
            type="button"
            onClick={() => copy(value.title, "Title")}
            aria-label="Copy title"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-fg-subtle hover:bg-white/10 hover:text-fg"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={cx("h-full rounded-full transition-all", len > 100 ? "bg-red-500" : len > 70 ? "bg-amber-400" : "bg-emerald-400")}
            style={{ width: `${Math.min(100, (len / 100) * 100)}%` }}
          />
        </div>
        <span className="hint block">Up to ~70 characters shows in full on most screens.</span>
      </label>

      <label className="block">
        <span className="label flex items-center justify-between">
          Description
          <button type="button" onClick={() => copy(value.description, "Description")} className="flex items-center gap-1 normal-case tracking-normal text-fg-subtle hover:text-fg">
            <Copy className="h-3 w-3" /> Copy
          </button>
        </span>
        <AutoTextarea className="min-h-[180px] text-sm leading-relaxed" value={value.description} onChange={(e) => onChange({ ...value, description: e.target.value })} />
      </label>

      <div>
        <span className="label flex items-center justify-between">
          Tags <span className="normal-case tracking-normal text-fg-subtle">{value.tags.length} · Enter or comma to add</span>
        </span>
        <ChipInput items={value.tags} onChange={(tags) => onChange({ ...value, tags })} placeholder="Add a tag…" icon={<Tag className="h-3.5 w-3.5" />} />
      </div>

      <div>
        <span className="label">Hashtags</span>
        <ChipInput
          items={value.hashtags}
          onChange={(hashtags) => onChange({ ...value, hashtags })}
          placeholder="#Shorts"
          prefix="#"
          icon={<Hash className="h-3.5 w-3.5" />}
        />
      </div>
    </div>
  );
}
