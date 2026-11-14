"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cx } from "../ui";

const TONES = {
  violet: "from-violet-500/30 to-violet-500/5 text-violet-300",
  cyan: "from-cyan-400/30 to-cyan-400/5 text-cyan-300",
  pink: "from-pink-500/30 to-pink-500/5 text-pink-300",
  amber: "from-amber-400/30 to-amber-400/5 text-amber-300",
  emerald: "from-emerald-400/30 to-emerald-400/5 text-emerald-300",
  sky: "from-sky-400/30 to-sky-400/5 text-sky-300",
  slate: "from-white/15 to-white/[0.03] text-fg-muted",
} as const;
export type Tone = keyof typeof TONES;

/** Settings section card with an icon header. */
export function Section({
  id,
  icon,
  title,
  desc,
  tone = "violet",
  right,
  children,
  className,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  desc?: string;
  tone?: Tone;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cx("card scroll-mt-24 overflow-hidden p-0", className)}
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.06] p-5 sm:px-6">
        <div className="flex items-start gap-3.5">
          <span className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br ring-1 ring-inset ring-white/10", TONES[tone])}>{icon}</span>
          <div>
            <h2 className="font-display text-base font-semibold text-fg">{title}</h2>
            {desc && <p className="mt-0.5 max-w-xl text-[13px] text-fg-muted">{desc}</p>}
          </div>
        </div>
        {right}
      </header>
      <div className="p-5 sm:p-6">{children}</div>
    </motion.section>
  );
}

/** Small inline result pill for tests. */
export function ResultPill({ state, text }: { state: "idle" | "running" | "ok" | "fail"; text?: string }) {
  if (state === "idle") return <span className="text-xs text-fg-subtle">Not run yet</span>;
  if (state === "running")
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-semibold text-fg-muted">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> Checking…
      </span>
    );
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cx(
        "inline-flex max-w-full items-start gap-1.5 rounded-xl px-2.5 py-1 text-xs font-semibold ring-1 ring-inset",
        state === "ok" ? "bg-emerald-400/10 text-emerald-300 ring-emerald-400/25" : "bg-rose-500/10 text-rose-300 ring-rose-400/25",
      )}
    >
      <span className="shrink-0">{state === "ok" ? "✓" : "✗"}</span>
      <span className="break-words">{text}</span>
    </motion.span>
  );
}
