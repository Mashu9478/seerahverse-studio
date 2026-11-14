"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { cx } from "./ui";

const STEPS = [
  { key: "script", label: "Script", emoji: "✍️" },
  { key: "review", label: "Review", emoji: "👀" },
  { key: "voice", label: "Voice", emoji: "🎙️" },
  { key: "animate", label: "Animate", emoji: "🎨" },
  { key: "upload", label: "Upload", emoji: "☁️" },
  { key: "done", label: "Done", emoji: "🎉" },
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

export function Pipeline({ status, stage, autoRender, compact }: { status: string; stage: string | null; autoRender?: boolean; compact?: boolean }) {
  const cur = stepIndex(status, stage);
  const bad = status === "failed" || status === "canceled";
  return (
    <div className="flex items-center">
      {STEPS.map((s, i) => {
        const done = i < cur || status === "done";
        const active = i === cur && !bad && status !== "done";
        const failedHere = bad && i === cur;
        const skipped = s.key === "review" && autoRender && i < cur;
        return (
          <div key={s.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center">
              <motion.div
                animate={active ? { scale: [1, 1.12, 1], rotate: [0, -6, 6, 0] } : { scale: 1 }}
                transition={active ? { duration: 1.4, repeat: Infinity } : {}}
                className={cx(
                  "relative grid place-items-center rounded-full border-2 transition",
                  compact ? "h-8 w-8 text-sm" : "h-11 w-11 text-xl",
                  done && "border-leaf bg-leaf text-white",
                  active && "border-orange bg-orange-soft shadow-[0_0_0_6px_rgba(255,138,31,0.15)]",
                  failedHere && "border-red-400 bg-red-50",
                  !done && !active && !failedHere && "border-slate-200 bg-white opacity-60",
                )}
                title={s.label}
              >
                {done ? (skipped ? <span className="text-xs">⏭️</span> : <Check className={compact ? "h-4 w-4" : "h-5 w-5"} strokeWidth={3} />) : failedHere ? "⚠️" : s.emoji}
              </motion.div>
              {!compact && (
                <span className={cx("mt-1 text-[11px] font-bold", active ? "text-orange-600" : done ? "text-green-700" : "text-slate-400")}>{s.label}</span>
              )}
            </div>
            {i < STEPS.length - 1 && (
              <div className={cx("mx-1 h-1 flex-1 rounded-full", compact ? "" : "-mt-4", i < cur ? "bg-leaf" : "bg-slate-200")}>
                {i === cur && active && (
                  <motion.div className="h-full rounded-full bg-orange" animate={{ width: ["0%", "100%"] }} transition={{ duration: 1.6, repeat: Infinity }} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
