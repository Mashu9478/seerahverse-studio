"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowDown, Clapperboard, Clock, Library, Play, Smartphone } from "lucide-react";
import { CHARACTERS } from "@/lib/constants";
import { Aurora, GradientText } from "@/components/ui";

const PRESENTERS = CHARACTERS.filter((c) => c.id !== "none");

export function Hero({
  stats,
  subjectCount,
}: {
  stats: { videos: number; seconds: number; shorts: number; longs: number };
  subjectCount: number;
}) {
  const reduce = useReducedMotion();
  const minutes = Math.round(stats.seconds / 60);
  const items = [
    { icon: Clapperboard, label: "Lessons", value: stats.longs, tone: "text-violet-300" },
    { icon: Smartphone, label: "Shorts", value: stats.shorts, tone: "text-pink-300" },
    { icon: Clock, label: "Minutes of learning", value: minutes, tone: "text-cyan-300" },
    { icon: Library, label: "Subjects", value: subjectCount, tone: "text-amber-300" },
  ];

  return (
    <section className="relative isolate overflow-hidden pb-20 pt-14 sm:pt-20">
      <Aurora />
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-4xl text-center"
        >
          <span className="eyebrow">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
            Animated lessons for ages 4–12
          </span>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight text-fg sm:text-6xl lg:text-7xl">
            Fun, animated lessons that build <GradientText>little leaders</GradientText>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-fg-muted sm:text-lg">
            Maths, science, Quran, Seerah and more — explained step by step by friendly characters, with quizzes, captions and
            Islamic values woven into every lesson.
          </p>
          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href="#lessons"
              className="group/btn relative inline-flex h-14 items-center gap-2.5 overflow-hidden rounded-2xl bg-brand-grad bg-[length:200%_200%] px-7 font-display text-base font-semibold text-white shadow-pop ring-1 ring-inset ring-white/20 transition hover:shadow-glow hover:brightness-110 active:scale-[0.97] animate-gradient-x"
            >
              <span className="pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/35 to-transparent opacity-0 group-hover/btn:animate-shine group-hover/btn:opacity-100" />
              <Play className="relative h-5 w-5 fill-current" />
              <span className="relative">Watch lessons</span>
            </a>
            <a
              href="#shorts"
              className="inline-flex h-14 items-center gap-2.5 rounded-2xl bg-white/[0.06] px-7 font-display text-base font-semibold text-fg ring-1 ring-inset ring-white/12 backdrop-blur transition hover:bg-white/[0.1] hover:ring-white/25 active:scale-[0.97]"
            >
              <Smartphone className="h-5 w-5" /> See Shorts
            </a>
          </div>
        </motion.div>

        {/* presenters */}
        <div className="relative mx-auto mt-16 flex max-w-4xl items-end justify-center gap-2 sm:gap-6">
          <div className="pointer-events-none absolute inset-x-10 bottom-0 h-24 rounded-[100%] bg-brand-500/20 blur-3xl" />
          {PRESENTERS.map((c, i) => {
            const mid = (PRESENTERS.length - 1) / 2;
            const lift = Math.abs(i - mid) * 18;
            return (
              <motion.figure
                key={c.id}
                initial={reduce ? false : { opacity: 0, y: 40, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ delay: 0.25 + i * 0.1, type: "spring", stiffness: 140, damping: 16 }}
                className="group relative flex flex-col items-center"
                style={{ marginBottom: -lift }}
              >
                <motion.div
                  animate={reduce ? undefined : { y: [0, -10, 0] }}
                  transition={{ duration: 4 + i * 0.4, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
                  className="relative"
                >
                  <span
                    className="pointer-events-none absolute inset-4 rounded-full opacity-50 blur-2xl transition group-hover:opacity-90"
                    style={{ background: c.color }}
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.img}
                    alt={c.name}
                    className="relative h-20 w-20 object-contain drop-shadow-[0_16px_24px_rgba(0,0,0,0.6)] transition duration-300 group-hover:scale-110 sm:h-32 sm:w-32 lg:h-36 lg:w-36"
                  />
                </motion.div>
                <figcaption className="mt-2 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[11px] font-semibold text-fg-muted opacity-0 transition group-hover:opacity-100 sm:opacity-100">
                  {c.short}
                </figcaption>
              </motion.figure>
            );
          })}
        </div>

        {/* stats */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mx-auto mt-24 grid max-w-4xl grid-cols-2 gap-3 sm:grid-cols-4"
        >
          {items.map((s) => (
            <div key={s.label} className="card card-hover relative overflow-hidden px-5 py-4 text-center">
              <s.icon className={`mx-auto h-5 w-5 ${s.tone}`} />
              <div className="mt-2 font-display text-3xl font-semibold tracking-tight text-fg">{s.value}</div>
              <div className="text-xs font-medium uppercase tracking-wider text-fg-subtle">{s.label}</div>
            </div>
          ))}
        </motion.div>

        <a href="#lessons" aria-label="Scroll to lessons" className="mx-auto mt-12 flex w-fit animate-floaty items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-fg-subtle hover:text-fg">
          <ArrowDown className="h-4 w-4" /> Explore
        </a>
      </div>
    </section>
  );
}
