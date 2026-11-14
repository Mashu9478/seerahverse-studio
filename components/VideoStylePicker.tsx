"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { VIDEO_STYLES, type VideoStyle } from "@/lib/plan";
import { cx } from "./ui";

/** Tiny illustration: a character next to an emoji card. */
function PresenterHint() {
  return (
    <svg viewBox="0 0 120 72" className="h-full w-full" aria-hidden>
      <rect x="2" y="2" width="116" height="68" rx="12" fill="#1B1830" />
      <circle cx="34" cy="38" r="17" fill="#8B5CF6" />
      <circle cx="28" cy="34" r="5" fill="#fff" />
      <circle cx="40" cy="34" r="5" fill="#fff" />
      <circle cx="29" cy="35" r="2.4" fill="#1A1033" />
      <circle cx="41" cy="35" r="2.4" fill="#1A1033" />
      <path d="M31 44h6l-3 4z" fill="#FBBF24" />
      <rect x="60" y="18" width="48" height="36" rx="8" fill="#ffffff" opacity="0.92" />
      <text x="84" y="42" textAnchor="middle" fontSize="18">🍎</text>
    </svg>
  );
}

/** Tiny illustration: a cut-away plant with a label and flowing water dots. */
function ExplainerHint() {
  return (
    <svg viewBox="0 0 120 72" className="h-full w-full" aria-hidden>
      <rect x="2" y="2" width="116" height="68" rx="12" fill="#EEF2F4" />
      <rect x="2" y="44" width="116" height="26" fill="#CFA97C" />
      <rect x="2" y="42" width="116" height="4" fill="#8CC152" />
      <rect x="57" y="14" width="7" height="31" rx="3" fill="#6DB54F" />
      <rect x="59.5" y="17" width="2" height="27" fill="#E7F5FF" />
      <path d="M60 30 C 50 24, 42 24, 36 27 C 44 32, 52 32, 60 30Z" fill="#7CC86A" stroke="#3E7B2B" strokeWidth="1" />
      <path d="M61 22 C 70 16, 78 16, 84 19 C 76 24, 68 24, 61 22Z" fill="#7CC86A" stroke="#3E7B2B" strokeWidth="1" />
      <path d="M60 45 C 56 52, 48 56, 42 62 M61 45 C 66 52, 74 56, 80 62 M60.5 45 L60.5 64" stroke="#E8CFA4" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <circle cx="47" cy="58" r="1.8" fill="#339AF0" />
      <circle cx="60.5" cy="38" r="1.6" fill="#339AF0" />
      <circle cx="60.5" cy="26" r="1.6" fill="#339AF0" />
      <line x1="84" y1="19" x2="96" y2="12" stroke="#24333B" strokeWidth="0.8" />
      <circle cx="84" cy="19" r="1.2" fill="#24333B" />
      <rect x="92" y="6" width="22" height="8" rx="2" fill="#fff" />
      <text x="103" y="12" textAnchor="middle" fontSize="5.2" fontWeight="700" fill="#24333B">
        LEAF
      </text>
      <rect x="44" y="5" width="32" height="6" rx="3" fill="#fff" stroke="#cbd5e1" strokeWidth="0.5" />
      <text x="60" y="9.6" textAnchor="middle" fontSize="4" fontWeight="700" fill="#1E2A30">
        STEP 2 / 4
      </text>
    </svg>
  );
}

/** Choose between the character-presenter style and the diagram-explainer style. */
export function VideoStylePicker({ value, onChange }: { value: VideoStyle; onChange: (v: VideoStyle) => void }) {
  return (
    <div role="radiogroup" aria-label="Video style" className="grid gap-3 sm:grid-cols-2">
      {VIDEO_STYLES.map((s) => {
        const on = value === s.id;
        const color = s.id === "explainer" ? "#22D3EE" : "#A78BFA";
        return (
          <motion.button
            key={s.id}
            type="button"
            role="radio"
            aria-checked={on}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onChange(s.id)}
            className={cx(
              "group relative flex flex-col overflow-hidden rounded-2xl border p-3 text-left transition duration-300",
              on ? "border-transparent bg-white/[0.07]" : "border-white/[0.08] bg-white/[0.025] hover:border-white/20",
            )}
            style={on ? { boxShadow: `0 0 0 1.5px ${color}, 0 18px 50px -20px ${color}` } : undefined}
          >
            <span className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-30 blur-2xl transition group-hover:opacity-60" style={{ background: color }} />
            <div className="relative aspect-[5/3] w-full overflow-hidden rounded-xl ring-1 ring-white/10">{s.id === "explainer" ? <ExplainerHint /> : <PresenterHint />}</div>
            <div className="relative mt-3 flex items-center gap-2">
              <span className="font-display text-[15px] font-semibold text-fg">{s.name}</span>
              {s.id === "explainer" && (
                <span className="rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300 ring-1 ring-cyan-400/30">New</span>
              )}
            </div>
            <p className="relative mt-1 text-xs leading-relaxed text-fg-subtle">{s.desc}</p>
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
