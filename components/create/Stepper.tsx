"use client";

import { motion } from "framer-motion";
import { Check, type LucideIcon } from "lucide-react";
import { cx } from "../ui";

export interface StepDef {
  label: string;
  hint: string;
  icon: LucideIcon;
}

/** Horizontal stepper with a glowing gradient progress line. */
export function Stepper({ steps, current, onGo }: { steps: StepDef[]; current: number; onGo: (i: number) => void }) {
  const pct = (current / (steps.length - 1)) * 100;
  return (
    <div className="relative mb-8">
      <div className="absolute left-[24px] right-[24px] top-[22px] h-[3px] rounded-full bg-white/[0.07]" />
      <div className="absolute left-[24px] right-[24px] top-[22px] h-[3px]">
        <motion.div
          className="h-full w-full origin-left rounded-full bg-brand-grad shadow-[0_0_18px_rgba(192,38,211,0.8)]"
          initial={false}
          animate={{ scaleX: pct / 100 }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
        />
      </div>
      <ol className="relative flex justify-between">
        {steps.map((s, i) => {
          const done = i < current;
          const on = i === current;
          const Icon = s.icon;
          return (
            <li key={s.label} className="flex flex-col items-center">
              <button
                type="button"
                onClick={() => onGo(i)}
                aria-current={on ? "step" : undefined}
                className="group relative flex flex-col items-center focus:outline-none"
              >
                <span className="relative grid h-12 w-12 place-items-center">
                  {on && <span className="absolute inset-0 animate-pulse-ring rounded-2xl bg-fuchsia-500/40" />}
                  <span
                    className={cx(
                      "relative grid h-12 w-12 place-items-center rounded-2xl border transition duration-300",
                      on && "border-transparent bg-brand-grad text-white shadow-glow",
                      done && "border-emerald-400/40 bg-emerald-400/15 text-emerald-300",
                      !on && !done && "border-white/10 bg-bg-elev text-fg-subtle group-hover:border-white/25 group-hover:text-fg-muted",
                    )}
                  >
                    {done ? <Check className="h-5 w-5" strokeWidth={3} /> : <Icon className="h-5 w-5" />}
                  </span>
                </span>
                <span className={cx("mt-2 text-[13px] font-semibold transition", on ? "text-fg" : done ? "text-emerald-300/90" : "text-fg-subtle")}>{s.label}</span>
                <span className="hidden text-[11px] text-fg-subtle sm:block">{s.hint}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
