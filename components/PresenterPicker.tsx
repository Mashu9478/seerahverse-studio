"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { CHARACTERS } from "@/lib/constants";
import { cx } from "./ui";

/** Choose the on-screen presenter (or none). Shared by Create, Batch, the script editor and Settings. */
export function PresenterPicker({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={cx("grid gap-3", compact ? "grid-cols-3 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-3")}>
      {CHARACTERS.map((c) => {
        const on = value === c.id;
        return (
          <motion.button
            key={c.id}
            type="button"
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(c.id)}
            aria-pressed={on}
            className={cx(
              "group relative flex flex-col items-center overflow-hidden rounded-2xl border p-3 text-center transition duration-300",
              on ? "border-transparent bg-white/[0.07]" : "border-white/[0.08] bg-white/[0.025] hover:border-white/20",
            )}
            style={on ? { boxShadow: `0 0 0 1.5px ${c.color}, 0 18px 50px -18px ${c.color}` } : undefined}
          >
            <span
              className="pointer-events-none absolute -top-10 h-24 w-24 rounded-full opacity-40 blur-2xl transition group-hover:opacity-70"
              style={{ background: c.color }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.img}
              alt=""
              className={cx("relative object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] transition duration-300 group-hover:scale-105", compact ? "h-14 w-14" : "h-24 w-24")}
            />
            <span className={cx("relative mt-2 font-display font-semibold text-fg", compact ? "text-xs" : "text-sm")}>{compact ? c.short : c.name}</span>
            {!compact && <span className="relative mt-0.5 text-[11px] leading-snug text-fg-subtle">{c.desc}</span>}
            {on && (
              <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full text-[#0B0A13]" style={{ background: c.color }}>
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}
