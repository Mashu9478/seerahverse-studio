"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, Search, Sparkles, X } from "lucide-react";
import { Chip, Empty, Segmented, cx } from "@/components/ui";
import { Reveal } from "./Reveal";
import { ShortTile, VideoTile } from "./VideoTile";
import { PlayerModal } from "./PlayerModal";
import { ageLabel, fmtDuration, subjectEmoji, type PublicVideo } from "./util";

type Kind = "all" | "long" | "short";

export function Showcase({ videos, subjects }: { videos: PublicVideo[]; subjects: { subject: string; n: number }[] }) {
  const [open, setOpen] = useState<PublicVideo | null>(null);
  const [kind, setKind] = useState<Kind>("all");
  const [subject, setSubject] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const featured = useMemo(() => videos.find((v) => v.format === "long") ?? videos[0] ?? null, [videos]);
  const shorts = useMemo(() => videos.filter((v) => v.format === "short"), [videos]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return videos.filter(
      (v) =>
        (kind === "all" || v.format === kind) &&
        (!subject || v.subject === subject) &&
        (!term || `${v.title} ${v.topic} ${v.subject}`.toLowerCase().includes(term)),
    );
  }, [videos, kind, subject, q]);

  if (!videos.length) {
    return (
      <section id="lessons" className="scroll-mt-24 py-16">
        <div className="mx-auto max-w-3xl px-4">
          <Empty
            emoji="🎬"
            title="New lessons are on the way"
            text="Our presenters are busy rehearsing! Fresh animated lessons and Shorts will appear here very soon — check back shortly."
          />
        </div>
      </section>
    );
  }

  return (
    <>
      {featured && <Featured v={featured} onOpen={setOpen} />}

      <section id="lessons" className="scroll-mt-24 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <span className="eyebrow">Library</span>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
                Explore every <span className="text-gradient">lesson</span>
              </h2>
            </div>
            <p className="text-sm text-fg-subtle">
              {filtered.length} of {videos.length} videos
            </p>
          </Reveal>

          {/* filter bar */}
          <div className="sticky top-16 z-30 -mx-4 mt-8 border-y border-white/[0.06] bg-bg/75 px-4 py-3 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <Segmented<Kind>
                value={kind}
                onChange={setKind}
                options={[
                  { value: "all", label: "All" },
                  { value: "long", label: "Lessons" },
                  { value: "short", label: "Shorts" },
                ]}
              />
              <div className="-mx-1 flex flex-1 gap-2 overflow-x-auto px-1 pb-1 lg:pb-0" role="group" aria-label="Filter by subject">
                <Chip active={!subject} onClick={() => setSubject(null)}>
                  <Sparkles className="h-3.5 w-3.5" /> All subjects
                </Chip>
                {subjects.map((s) => (
                  <Chip key={s.subject} active={subject === s.subject} onClick={() => setSubject(subject === s.subject ? null : s.subject)} className="shrink-0">
                    {subjectEmoji(s.subject)} {s.subject}
                    <span className="text-[10px] opacity-60">{s.n}</span>
                  </Chip>
                ))}
              </div>
              <label className="relative block lg:w-64">
                <span className="sr-only">Search lessons</span>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search lessons…" className="input h-10 py-0 pl-10 pr-9 text-sm" />
                {q && (
                  <button aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-fg-subtle hover:text-fg">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </label>
            </div>
          </div>

          <motion.div layout className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            <AnimatePresence mode="popLayout">
              {filtered.map((v, i) => (
                <VideoTile key={v.id} v={v} onOpen={setOpen} priority={i < 4} />
              ))}
            </AnimatePresence>
          </motion.div>
          {!filtered.length && (
            <div className="mt-8">
              <Empty
                emoji="🔍"
                title="No videos match"
                text="Try another subject or clear your search."
                action={
                  <button
                    onClick={() => {
                      setQ("");
                      setSubject(null);
                      setKind("all");
                    }}
                    className="rounded-xl bg-white/[0.06] px-4 py-2 text-sm font-semibold text-fg ring-1 ring-white/12 hover:bg-white/[0.1]"
                  >
                    Clear filters
                  </button>
                }
              />
            </div>
          )}
        </div>
      </section>

      {shorts.length > 0 && <ShortsRow shorts={shorts} onOpen={setOpen} />}

      <PlayerModal video={open} onClose={() => setOpen(null)} />
    </>
  );
}

function Featured({ v, onOpen }: { v: PublicVideo; onOpen: (v: PublicVideo) => void }) {
  const [playing, setPlaying] = useState(false);
  const short = v.format === "short";
  return (
    <section className="py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-bg-card/80 shadow-card">
            <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-violet-600/30 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 right-0 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl" />
            <div className={cx("relative grid gap-0", short ? "lg:grid-cols-[minmax(0,380px)_1fr]" : "lg:grid-cols-[minmax(0,1.6fr)_1fr]")}>
              <div className={cx("relative overflow-hidden bg-black", short ? "aspect-[9/16]" : "aspect-video")}>
                {playing ? (
                  <video src={v.video_url ?? undefined} poster={v.thumb_url ?? undefined} autoPlay controls playsInline className="h-full w-full bg-black object-contain" />
                ) : (
                  <button type="button" onClick={() => setPlaying(true)} aria-label={`Play ${v.title}`} className="group absolute inset-0">
                    {v.thumb_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.thumb_url} alt="" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]" />
                    )}
                    <span className="absolute inset-0 bg-gradient-to-tr from-black/60 via-black/10 to-transparent" />
                    <span className="absolute inset-0 grid place-items-center">
                      <span className="relative grid h-20 w-20 place-items-center rounded-full bg-brand-grad text-white shadow-glow transition duration-300 group-hover:scale-110">
                        <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-500/50" />
                        <Play className="relative ml-1 h-8 w-8 fill-current" />
                      </span>
                    </span>
                  </button>
                )}
              </div>
              <div className="flex flex-col justify-center gap-4 p-7 sm:p-10">
                <span className="eyebrow w-fit">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(251,191,36,0.9)]" /> Featured {short ? "short" : "lesson"}
                </span>
                <h2 className="text-2xl font-semibold leading-tight tracking-tight text-fg sm:text-3xl">{v.title}</h2>
                <div className="flex flex-wrap gap-2 text-[11px] font-semibold text-fg-muted">
                  <span className="rounded-full bg-white/[0.05] px-2.5 py-1 ring-1 ring-white/10">
                    {subjectEmoji(v.subject)} {v.subject}
                  </span>
                  {v.age_group && <span className="rounded-full bg-white/[0.05] px-2.5 py-1 ring-1 ring-white/10">{ageLabel(v.age_group)}</span>}
                  {v.duration_sec ? <span className="rounded-full bg-white/[0.05] px-2.5 py-1 font-mono ring-1 ring-white/10">{fmtDuration(v.duration_sec)}</span> : null}
                </div>
                {v.description && <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed text-fg-muted">{v.description}</p>}
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setPlaying(true)}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-brand-grad px-5 font-display text-sm font-semibold text-white shadow-pop ring-1 ring-inset ring-white/20 transition hover:shadow-glow hover:brightness-110 active:scale-[0.97]"
                  >
                    <Play className="h-4 w-4 fill-current" /> Play now
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpen(v)}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-white/[0.06] px-5 text-sm font-semibold text-fg ring-1 ring-inset ring-white/12 transition hover:bg-white/[0.1]"
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function ShortsRow({ shorts, onOpen }: { shorts: PublicVideo[]; onOpen: (v: PublicVideo) => void }) {
  const scroll = (dir: number) => {
    const el = document.getElementById("shorts-track");
    el?.scrollBy({ left: dir * 480, behavior: "smooth" });
  };
  return (
    <section id="shorts" className="scroll-mt-24 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal className="flex items-end justify-between gap-4">
          <div>
            <span className="eyebrow">Shorts</span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-fg sm:text-4xl">
              Quick <span className="text-gradient-warm">bite-size</span> learning
            </h2>
            <p className="mt-2 text-sm text-fg-muted">One idea, under a minute — perfect for little attention spans.</p>
          </div>
          <div className="hidden gap-2 sm:flex">
            <button aria-label="Scroll shorts left" onClick={() => scroll(-1)} className="grid h-10 w-10 place-items-center rounded-xl text-fg-muted ring-1 ring-white/10 transition hover:bg-white/[0.06] hover:text-fg">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button aria-label="Scroll shorts right" onClick={() => scroll(1)} className="grid h-10 w-10 place-items-center rounded-xl text-fg-muted ring-1 ring-white/10 transition hover:bg-white/[0.06] hover:text-fg">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </Reveal>
        <div
          id="shorts-track"
          className="-mx-4 mt-8 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth px-4 pb-4 sm:mx-0 sm:px-0"
          style={{ scrollbarWidth: "thin" }}
        >
          {shorts.map((v) => (
            <ShortTile key={v.id} v={v} onOpen={onOpen} />
          ))}
        </div>
      </div>
    </section>
  );
}
