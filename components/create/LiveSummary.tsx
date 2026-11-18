"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Clapperboard, Clock3, ImageIcon, Languages, Mic2, Music2, Smartphone, MonitorPlay } from "lucide-react";
import { AGE_GROUPS, MUSIC, SUBJECTS, VOICES, characterById } from "@/lib/constants";
import { fmtDuration } from "@/lib/plan";
import type { StyleValue } from "../StylePanel";
import type { FormatValue } from "../FormatPicker";
import { cx } from "../ui";
import { LanguageChip, URDU_FONT } from "../LanguagePicker";

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.05] text-fg-muted">{icon}</span>
      <span className="text-xs text-fg-subtle">{label}</span>
      <span className="ml-auto truncate text-right text-[13px] font-semibold text-fg">{value}</span>
    </div>
  );
}

/** Sticky "what you're making" card shown next to the wizard on large screens. */
export function LiveSummary({
  topic,
  subject,
  age,
  images,
  fmt,
  style,
}: {
  topic: string;
  subject: string;
  age: string;
  images: number;
  fmt: FormatValue;
  style: StyleValue | null;
}) {
  const presenter = characterById(style?.presenter || (style?.mascot === false ? "none" : "ollie"));
  const explainer = style?.style === "explainer" || style?.language === "ur";
  const voice = VOICES.find((v) => v.id === style?.voice);
  const music = MUSIC.find((m) => m.id === style?.music);
  const subj = SUBJECTS.find((s) => s.id === subject);
  const ageG = AGE_GROUPS.find((a) => a.id === age);
  return (
    <div className="card relative overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full blur-3xl" style={{ background: explainer ? "#22D3EE44" : `${presenter.color}55` }} />
      <div className="relative">
        <div className="eyebrow">Live preview</div>
        <div className="mt-4 flex items-center gap-4">
          <div className="relative grid h-24 w-24 shrink-0 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.01]">
            <AnimatePresence mode="wait">
              {explainer ? (
                <motion.span
                  key="explainer"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  className="text-5xl"
                >
                  🔬
                </motion.span>
              ) : (
              <motion.img
                key={presenter.id}
                src={presenter.img}
                alt={presenter.name}
                initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="h-20 w-20 animate-floaty object-contain drop-shadow-[0_12px_20px_rgba(0,0,0,0.6)]"
              />
              )}
            </AnimatePresence>
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{explainer ? "Video style" : "Presented by"}</div>
            <div className="font-display text-base font-semibold text-fg">{explainer ? "Diagram explainer" : presenter.id === "none" ? "No character" : presenter.name}</div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/20 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Lesson</div>
          <div
            dir="auto"
            className={cx("mt-1 line-clamp-3 font-display text-lg font-semibold leading-snug", topic.trim() ? "text-fg" : "text-fg-subtle")}
            style={/[\u0600-\u06FF]/.test(topic) ? { fontFamily: URDU_FONT, lineHeight: 1.9 } : undefined}
          >
            {topic.trim() || (images ? "From your textbook pages" : "Your topic appears here…")}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
            <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-violet-300 ring-1 ring-violet-400/20">
              {subj?.emoji} {subject}
            </span>
            <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-amber-300 ring-1 ring-amber-400/20">
              {ageG?.emoji} {ageG?.label ?? age}
            </span>
          </div>
        </div>

        <div className="mt-3 divide-y divide-white/[0.06]">
          <Row
            icon={fmt.format === "short" ? <Smartphone className="h-4 w-4" /> : <MonitorPlay className="h-4 w-4" />}
            label="Format"
            value={fmt.format === "short" ? "Short · 9:16" : "Long · 16:9"}
          />
          <Row icon={<Languages className="h-4 w-4" />} label="Language" value={<LanguageChip value={style?.language} />} />
          <Row icon={<Clapperboard className="h-4 w-4" />} label="Style" value={explainer ? "🔬 Diagram explainer" : "🎭 Character presenter"} />
          <Row icon={<Clock3 className="h-4 w-4" />} label="Length" value={fmtDuration(fmt.target_seconds)} />
          <Row icon={<Mic2 className="h-4 w-4" />} label="Voice" value={voice ? `${voice.emoji} ${voice.name}` : "—"} />
          <Row icon={<Music2 className="h-4 w-4" />} label="Sound" value={music ? `${music.emoji} ${music.name}` : "—"} />
          <Row icon={<ImageIcon className="h-4 w-4" />} label="Textbook pages" value={images ? `${images} attached` : "None"} />
        </div>
      </div>
    </div>
  );
}
