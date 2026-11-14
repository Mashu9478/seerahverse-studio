"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, Play, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api, elapsed, timeAgo, type VideoListItem } from "@/lib/client";
import { Badge, Button, Card, Empty, PageHeader, Progress, Skeleton } from "@/components/ui";
import { Pipeline } from "@/components/Pipeline";
import { StatusBadge, VideoModal, subjectEmoji } from "@/components/VideoCard";

const ACTIVE = ["scripting", "queued", "rendering", "uploading"];

function JobCard({ j, onAction, onOpen }: { j: VideoListItem; onAction: () => void; onOpen: () => void }) {
  const [busy, setBusy] = useState("");
  const [, force] = useState(0);
  useEffect(() => {
    if (!ACTIVE.includes(j.status)) return;
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [j.status]);

  async function act(kind: "cancel" | "retry") {
    setBusy(kind);
    try {
      await api(`/api/videos/${j.id}/${kind}`, { method: "POST" });
      toast.success(kind === "cancel" ? "Canceled" : "Trying again 🔁");
      onAction();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  const active = ACTIVE.includes(j.status);
  const color = j.status === "failed" ? "bg-red-400" : j.status === "done" ? "bg-leaf" : j.status === "scripting" ? "bg-brand-500" : "bg-orange";
  const shownProgress = j.status === "done" ? 100 : j.status === "review" ? 100 : j.progress;
  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }}>
      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand-50 text-3xl">
              {j.thumb_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={j.thumb_url} alt="" className="h-full w-full object-cover" />
              ) : (
                subjectEmoji(j.subject)
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={j.status} />
                <Badge className={j.format === "short" ? "bg-rose-soft text-rose" : "bg-brand-50 text-brand-700"}>
                  {j.format === "short" ? `📱 ${j.target_seconds}s` : `🖥️ ${Math.round(j.target_seconds / 60)} min`}
                </Badge>
                {j.warning_count > 0 && j.status === "review" && <Badge className="bg-sun-soft text-amber-800">⚠️ {j.warning_count} to check</Badge>}
              </div>
              <div className="mt-1 truncate font-display text-lg font-semibold">{j.title || j.topic}</div>
              <div className="truncate text-sm text-slate-500">
                {j.status === "failed" ? <span className="text-red-600">{j.error}</span> : j.message}
              </div>
            </div>
          </div>
          <div className="w-full lg:w-[420px]">
            <Pipeline status={j.status} stage={j.stage} autoRender={j.auto_render} />
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2 lg:w-48 lg:justify-end">
            {j.status === "review" && (
              <Link href={`/studio/videos/${j.id}/edit`}>
                <Button size="sm" icon={<Eye className="h-4 w-4" />}>
                  Review script
                </Button>
              </Link>
            )}
            {j.status === "done" && (
              <Button size="sm" variant="success" icon={<Play className="h-4 w-4" />} onClick={onOpen}>
                Watch
              </Button>
            )}
            {(j.status === "failed" || j.status === "canceled") && (
              <Button size="sm" variant="warm" loading={busy === "retry"} icon={<RotateCcw className="h-4 w-4" />} onClick={() => act("retry")}>
                Retry
              </Button>
            )}
            {(active || j.status === "review") && (
              <Button size="sm" variant="danger" loading={busy === "cancel"} icon={<XCircle className="h-4 w-4" />} onClick={() => act("cancel")}>
                Cancel
              </Button>
            )}
          </div>
        </div>
        {active && (
          <div className="mt-4 flex items-center gap-3">
            <Progress value={shownProgress} color={color} striped className="h-2.5" />
            <span className="w-12 text-right font-display font-semibold text-orange">{shownProgress}%</span>
            <span className="w-14 text-right text-xs font-bold text-slate-400" title="Elapsed">
              ⏱ {elapsed(j.started_at || j.created_at)}
            </span>
          </div>
        )}
        {!active && (
          <div className="mt-2 text-right text-xs text-slate-400">
            {j.status === "done" && j.started_at && j.finished_at ? `Rendered in ${elapsed(j.started_at, j.finished_at)} · ` : ""}
            {timeAgo(j.updated_at)}
          </div>
        )}
      </Card>
    </motion.div>
  );
}

export default function QueuePage() {
  const [jobs, setJobs] = useState<VideoListItem[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const loaded = useRef(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ jobs: VideoListItem[] }>("/api/jobs");
      setJobs(r.jobs);
      loaded.current = true;
    } catch (e) {
      if (!loaded.current) {
        toast.error(e instanceof Error ? e.message : "Couldn't load the queue");
        setJobs([]);
      }
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  const working = (jobs ?? []).filter((j) => ACTIVE.includes(j.status));
  const review = (jobs ?? []).filter((j) => j.status === "review");
  const finished = (jobs ?? []).filter((j) => ["done", "failed", "canceled"].includes(j.status));

  const section = (title: string, list: VideoListItem[]) =>
    list.length > 0 && (
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        <AnimatePresence initial={false}>
          {list.map((j) => (
            <JobCard key={j.id} j={j} onAction={load} onOpen={() => setOpen(j.id)} />
          ))}
        </AnimatePresence>
      </section>
    );

  return (
    <div>
      <PageHeader
        emoji="⚙️"
        title="Queue"
        subtitle="Watch your videos move through the studio. This page updates live."
        actions={
          <Link href="/studio/create">
            <Button icon={<Sparkles className="h-4 w-4" />}>New video</Button>
          </Link>
        }
      />
      {jobs === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <Empty
          emoji="🛋️"
          title="Nothing in the queue"
          text="The studio is resting. Start a video or a batch and you'll see it come to life here."
          action={
            <Link href="/studio/create">
              <Button icon={<Sparkles className="h-4 w-4" />}>Create a video</Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          {section(`👀 Waiting for your review (${review.length})`, review)}
          {section(`🎨 In the studio (${working.length})`, working)}
          {section("🗂️ Finished in the last 24 hours", finished)}
        </div>
      )}
      <VideoModal id={open} onClose={() => setOpen(null)} onDeleted={load} />
    </div>
  );
}
