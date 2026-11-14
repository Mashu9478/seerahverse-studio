"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Eye, Monitor, Play, RotateCcw, Smartphone, Sparkles, Timer, XCircle } from "lucide-react";
import { toast } from "sonner";
import { api, elapsed, timeAgo, type VideoListItem } from "@/lib/client";
import { Badge, Button, Empty, PageHeader, Progress, Segmented, Skeleton, cx } from "@/components/ui";
import { Pipeline } from "@/components/Pipeline";
import { StatusBadge, VideoModal, subjectEmoji } from "@/components/VideoCard";

const ACTIVE = ["scripting", "queued", "rendering", "uploading"];
type Filter = "active" | "review" | "failed" | "all";

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
  const failed = j.status === "failed";
  const shownProgress = j.status === "done" || j.status === "review" ? 100 : j.progress;
  const bar =
    j.status === "scripting"
      ? "bg-gradient-to-r from-violet-500 to-fuchsia-500"
      : "bg-gradient-to-r from-cyan-400 via-sky-400 to-violet-500";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className={cx(
        "card relative overflow-hidden p-5",
        active && "border-cyan-400/20",
        failed && "border-rose-400/25",
        j.status === "review" && "border-amber-400/25",
      )}
    >
      {active && <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-cyan-500/15 blur-3xl" />}
      {failed && <div className="pointer-events-none absolute -left-16 -top-16 h-40 w-40 rounded-full bg-rose-500/15 blur-3xl" />}
      <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-white/[0.05] text-3xl ring-1 ring-white/10">
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
              <Badge className={j.format === "short" ? "bg-pink-500/15 text-pink-200 ring-pink-300/25" : "bg-violet-500/15 text-violet-200 ring-violet-300/25"}>
                {j.format === "short" ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
                {j.format === "short" ? `${j.target_seconds}s` : `${Math.round(j.target_seconds / 60)} min`}
              </Badge>
              {j.warning_count > 0 && j.status === "review" && (
                <Badge className="bg-amber-400/15 text-amber-300 ring-amber-400/30">
                  <AlertTriangle className="h-3 w-3" /> {j.warning_count} to check
                </Badge>
              )}
            </div>
            <div className="mt-1.5 truncate font-display text-[17px] font-semibold text-fg">{j.title || j.topic}</div>
            <div className="truncate text-[13px] text-fg-muted">
              {failed ? <span className="text-rose-300">{j.error}</span> : j.message}
            </div>
          </div>
        </div>

        <div className="w-full xl:w-[440px]">
          <Pipeline status={j.status} stage={j.stage} autoRender={j.auto_render} />
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 xl:w-52 xl:justify-end">
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
          {(failed || j.status === "canceled") && (
            <Button size="sm" variant="warm" loading={busy === "retry"} icon={<RotateCcw className="h-4 w-4" />} onClick={() => act("retry")}>
              Retry
            </Button>
          )}
          {(active || j.status === "review") && (
            <Button size="sm" variant="ghost" loading={busy === "cancel"} icon={<XCircle className="h-4 w-4" />} onClick={() => act("cancel")}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      {active && (
        <div className="relative mt-5 flex items-center gap-4">
          <Progress value={shownProgress} color={bar} striped className="h-2" />
          <span className="w-11 text-right font-mono text-sm font-semibold text-cyan-300">{shownProgress}%</span>
          <span className="flex w-16 items-center justify-end gap-1 font-mono text-xs text-fg-subtle" title="Elapsed">
            <Timer className="h-3.5 w-3.5" />
            {elapsed(j.started_at || j.created_at)}
          </span>
        </div>
      )}
      {!active && (
        <div className="relative mt-3 text-right text-[11px] text-fg-subtle">
          {j.status === "done" && j.started_at && j.finished_at ? `Rendered in ${elapsed(j.started_at, j.finished_at)} · ` : ""}
          {timeAgo(j.updated_at)}
        </div>
      )}
    </motion.div>
  );
}

export default function QueuePage() {
  const [jobs, setJobs] = useState<VideoListItem[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
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

  const all = jobs ?? [];
  const counts = useMemo(
    () => ({
      active: all.filter((j) => ACTIVE.includes(j.status)).length,
      review: all.filter((j) => j.status === "review").length,
      failed: all.filter((j) => j.status === "failed" || j.status === "canceled").length,
    }),
    [all],
  );

  const order = (j: VideoListItem) => (j.status === "review" ? 0 : ACTIVE.includes(j.status) ? 1 : 2);
  const list = all
    .filter((j) =>
      filter === "active"
        ? ACTIVE.includes(j.status)
        : filter === "review"
          ? j.status === "review"
          : filter === "failed"
            ? j.status === "failed" || j.status === "canceled"
            : true,
    )
    .sort((a, b) => order(a) - order(b));

  const pill = (n: number, tone: string) =>
    n > 0 ? <span className={cx("ml-1.5 rounded-full px-1.5 py-px text-[10px] font-bold", tone)}>{n}</span> : null;

  return (
    <div>
      <PageHeader
        emoji="⚙️"
        title="Render queue"
        subtitle="Watch your videos move through the studio. This page updates live every few seconds."
        actions={
          <Link href="/studio/create">
            <Button icon={<Sparkles className="h-4 w-4" />}>New video</Button>
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Segmented<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: <>All{pill(all.length, "bg-white/10 text-fg-muted")}</> },
            { value: "active", label: <>Active{pill(counts.active, "bg-cyan-400/20 text-cyan-200")}</> },
            { value: "review", label: <>Needs review{pill(counts.review, "bg-amber-400/20 text-amber-200")}</> },
            { value: "failed", label: <>Failed{pill(counts.failed, "bg-rose-500/20 text-rose-200")}</> },
          ]}
        />
        {counts.active > 0 && (
          <span className="flex items-center gap-2 text-xs text-fg-muted">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
            </span>
            {counts.active} render machine{counts.active === 1 ? "" : "s"} working
          </span>
        )}
      </div>

      {jobs === null ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <Empty
          emoji={filter === "failed" ? "✅" : filter === "review" ? "☕" : "🛋️"}
          title={filter === "failed" ? "No failed videos" : filter === "review" ? "No scripts waiting" : "Nothing in the queue"}
          text={
            filter === "all"
              ? "The studio is resting. Start a video or a batch and you'll see it come to life here."
              : "Nothing matches this filter right now."
          }
          action={
            <Link href="/studio/create">
              <Button icon={<Sparkles className="h-4 w-4" />}>Create a video</Button>
            </Link>
          }
        />
      ) : (
        <motion.div layout className="space-y-4">
          <AnimatePresence initial={false} mode="popLayout">
            {list.map((j) => (
              <JobCard key={j.id} j={j} onAction={load} onOpen={() => setOpen(j.id)} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
      <VideoModal id={open} onClose={() => setOpen(null)} onDeleted={load} />
    </div>
  );
}
