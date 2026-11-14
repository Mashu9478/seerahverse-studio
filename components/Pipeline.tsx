"use client";

import { motion } from "framer-motion";
import { AlertTriangle, Check, CloudUpload, Eye, Mic, Palette, PartyPopper, PenLine, SkipForward } from "lucide-react";
import { cx } from "./ui";

const STEPS = [
  { key: "script", label: "Script", Icon: PenLine },
  { key: "review", label: "Review", Icon: Eye },
  { key: "voice", label: "Voice", Icon: Mic },
  { key: "animate", label: "Animate", Icon: Palette },
  { key: "upload", label: "Upload", Icon: CloudUpload },
  { key: "done", label: "Done", Icon: PartyPopper },
];

export function stepIndex(status: string, stage: string | null): number {
  switch (status) {
    case "scripting":
    case "draft":
      return 0;
    case "review":
      return 1;
    case "queued":
      return 2;
    case "rendering":
      return stage && ["render", "audio", "encode"].includes(stage) ? 3 : 2;
    case "uploading":
      return 4;
    case "done":
      return 6;
    default: {
      // failed / canceled: infer from stage
      if (!stage || stage === "script") return 0;
      if (stage === "review") return 1;
      if (["queued", "starting", "voice"].includes(stage)) return 2;
      if (["render", "audio", "encode"].includes(stage)) return 3;
      if (stage === "upload") return 4;
      return 0;
    }
  }
}

/** Six-step studio pipeline. `compact` hides labels (for dashboard rows). */
export function Pipeline({ status, stage, autoRender, compact }: { status: string; stage: string | null; autoRender?: boolean; compact?: boolean }) {
  const cur = stepIndex(status, stage);
  const bad = status === "failed" || status === "canceled";
  return (
    <div className="flex items-center" role="list" aria-label="Progress steps">
      {STEPS.map((s, i) => {
        const done = i < cur || status === "done";
        const active = i === cur && !bad && status !== "done";
        const failedHere = bad && i === cur;
        const skipped = s.key === "review" && autoRender && i < cur;
        const Icon = failedHere ? AlertTriangle : done ? (skipped ? SkipForward : Check) : s.Icon;
        return (
          <div key={s.key} role="listitem" className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <div className={cx("relative grid place-items-center", compact ? "h-7 w-7" : "h-10 w-10")} title={s.label}>
                {active && (
                  <>
                    <span className="absolute inset-0 animate-pulse-ring rounded-full bg-cyan-400/40" />
                    <span className="absolute -inset-1 rounded-full bg-cyan-400/20 blur-md" />
                  </>
                )}
                <motion.div
                  animate={active ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                  transition={active ? { duration: 1.6, repeat: Infinity, ease: "easeInOut" } : {}}
                  className={cx(
                    "relative grid h-full w-full place-items-center rounded-full border transition duration-300",
                    done && "border-emerald-400/50 bg-gradient-to-br from-emerald-400 to-teal-500 text-[#04130D] shadow-[0_0_16px_-4px_rgba(52,211,153,0.9)]",
                    active && "border-cyan-300/60 bg-gradient-to-br from-cyan-400 to-violet-500 text-white shadow-[0_0_22px_-2px_rgba(34,211,238,0.9)]",
                    failedHere && "border-rose-400/60 bg-rose-500/20 text-rose-300",
                    !done && !active && !failedHere && "border-white/10 bg-white/[0.04] text-fg-subtle",
                  )}
                >
                  <Icon className={compact ? "h-3.5 w-3.5" : "h-[18px] w-[18px]"} strokeWidth={done ? 3 : 2} />
                </motion.div>
              </div>
              {!compact && (
                <span
                  className={cx(
                    "mt-1.5 text-[10px] font-semibold uppercase tracking-wider",
                    active ? "text-cyan-300" : done ? "text-emerald-300" : failedHere ? "text-rose-300" : "text-fg-subtle",
                  )}
                >
                  {s.label}
                </span>
              )}
            </div>
            {i < STEPS.length - 1 && (
              <div className={cx("relative mx-1 h-[3px] flex-1 overflow-hidden rounded-full bg-white/[0.07]", !compact && "-mt-5")}>
                {i < cur && <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400" />}
                {i === cur && active && (
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-cyan-400 to-violet-500"
                    animate={{ width: ["0%", "100%"], opacity: [1, 1, 0] }}
                    transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
