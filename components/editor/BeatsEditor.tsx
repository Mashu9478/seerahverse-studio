"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, ArrowUp, Captions, Mic, Plus, Timer, Trash2 } from "lucide-react";
import { wordCount, type Beat } from "@/lib/plan";
import { cx } from "../ui";
import { AutoTextarea } from "./fields";

const miniBtn =
  "grid h-7 w-7 place-items-center rounded-lg text-fg-subtle transition hover:bg-white/[0.08] hover:text-fg disabled:pointer-events-none disabled:opacity-25";

export function BeatsEditor({
  beats,
  onChange,
  speed,
  fixedCount,
  labels,
}: {
  beats: Beat[];
  onChange: (b: Beat[]) => void;
  speed: number;
  fixedCount?: number;
  labels?: string[];
}) {
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
  const secs = Math.round(total / (2.55 * speed) + beats.reduce((a, b) => a + (b.pause ?? 0) + 0.35, 0));

  function addAfter(i: number) {
    const c = [...beats];
    c.splice(i + 1, 0, { say: "" });
    onChange(c);
    // focus the new beat on the next frame
    requestAnimationFrame(() => document.getElementById(`beat-say-${i + 1}`)?.focus());
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-display text-sm font-semibold text-fg">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-500/15 text-brand-300">
            <Mic className="h-3.5 w-3.5" />
          </span>
          Narration beats
        </span>
        <span className="flex items-center gap-3 text-[11px] font-semibold text-fg-subtle">
          <span className="rounded-full bg-white/[0.05] px-2 py-0.5 tabular-nums">{beats.length} beats</span>
          <span className="rounded-full bg-white/[0.05] px-2 py-0.5 tabular-nums">{total} words</span>
          <span className="flex items-center gap-1 rounded-full bg-cyan-400/10 px-2 py-0.5 tabular-nums text-cyan-300">
            <Timer className="h-3 w-3" />~{secs}s
          </span>
        </span>
      </div>

      <div className="relative space-y-2.5">
        {/* timeline rail */}
        <span aria-hidden className="absolute bottom-4 left-[17px] top-4 w-px bg-gradient-to-b from-brand-400/40 via-white/10 to-transparent" />
        <AnimatePresence initial={false}>
          {beats.map((b, i) => {
            const wc = wordCount(b.say);
            const capOpen = captionOpen[i] || !!b.caption;
            return (
              <motion.div
                key={i}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="group/beat relative flex gap-3"
              >
                <span className="relative z-10 mt-2.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/15 bg-bg-elev font-display text-xs font-bold text-fg shadow-[0_0_0_4px_rgba(6,6,11,1)] group-focus-within/beat:border-brand-400 group-focus-within/beat:bg-brand-500 group-focus-within/beat:shadow-[0_0_18px_-2px_rgba(139,92,246,0.9),0_0_0_4px_rgba(6,6,11,1)]">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 transition group-focus-within/beat:border-brand-400/40 group-focus-within/beat:bg-white/[0.04] hover:border-white/15">
                  <div className="mb-2 flex items-center gap-1.5">
                    {labels?.[i] && (
                      <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-300 ring-1 ring-amber-400/25">{labels[i]}</span>
                    )}
                    <span className={cx("text-[11px] font-semibold tabular-nums", wc > 30 ? "text-orange" : "text-fg-subtle")}>
                      {wc} words{wc > 30 ? " · a bit long" : ""}
                    </span>
                    <div className="ml-auto flex items-center gap-0.5">
                      <button
                        type="button"
                        title="Different on-screen caption"
                        aria-label="Toggle caption"
                        onClick={() => setCaptionOpen({ ...captionOpen, [i]: !capOpen })}
                        className={cx(miniBtn, capOpen && "bg-brand-500/15 text-brand-300")}
                      >
                        <Captions className="h-3.5 w-3.5" />
                      </button>
                      {!fixedCount && (
                        <>
                          <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className={miniBtn}>
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                          <button type="button" aria-label="Move down" disabled={i === beats.length - 1} onClick={() => move(i, 1)} className={miniBtn}>
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete beat"
                            disabled={beats.length <= 1}
                            onClick={() => onChange(beats.filter((_, k) => k !== i))}
                            className={cx(miniBtn, "hover:bg-red-100 hover:text-red-600")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                  <AutoTextarea
                    id={`beat-say-${i}`}
                    className="min-h-[56px] text-[15px] leading-relaxed"
                    value={b.say}
                    onChange={(e) => set(i, { say: e.target.value })}
                    onKeyDown={(e) => {
                      if (!fixedCount && e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        addAfter(i);
                      }
                    }}
                    aria-label={`Beat ${i + 1} narration`}
                    placeholder="What the narrator says…"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <AnimatePresence>
                      {capOpen && (
                        <motion.input
                          initial={{ opacity: 0, width: "40%" }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0 }}
                          className="input min-w-[200px] flex-1 py-2 text-sm"
                          placeholder="On-screen caption (leave empty to show the narration)"
                          value={b.caption ?? ""}
                          onChange={(e) => set(i, { caption: e.target.value || undefined })}
                        />
                      )}
                    </AnimatePresence>
                    <label className="ml-auto flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
                      Pause
                      <input
                        type="number"
                        min={0}
                        max={4}
                        step={0.1}
                        className="input w-20 py-1.5 text-sm tabular-nums"
                        value={b.pause ?? 0}
                        onChange={(e) => set(i, { pause: Number(e.target.value) || undefined })}
                      />
                      s
                    </label>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      {!fixedCount && (
        <div className="mt-3 flex items-center gap-3 pl-12">
          <button
            type="button"
            onClick={() => addAfter(beats.length - 1)}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl border border-dashed border-white/15 py-2.5 text-[13px] font-semibold text-fg-muted transition hover:border-brand-400/50 hover:bg-brand-500/[0.07] hover:text-brand-800"
          >
            <Plus className="h-4 w-4" /> Add beat
          </button>
          <span className="hidden text-[11px] text-fg-subtle sm:block">
            <kbd className="rounded border border-white/15 bg-white/[0.05] px-1.5 py-0.5 font-sans">Ctrl</kbd> +{" "}
            <kbd className="rounded border border-white/15 bg-white/[0.05] px-1.5 py-0.5 font-sans">Enter</kbd> adds a beat
          </span>
        </div>
      )}
    </div>
  );
}
