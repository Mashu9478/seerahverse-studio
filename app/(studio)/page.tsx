"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Layers, Sparkles } from "lucide-react";
import { api, type VideoListItem } from "@/lib/client";
import { fmtDuration } from "@/lib/plan";
import { Button, Card, Empty, Progress, Skeleton } from "@/components/ui";
import { Pipeline } from "@/components/Pipeline";
import { VideoCard, VideoModal } from "@/components/VideoCard";
import { useAppSettings } from "@/components/useAppSettings";

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
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default function Dashboard() {
  const settings = useAppSettings();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<VideoListItem[] | null>(null);
  const [jobs, setJobs] = useState<VideoListItem[]>([]);
  const [open, setOpen] = useState<string | null>(null);

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

  const cards = [
    { label: "Videos made", value: stats ? String(stats.done) : "–", emoji: "🎬", bg: "from-brand-500 to-brand-700" },
    { label: "Minutes produced", value: stats ? String(Math.round(stats.seconds / 60)) : "–", emoji: "⏱️", bg: "from-sky to-brand-500" },
    { label: "In progress", value: stats ? String(stats.working + stats.review) : "–", emoji: "⚙️", bg: "from-orange to-rose" },
    { label: "Needs attention", value: stats ? String(stats.failed) : "–", emoji: stats && stats.failed ? "⚠️" : "✅", bg: "from-leaf to-sky" },
  ];

  return (
    <div className="space-y-8">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-4xl bg-gradient-to-br from-brand-500 via-brand-600 to-brand-800 p-6 text-white shadow-pop sm:p-9"
      >
        <div className="pointer-events-none absolute -right-6 -top-6 text-[140px] opacity-20 sm:text-[200px]">🦉</div>
        <p className="font-bold text-brand-100">{greeting()}! 👋</p>
        <h1 className="mt-1 max-w-2xl text-3xl font-semibold leading-tight sm:text-5xl">What shall we teach today?</h1>
        <p className="mt-2 max-w-xl text-brand-100">
          Type a topic or drop textbook pages — Claude writes the lesson, Ollie presents it, and you get a ready-to-upload video for {settings?.channel ?? "your channel"}.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/create">
            <Button size="lg" variant="warm" icon={<Sparkles className="h-5 w-5" />}>
              Create a video
            </Button>
          </Link>
          <Link href="/batch">
            <Button size="lg" variant="secondary" icon={<Layers className="h-5 w-5" />}>
              Batch create
            </Button>
          </Link>
        </div>
      </motion.section>

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c, i) => (
          <motion.div
            key={c.label}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 * i }}
            className={`rounded-3xl bg-gradient-to-br ${c.bg} p-5 text-white shadow-soft`}
          >
            <div className="text-3xl">{c.emoji}</div>
            <div className="mt-2 font-display text-4xl font-semibold">{c.value}</div>
            <div className="text-sm font-bold opacity-90">{c.label}</div>
          </motion.div>
        ))}
      </section>

      {jobs.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">⚡ Working on it</h2>
            <Link href="/queue" className="flex items-center gap-1 font-bold text-brand-600 hover:underline">
              Open queue <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {jobs.slice(0, 4).map((j) => (
              <Card key={j.id} className="p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-display text-lg font-semibold">{j.title || j.topic}</div>
                    <div className="truncate text-sm text-slate-500">{j.message}</div>
                  </div>
                  {j.status === "review" ? (
                    <Link href={`/videos/${j.id}/edit`}>
                      <Button size="sm">Review 👀</Button>
                    </Link>
                  ) : (
                    <span className="font-display text-lg font-semibold text-orange">{j.progress}%</span>
                  )}
                </div>
                <Pipeline status={j.status} stage={j.stage} autoRender={j.auto_render} compact />
                {j.status !== "review" && <Progress value={j.progress} className="mt-3 h-2" color="bg-orange" striped />}
              </Card>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">🎞️ Recent videos</h2>
          <Link href="/library" className="flex items-center gap-1 font-bold text-brand-600 hover:underline">
            Library <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {recent === null ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
              <Link href="/create">
                <Button icon={<Sparkles className="h-4 w-4" />}>Create my first video</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((v) => (
              <VideoCard key={v.id} v={v} onOpen={() => setOpen(v.id)} />
            ))}
          </div>
        )}
        {stats && stats.done > 0 && (
          <p className="mt-3 text-sm text-slate-500">
            {stats.shorts} Shorts · {stats.longs} long videos · {fmtDuration(stats.seconds)} total runtime
          </p>
        )}
      </section>

      <VideoModal id={open} onClose={() => setOpen(null)} onDeleted={load} />
    </div>
  );
}
