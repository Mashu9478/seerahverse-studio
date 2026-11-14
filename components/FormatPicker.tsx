"use client";

import { motion } from "framer-motion";
import { SHORT_DURATIONS } from "@/lib/constants";
import { fmtDuration, suggestedSceneCount, targetWords } from "@/lib/plan";
import { Chip, cx } from "./ui";

export interface FormatValue {
  format: "long" | "short";
  target_seconds: number;
}

export function durationLabel(f: FormatValue) {
  return f.format === "short" ? `${f.target_seconds}s Short` : `${Math.round(f.target_seconds / 60)} min video`;
}

export function FormatPicker({ value, onChange, speed = 0.92 }: { value: FormatValue; onChange: (v: FormatValue) => void; speed?: number }) {
  const minutes = Math.round(value.target_seconds / 60);
  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            { id: "short", title: "Short", sub: "Vertical 9:16 · up to 3 min", emoji: "📱", grad: "from-rose to-orange" },
            { id: "long", title: "Long video", sub: "Landscape 16:9 · 1–20 min", emoji: "🖥️", grad: "from-brand-500 to-sky" },
          ] as const
        ).map((f) => {
          const on = value.format === f.id;
          return (
            <motion.button
              type="button"
              key={f.id}
              whileHover={{ y: -3 }}
              whileTap={{ scale: 0.98 }}
              onClick={() =>
                onChange({ format: f.id, target_seconds: f.id === "short" ? (value.format === "short" ? value.target_seconds : 60) : value.format === "long" ? value.target_seconds : 300 })
              }
              className={cx(
                "relative flex items-center gap-4 overflow-hidden rounded-3xl border-2 p-5 text-left transition",
                on ? "border-transparent text-white shadow-pop" : "border-brand-100 bg-white hover:border-brand-300",
              )}
            >
              {on && <motion.div layoutId="fmt-bg" className={cx("absolute inset-0 bg-gradient-to-br", f.grad)} />}
              <div className={cx("relative grid place-items-center rounded-2xl text-4xl", f.id === "short" ? "h-20 w-12" : "h-12 w-20", on ? "bg-white/25" : "bg-brand-50")}>
                {f.emoji}
              </div>
              <div className="relative">
                <div className="font-display text-2xl font-semibold">{f.title}</div>
                <div className={cx("text-sm", on ? "text-white/90" : "text-slate-500")}>{f.sub}</div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {value.format === "short" ? (
        <div>
          <span className="label">How long should the Short be?</span>
          <div className="flex flex-wrap gap-2">
            {SHORT_DURATIONS.map((s) => (
              <Chip key={s} color="rose" active={value.target_seconds === s} onClick={() => onChange({ ...value, target_seconds: s })}>
                ⏱️ {s < 60 ? `${s}s` : `${s / 60} min`}
              </Chip>
            ))}
          </div>
          <p className="hint">YouTube Shorts can be up to 3 minutes. 30–60 seconds works best for most topics.</p>
        </div>
      ) : (
        <div className="max-w-xl">
          <div className="flex items-center justify-between">
            <span className="label">How long should the video be?</span>
            <span className="rounded-full bg-brand-500 px-3 py-0.5 font-display text-lg font-semibold text-white">{minutes} min</span>
          </div>
          <input
            type="range"
            min={1}
            max={20}
            step={1}
            value={minutes}
            onChange={(e) => onChange({ ...value, target_seconds: parseInt(e.target.value, 10) * 60 })}
            className="w-full"
            aria-label="Video length in minutes"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>1 min</span>
            <span>5</span>
            <span>10</span>
            <span>15</span>
            <span>20 min</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { k: "Length", v: fmtDuration(value.target_seconds), e: "⏱️" },
          { k: "Scenes", v: `~${suggestedSceneCount(value.target_seconds, value.format)}`, e: "🎬" },
          { k: "Spoken words", v: `~${targetWords(value.target_seconds, speed)}`, e: "🗣️" },
        ].map((s) => (
          <div key={s.k} className="rounded-2xl bg-brand-50 p-3 text-center">
            <div className="text-xl">{s.e}</div>
            <div className="font-display text-xl font-semibold text-brand-700">{s.v}</div>
            <div className="text-xs font-bold text-slate-500">{s.k}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
