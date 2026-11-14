"use client";

import { motion } from "framer-motion";
import { Clapperboard, Clock3, MessageSquareText, Smartphone, MonitorPlay, Check } from "lucide-react";
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

/* little device mock-ups */
function PhoneMock({ on }: { on: boolean }) {
  return (
    <div className={cx("relative h-[104px] w-[58px] rounded-[14px] border-2 p-1 transition", on ? "border-white/70" : "border-white/20")}>
      <div className="absolute left-1/2 top-1 h-1 w-4 -translate-x-1/2 rounded-full bg-white/30" />
      <div className={cx("h-full w-full overflow-hidden rounded-[10px]", on ? "bg-gradient-to-b from-pink-400/80 via-fuchsia-500/70 to-orange-400/80" : "bg-white/[0.06]")}>
        <div className="mx-auto mt-5 h-5 w-5 rounded-full bg-white/70" />
        <div className="mx-auto mt-2 h-1.5 w-8 rounded-full bg-white/60" />
        <div className="mx-auto mt-1 h-1.5 w-6 rounded-full bg-white/40" />
      </div>
    </div>
  );
}

function ScreenMock({ on }: { on: boolean }) {
  return (
    <div className="flex flex-col items-center">
      <div className={cx("h-[64px] w-[112px] rounded-lg border-2 p-1 transition", on ? "border-white/70" : "border-white/20")}>
        <div className={cx("flex h-full w-full items-center gap-2 overflow-hidden rounded-[5px] px-2", on ? "bg-gradient-to-br from-violet-500/80 via-indigo-500/70 to-cyan-400/80" : "bg-white/[0.06]")}>
          <div className="h-6 w-6 shrink-0 rounded-full bg-white/70" />
          <div className="flex-1 space-y-1">
            <div className="h-1.5 w-full rounded-full bg-white/60" />
            <div className="h-1.5 w-2/3 rounded-full bg-white/40" />
          </div>
        </div>
      </div>
      <div className={cx("h-2 w-1.5 transition", on ? "bg-white/70" : "bg-white/20")} />
      <div className={cx("h-1 w-10 rounded-full transition", on ? "bg-white/70" : "bg-white/20")} />
    </div>
  );
}

export function FormatPicker({ value, onChange, speed = 0.92 }: { value: FormatValue; onChange: (v: FormatValue) => void; speed?: number }) {
  const minutes = Math.round(value.target_seconds / 60);
  const pct = ((minutes - 1) / 19) * 100;
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            {
              id: "short",
              title: "Short",
              sub: "Vertical 9:16 · 15 s – 3 min",
              note: "Hooks fast — perfect for YouTube Shorts & reels",
              grad: "from-pink-500/35 via-fuchsia-500/20 to-orange-400/25",
              glow: "rgba(244,114,182,0.55)",
              icon: Smartphone,
            },
            {
              id: "long",
              title: "Long video",
              sub: "Landscape 16:9 · 1 – 20 min",
              note: "Full lesson with examples, practice & recap",
              grad: "from-violet-500/35 via-indigo-500/20 to-cyan-400/25",
              glow: "rgba(139,92,246,0.6)",
              icon: MonitorPlay,
            },
          ] as const
        ).map((f) => {
          const on = value.format === f.id;
          const Icon = f.icon;
          return (
            <motion.button
              type="button"
              key={f.id}
              whileHover={{ y: -4 }}
              whileTap={{ scale: 0.985 }}
              onClick={() =>
                onChange({
                  format: f.id,
                  target_seconds: f.id === "short" ? (value.format === "short" ? value.target_seconds : 60) : value.format === "long" ? value.target_seconds : 300,
                })
              }
              aria-pressed={on}
              className={cx(
                "group relative flex items-center gap-5 overflow-hidden rounded-3xl border p-5 text-left transition duration-300",
                on ? "border-white/25" : "border-white/[0.08] bg-white/[0.025] hover:border-white/20",
              )}
              style={on ? { boxShadow: `0 24px 60px -24px ${f.glow}` } : undefined}
            >
              {on && <motion.div layoutId="fmt-bg" className={cx("absolute inset-0 bg-gradient-to-br", f.grad)} transition={{ type: "spring", stiffness: 300, damping: 30 }} />}
              <div className="relative grid h-28 w-28 shrink-0 place-items-center">{f.id === "short" ? <PhoneMock on={on} /> : <ScreenMock on={on} />}</div>
              <div className="relative min-w-0">
                <div className="flex items-center gap-2">
                  <Icon className={cx("h-4 w-4", on ? "text-fg" : "text-fg-subtle")} />
                  <span className="font-display text-xl font-semibold text-fg">{f.title}</span>
                </div>
                <div className="mt-0.5 text-sm text-fg-muted">{f.sub}</div>
                <div className="mt-2 text-xs text-fg-subtle">{f.note}</div>
              </div>
              {on && (
                <span className="absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full bg-white text-[#0B0A13]">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {value.format === "short" ? (
        <div className="panel p-4">
          <span className="label">How long should the Short be?</span>
          <div className="flex flex-wrap gap-2">
            {SHORT_DURATIONS.map((s) => (
              <Chip key={s} color="rose" active={value.target_seconds === s} onClick={() => onChange({ ...value, target_seconds: s })}>
                <Clock3 className="h-3.5 w-3.5" /> {s < 60 ? `${s}s` : `${s / 60} min`}
              </Chip>
            ))}
          </div>
          <p className="hint">YouTube Shorts can be up to 3 minutes. 30–60 seconds works best for most topics — the narration is tightened to fit exactly.</p>
        </div>
      ) : (
        <div className="panel p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="label !mb-0">How long should the video be?</span>
            <motion.span
              key={minutes}
              initial={{ scale: 0.8, opacity: 0.4 }}
              animate={{ scale: 1, opacity: 1 }}
              className="rounded-lg bg-brand-grad px-3 py-0.5 font-display text-lg font-semibold text-white shadow-pop tabular-nums"
            >
              {minutes} min
            </motion.span>
          </div>
          <div className="relative h-7">
            <div className="absolute top-1/2 h-2 w-full -translate-y-1/2 rounded-full bg-white/[0.08]" />
            <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-brand-grad shadow-[0_0_14px_rgba(139,92,246,0.6)]" style={{ width: `${pct}%` }} />
            <div
              className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-bg-elev shadow-[0_0_0_4px_rgba(139,92,246,0.3)]"
              style={{ left: `${pct}%` }}
            />
            <input
              type="range"
              min={1}
              max={20}
              step={1}
              value={minutes}
              onChange={(e) => onChange({ ...value, target_seconds: parseInt(e.target.value, 10) * 60 })}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Video length in minutes"
            />
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-fg-subtle">
            <span>1 min</span>
            <span>5</span>
            <span>10</span>
            <span>15</span>
            <span>20 min</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[3, 5, 8, 10, 15].map((m) => (
              <Chip key={m} active={minutes === m} onClick={() => onChange({ ...value, target_seconds: m * 60 })}>
                {m} min
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        {[
          { k: "Length", v: fmtDuration(value.target_seconds), icon: Clock3, tone: "text-cyan-300 bg-cyan-400/10" },
          { k: "Scenes", v: `~${suggestedSceneCount(value.target_seconds, value.format)}`, icon: Clapperboard, tone: "text-violet-300 bg-violet-500/10" },
          { k: "Spoken words", v: `~${targetWords(value.target_seconds, speed)}`, icon: MessageSquareText, tone: "text-pink-300 bg-pink-500/10" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.k} className="card relative overflow-hidden p-4">
              <span className={cx("grid h-8 w-8 place-items-center rounded-lg", s.tone)}>
                <Icon className="h-4 w-4" />
              </span>
              <motion.div key={s.v} initial={{ y: 6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mt-2 font-display text-2xl font-semibold text-fg tabular-nums">
                {s.v}
              </motion.div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{s.k}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
