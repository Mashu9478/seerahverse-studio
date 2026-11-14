"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Captions, Plus, Trash2 } from "lucide-react";
import { wordCount, type Beat } from "@/lib/plan";
import { cx } from "../ui";

export function BeatsEditor({ beats, onChange, speed, fixedCount, labels }: { beats: Beat[]; onChange: (b: Beat[]) => void; speed: number; fixedCount?: number; labels?: string[] }) {
  const [captionOpen, setCaptionOpen] = useState<Record<number, boolean>>({});
  const set = (i: number, patch: Partial<Beat>) => onChange(beats.map((b, k) => (k === i ? { ...b, ...patch } : b)));
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= beats.length) return;
    const c = [...beats];
    [c[i], c[j]] = [c[j], c[i]];
    onChange(c);
  };
  const total = beats.reduce((a, b) => a + wordCount(b.say), 0);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="label mb-0">🗣️ Narration beats</span>
        <span className="text-xs font-bold text-slate-400">
          {total} words · ~{Math.round(total / (2.55 * speed) + beats.reduce((a, b) => a + (b.pause ?? 0) + 0.35, 0))}s
        </span>
      </div>
      <div className="space-y-2.5">
        {beats.map((b, i) => {
          const wc = wordCount(b.say);
          const capOpen = captionOpen[i] || !!b.caption;
          return (
            <div key={i} className="rounded-2xl border-2 border-brand-100 bg-white p-3 focus-within:border-brand-300">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-500 text-xs font-bold text-white">{i + 1}</span>
                {labels?.[i] && <span className="rounded-full bg-sun-soft px-2 py-0.5 text-xs font-bold text-amber-800">{labels[i]}</span>}
                <span className={cx("ml-auto text-xs font-semibold", wc > 30 ? "text-orange-600" : "text-slate-400")}>{wc} words</span>
                <button
                  type="button"
                  title="Different on-screen caption"
                  onClick={() => setCaptionOpen({ ...captionOpen, [i]: !capOpen })}
                  className={cx("rounded-lg p-1.5 hover:bg-brand-50", capOpen ? "text-brand-600" : "text-slate-400")}
                >
                  <Captions className="h-4 w-4" />
                </button>
                {!fixedCount && (
                  <>
                    <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="rounded-lg p-1.5 text-slate-500 hover:bg-brand-50 disabled:opacity-30">
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      disabled={i === beats.length - 1}
                      onClick={() => move(i, 1)}
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-brand-50 disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Delete beat"
                      disabled={beats.length <= 1}
                      onClick={() => onChange(beats.filter((_, k) => k !== i))}
                      className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
              </div>
              <textarea
                className="input min-h-[64px] resize-y text-[15px] leading-relaxed"
                value={b.say}
                onChange={(e) => set(i, { say: e.target.value })}
                aria-label={`Beat ${i + 1} narration`}
                placeholder="What the narrator says…"
              />
              <div className="mt-2 flex flex-wrap items-center gap-3">
                {capOpen && (
                  <input
                    className="input flex-1 py-2 text-sm"
                    placeholder="On-screen caption (leave empty to show the narration)"
                    value={b.caption ?? ""}
                    onChange={(e) => set(i, { caption: e.target.value || undefined })}
                  />
                )}
                <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
                  Pause after
                  <input
                    type="number"
                    min={0}
                    max={4}
                    step={0.1}
                    className="input w-20 py-1.5 text-sm"
                    value={b.pause ?? 0}
                    onChange={(e) => set(i, { pause: Number(e.target.value) || undefined })}
                  />
                  s
                </label>
              </div>
            </div>
          );
        })}
      </div>
      {!fixedCount && (
        <button
          type="button"
          onClick={() => onChange([...beats, { say: "" }])}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl border-2 border-dashed border-brand-200 py-2 text-sm font-bold text-brand-600 hover:border-brand-400 hover:bg-brand-50"
        >
          <Plus className="h-4 w-4" /> Add beat
        </button>
      )}
    </div>
  );
}
