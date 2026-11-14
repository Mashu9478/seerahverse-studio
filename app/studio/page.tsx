"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Clapperboard, Clock, Cog, ExternalLink, Eye, Layers, Radio, Sparkles, Timer } from "lucide-react";
import { api, type VideoListItem } from "@/lib/client";
import { CHARACTERS } from "@/lib/constants";
import { fmtDuration } from "@/lib/plan";
import { Button, Empty, Progress, Skeleton, StatCard } from "@/components/ui";
import { Pipeline } from "@/components/Pipeline";
import { StatusBadge, VideoCard, VideoModal, setVideoPublic, subjectEmoji } from "@/components/VideoCard";
import { CountUp } from "@/components/studio/CountUp";
import { useAppSettings } from "@/components/useAppSettings";
import { toast } from "sonner";

interface Stats {
  done: number;
  seconds: number;
  working: number;
  review: number;
  failed: number;
  shorts: number;
  longs: number;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Late night, scholar";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const PRESENTERS = CHARACTERS.filter((c) => c.id !== "none");

export default function Dashboard() {
  const settings = useAppSettings();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<VideoListItem[] | null>(null);
  const [jobs, setJobs] = useState<VideoListItem[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [hello, setHello] = useState("Welcome back");

  useEffect(() => setHello(greeting()), []);

  const load = useCallback(async () => {
    try {
      const [s, j] = await Promise.all([
        api<{ stats: Stats; recent: VideoListItem[] }>("/api/stats"),
        api<{ jobs: VideoListItem[] }>("/api/jobs"),
      ]);
      setStats(s.stats);
      setRecent(s.recent);
      setJobs(j.jobs.filter((x) => ["scripting", "review", "queued", "rendering", "uploading"].includes(x.status)));
    } catch {
      /* toast handled elsewhere */
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function togglePublic(v: VideoListItem) {
    const next = v.is_public === false;
    setRecent((r) => r?.map((x) => (x.id === v.id ? { ...x, is_public: next } : x)) ?? r);
    try {
      await setVideoPublic(v.id, next);
    } catch (e) {
      setRecent((r) => r?.map((x) => (x.id === v.id ? { ...x, is_public: !next } : x)) ?? r);
      toast.error(e instanceof Error ? e.message : "Couldn't update");
    }
  }

  const reviewCount = jobs.filter((j) => j.status === "review").length;
  const live = jobs.filter((j) => j.status !== "review");

  return (
    <div className="space-y-10">
      {/* ---------------------------------------------------------------- hero */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="relative overflow-hidden rounded-[28px] border border-white/10 bg-bg-card p-7 shadow-card sm:p-10"
      >
        {/* gradient mesh */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-20 -top-32 h-80 w-80 animate-aurora rounded-full bg-violet-600/40 blur-[90px]" />
          <div className="absolute right-[-10%] top-[-20%] h-72 w-96 animate-aurora rounded-full bg-fuchsia-500/25 blur-[100px] [animation-delay:-5s]" />
          <div className="absolute bottom-[-40%] left-[30%] h-72 w-96 animate-aurora rounded-full bg-cyan-500/20 blur-[100px] [animation-delay:-10s]" />
          <div className="grid-bg absolute inset-0 opacity-70" />
        </div>

        {/* presenters peeking */}
        <div aria-hidden className="pointer-events-none absolute bottom-0 right-4 hidden items-end gap-1 md:flex lg:right-10">
          {PRESENTERS.map((c, i) => (
            <motion.img
              key={c.id}
              src={c.img}
              alt=""
              onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
              initial={{ y: 60, opacity: 0 }}
              animate={{ y: [0, -6, 0], opacity: 1 }}
              transition={{
                opacity: { delay: 0.25 + i * 0.08, duration: 0.4 },
                y: { delay: 0.25 + i * 0.08, duration: 3 + i * 0.4, repeat: Infinity, ease: "easeInOut" },
              }}
              className="h-24 w-24 object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.6)] lg:h-32 lg:w-32"
              style={{ marginBottom: i % 2 ? 18 : -6 }}
            />
          ))}
        </div>

        <div className="relative max-w-2xl">
          <span className="eyebrow">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,1)]" />
            {hello} · Admin studio
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-[1.05] tracking-tight text-fg sm:text-6xl">
            What shall we <span className="text-gradient">teach today?</span>
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-fg-muted">
            Type a topic or drop textbook pages. Claude writes the lesson, your presenter brings it to life, and you get a ready-to-upload video for your channel.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/studio/create">
              <Button size="lg" icon={<Sparkles className="h-5 w-5" />}>
                Create video
              </Button>
            </Link>
            <Link href="/studio/batch">
              <Button size="lg" variant="secondary" icon={<Layers className="h-5 w-5" />}>
                Batch create
              </Button>
            </Link>
          </div>
        </div>
      </motion.section>

      {/* ---------------------------------------------------------------- stats */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          { label: "Videos made", value: stats?.done, icon: <Clapperboard className="h-4 w-4" />, tone: "violet" as const, sub: stats ? `${stats.shorts} Shorts · ${stats.longs} long` : "" },
          {
            label: "Minutes produced",
            value: stats ? Math.round(stats.seconds / 60) : undefined,
            icon: <Clock className="h-4 w-4" />,
            tone: "cyan" as const,
            sub: stats ? `${fmtDuration(stats.seconds)} total runtime` : "",
          },
          { label: "In progress", value: stats ? stats.working + stats.review : undefined, icon: <Cog className="h-4 w-4" />, tone: "amber" as const, sub: stats ? `${stats.review} waiting for review` : "" },
          {
            label: "Needs attention",
            value: stats?.failed,
            icon: <AlertTriangle className="h-4 w-4" />,
            tone: stats && stats.failed ? ("pink" as const) : ("emerald" as const),
            sub: stats ? (stats.failed ? "Open the queue to retry" : "All clear") : "",
          },
        ].map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 + 0.06 * i }}>
            <StatCard
              label={c.label}
              icon={c.icon}
              tone={c.tone}
              sub={c.sub}
              value={c.value === undefined ? <Skeleton className="h-9 w-16" /> : <CountUp value={c.value} />}
            />
          </motion.div>
        ))}
      </section>

      {/* ---------------------------------------------------------------- quick strip */}
      <section className="grid gap-3 sm:grid-cols-3">
        <Link href="/" target="_blank" className="panel group flex items-center gap-3 p-4 transition hover:border-white/20 hover:bg-white/[0.05]">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-500/15 text-violet-300">
            <ExternalLink className="h-5 w-5" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-fg">View public site</span>
            <span className="block text-xs text-fg-subtle">See what visitors see</span>
          </span>
          <ArrowRight className="h-4 w-4 text-fg-subtle transition group-hover:translate-x-1 group-hover:text-fg" />
        </Link>
        <Link href="/studio/queue" className="panel group flex items-center gap-3 p-4 transition hover:border-white/20 hover:bg-white/[0.05]">
          <span className="relative grid h-10 w-10 place-items-center rounded-xl bg-amber-400/15 text-amber-300">
            <Eye className="h-5 w-5" />
            {reviewCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-black">{reviewCount}</span>
            )}
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-fg">Review scripts</span>
            <span className="block text-xs text-fg-subtle">{reviewCount ? `${reviewCount} waiting for you` : "Nothing waiting"}</span>
          </span>
          <ArrowRight className="h-4 w-4 text-fg-subtle transition group-hover:translate-x-1 group-hover:text-fg" />
        </Link>
        <div className="panel flex items-center gap-3 p-4">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-cyan-400/15 text-cyan-300">
            <Timer className="h-5 w-5" />
          </span>
          <span className="flex-1">
            <span className="block text-sm font-semibold text-fg">Tip</span>
            <span className="block text-xs text-fg-subtle">A 1-minute Short renders in about a minute. Batch a week of lessons at once!</span>
          </span>
        </div>
      </section>

      {/* ---------------------------------------------------------------- live renders */}
      {live.length > 0 && (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2.5 text-lg font-semibold text-fg">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400" />
              </span>
              Live renders
            </h2>
            <Link href="/studio/queue" className="flex items-center gap-1 text-sm font-semibold text-brand-300 transition hover:text-brand-800">
              Open queue <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {live.slice(0, 4).map((j, i) => (
              <motion.div
                key={j.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card p-4"
              >
                <div className="mb-4 flex items-center gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white/[0.05] text-2xl ring-1 ring-white/10">
                    {subjectEmoji(j.subject)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display text-[15px] font-semibold text-fg">{j.title || j.topic}</div>
                    <div className="truncate text-xs text-fg-muted">{j.message}</div>
                  </div>
                  <span className="font-mono text-sm font-semibold text-cyan-300">{j.progress}%</span>
                </div>
                <Pipeline status={j.status} stage={j.stage} autoRender={j.auto_render} compact />
                <Progress value={j.progress} className="mt-4 h-1.5" color="bg-gradient-to-r from-cyan-400 to-violet-500" striped />
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* review strip */}
      {reviewCount > 0 && (
        <section className="space-y-2">
          {jobs
            .filter((j) => j.status === "review")
            .slice(0, 3)
            .map((j) => (
              <div key={j.id} className="flex items-center gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/[0.06] p-3 pl-4">
                <StatusBadge status="review" />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-fg">{j.title || j.topic}</span>
                <Link href={`/studio/videos/${j.id}/edit`}>
                  <Button size="sm" variant="secondary" icon={<Eye className="h-4 w-4" />}>
                    Review
                  </Button>
                </Link>
              </div>
            ))}
        </section>
      )}

      {/* ---------------------------------------------------------------- recent */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-fg">
            <Radio className="h-4 w-4 text-fuchsia-300" /> Recent videos
          </h2>
          <Link href="/studio/library" className="flex items-center gap-1 text-sm font-semibold text-brand-300 transition hover:text-brand-800">
            Library <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {recent === null ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="aspect-[4/3]" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <Empty
            emoji="🎨"
            title="No videos yet"
            text="Your first cartoon lesson is one click away. Try “Doubles for 6-year-olds” or upload a textbook page!"
            action={
              <Link href="/studio/create">
                <Button icon={<Sparkles className="h-4 w-4" />}>Create my first video</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((v) => (
              <VideoCard key={v.id} v={v} onOpen={() => setOpen(v.id)} onTogglePublic={togglePublic} />
            ))}
          </div>
        )}
      </section>

      <VideoModal
        id={open}
        onClose={() => setOpen(null)}
        onDeleted={load}
        onChanged={(c) => setRecent((r) => r?.map((x) => (x.id === c.id ? { ...x, is_public: c.is_public } : x)) ?? r)}
      />
    </div>
  );
}
