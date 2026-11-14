"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play } from "lucide-react";
import { cx } from "@/components/ui";
import { fmtDuration, subjectEmoji, type PublicVideo } from "./util";

/** Landscape lesson card: lifts and plays a muted preview on hover. */
export function VideoTile({ v, onOpen, priority }: { v: PublicVideo; onOpen: (v: PublicVideo) => void; priority?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [hover, setHover] = useState(false);
  const short = v.format === "short";

  function start() {
    setHover(true);
    const el = ref.current;
    if (el && v.video_url) {
      el.currentTime = 0;
      el.play().catch(() => {});
    }
  }
  function stop() {
    setHover(false);
    ref.current?.pause();
  }

  return (
    <motion.button
      type="button"
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35 }}
      onClick={() => onOpen(v)}
      onMouseEnter={start}
      onMouseLeave={stop}
      onFocus={start}
      onBlur={stop}
      aria-label={`Play ${v.title}`}
      className="group relative block w-full rounded-3xl p-px text-left transition duration-300 hover:-translate-y-1"
    >
      <span className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/15 via-white/[0.04] to-white/[0.02] transition duration-500 group-hover:from-brand-400/70 group-hover:via-fuchsia-500/30 group-hover:to-cyan-400/50" />
      <span className="relative block overflow-hidden rounded-[calc(1.5rem-1px)] bg-bg-card/95 transition group-hover:shadow-glow">
        <span className="relative block aspect-video overflow-hidden bg-black">
          {short && v.thumb_url && (
            // blurred backdrop so vertical Shorts sit nicely in the landscape grid
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.thumb_url} alt="" aria-hidden className="absolute inset-0 h-full w-full scale-110 object-cover opacity-50 blur-xl" />
          )}
          {v.thumb_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={v.thumb_url}
              alt=""
              loading={priority ? "eager" : "lazy"}
              className={cx(
                "absolute inset-0 h-full w-full transition duration-700 group-hover:scale-105",
                short ? "object-contain" : "object-cover",
                hover && v.video_url ? "opacity-0" : "opacity-100",
              )}
            />
          )}
          {v.video_url && (
            <video
              ref={ref}
              src={hover ? v.video_url : undefined}
              muted
              playsInline
              loop
              preload="none"
              className={cx("absolute inset-0 h-full w-full transition-opacity duration-500", short ? "object-contain" : "object-cover", hover ? "opacity-100" : "opacity-0")}
            />
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
          <span className="absolute left-3 top-3 flex gap-1.5">
            <span className={cx("rounded-full px-2.5 py-1 text-[11px] font-semibold backdrop-blur", short ? "bg-pink-500/25 text-pink-200 ring-1 ring-pink-400/40" : "bg-violet-500/25 text-violet-200 ring-1 ring-violet-400/40")}>
              {short ? "Short" : "Lesson"}
            </span>
          </span>
          {v.duration_sec ? (
            <span className="absolute bottom-3 right-3 rounded-lg bg-black/70 px-2 py-0.5 font-mono text-[11px] font-semibold text-white backdrop-blur">
              {fmtDuration(v.duration_sec)}
            </span>
          ) : null}
          <span className="absolute inset-0 grid place-items-center opacity-0 transition duration-300 group-hover:opacity-100">
            <span className="grid h-14 w-14 scale-75 place-items-center rounded-full bg-white/15 text-white ring-1 ring-white/30 backdrop-blur-md transition duration-300 group-hover:scale-100">
              <Play className="ml-0.5 h-6 w-6 fill-current" />
            </span>
          </span>
        </span>
        <span className="block p-4">
          <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
            <span>{subjectEmoji(v.subject)}</span>
            {v.subject}
            {v.age_group && <span className="text-fg-subtle/70">· Ages {v.age_group}</span>}
          </span>
          <span className="mt-1.5 line-clamp-2 block font-display text-[15px] font-semibold leading-snug text-fg">{v.title}</span>
        </span>
      </span>
    </motion.button>
  );
}

/** Vertical Short card for the snap-scroll row. */
export function ShortTile({ v, onOpen }: { v: PublicVideo; onOpen: (v: PublicVideo) => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      onClick={() => onOpen(v)}
      onMouseEnter={() => {
        setHover(true);
        ref.current?.play().catch(() => {});
      }}
      onMouseLeave={() => {
        setHover(false);
        ref.current?.pause();
      }}
      aria-label={`Play short: ${v.title}`}
      className="group relative w-[200px] shrink-0 snap-start overflow-hidden rounded-3xl border border-white/[0.08] bg-black text-left transition duration-300 hover:-translate-y-1 hover:border-pink-400/50 hover:shadow-[0_20px_60px_-20px_rgba(244,114,182,0.7)] sm:w-[220px]"
    >
      <span className="relative block aspect-[9/16]">
        {v.thumb_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={v.thumb_url} alt="" loading="lazy" className={cx("absolute inset-0 h-full w-full object-cover transition", hover ? "opacity-0" : "opacity-100")} />
        )}
        {v.video_url && (
          <video
            ref={ref}
            src={hover ? v.video_url : undefined}
            muted
            playsInline
            loop
            preload="none"
            className={cx("absolute inset-0 h-full w-full object-cover transition-opacity", hover ? "opacity-100" : "opacity-0")}
          />
        )}
        <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
        {v.duration_sec ? (
          <span className="absolute right-3 top-3 rounded-lg bg-black/60 px-2 py-0.5 font-mono text-[11px] font-semibold text-white">{fmtDuration(v.duration_sec)}</span>
        ) : null}
        <span className="absolute inset-x-0 bottom-0 p-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-pink-200">
            {subjectEmoji(v.subject)} {v.subject}
          </span>
          <span className="mt-1 line-clamp-2 block font-display text-sm font-semibold leading-snug text-white">{v.title}</span>
        </span>
      </span>
    </button>
  );
}
