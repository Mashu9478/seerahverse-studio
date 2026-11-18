"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { LANGUAGES, type LanguageId } from "@/lib/constants";
import { cx } from "./ui";

export const URDU_FONT = '"Noto Nastaliq Urdu", "Jameel Noori Nastaleeq", "Urdu Typesetting", serif';

/** Choose the language of the narration and on-screen text. */
export function LanguagePicker({ value, onChange }: { value: LanguageId; onChange: (v: LanguageId) => void }) {
  return (
    <div role="radiogroup" aria-label="Video language" className="grid gap-3 sm:grid-cols-2">
      {LANGUAGES.map((l) => {
        const on = value === l.id;
        const color = l.id === "ur" ? "#34D399" : "#A78BFA";
        return (
          <motion.button
            key={l.id}
            type="button"
            role="radio"
            aria-checked={on}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onChange(l.id)}
            className={cx(
              "group relative flex items-center gap-4 overflow-hidden rounded-2xl border p-4 text-left transition duration-300",
              on ? "border-transparent bg-white/[0.07]" : "border-white/[0.08] bg-white/[0.025] hover:border-white/20",
            )}
            style={on ? { boxShadow: `0 0 0 1.5px ${color}, 0 18px 50px -20px ${color}` } : undefined}
          >
            <span
              className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-25 blur-2xl transition group-hover:opacity-50"
              style={{ background: color }}
            />
            <span
              className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-white/[0.06] ring-1 ring-inset ring-white/10"
              style={{ color }}
            >
              {l.id === "ur" ? (
                <span dir="rtl" lang="ur" className="text-[26px] leading-none" style={{ fontFamily: URDU_FONT }}>
                  ا
                </span>
              ) : (
                <span className="font-display text-xl font-semibold">Aa</span>
              )}
            </span>
            <span className="relative min-w-0 flex-1">
              <span className="flex items-baseline gap-2">
                {l.id === "ur" ? (
                  <>
                    <span dir="rtl" lang="ur" className="text-[22px] font-semibold leading-[1.9] text-fg" style={{ fontFamily: URDU_FONT }}>
                      {l.native}
                    </span>
                    <span className="font-display text-[15px] font-semibold text-fg-muted">{l.name}</span>
                  </>
                ) : (
                  <span className="font-display text-[15px] font-semibold text-fg">{l.name}</span>
                )}
              </span>
              <span className="mt-0.5 block text-xs leading-relaxed text-fg-subtle">{l.note}</span>
            </span>
            {on && (
              <span className="absolute right-4 top-4 grid h-6 w-6 place-items-center rounded-full text-[#0B0A13]" style={{ background: color }}>
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

/** Small chip showing the chosen language. */
export function LanguageChip({ value, className }: { value?: string | null; className?: string }) {
  const ur = value === "ur";
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1",
        ur ? "bg-emerald-400/15 text-emerald-200 ring-emerald-400/30" : "bg-white/[0.06] text-fg-muted ring-white/10",
        className,
      )}
    >
      {ur ? (
        <span dir="rtl" lang="ur" style={{ fontFamily: URDU_FONT }} className="text-[13px] leading-none">
          اردو
        </span>
      ) : (
        "English"
      )}
    </span>
  );
}
