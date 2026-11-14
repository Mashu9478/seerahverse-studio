"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Grid3X3, List, Search, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { SUBJECTS } from "@/lib/constants";
import { api, type VideoListItem } from "@/lib/client";
import { Button, Empty, IconButton, PageHeader, Segmented, Skeleton, cx } from "@/components/ui";
import { VideoCard, VideoModal, setVideoPublic } from "@/components/VideoCard";

type StatusF = "done" | "progress" | "failed" | "all";
const STATUS_Q: Record<StatusF, string> = {
  done: "done",
  progress: "review,scripting,queued,rendering,uploading",
  failed: "failed,canceled",
  all: "",
};
type FormatF = "" | "long" | "short";

function Library() {
  const sp = useSearchParams();
  const [videos, setVideos] = useState<VideoListItem[] | null>(null);
  const [status, setStatus] = useState<StatusF>("done");
  const [format, setFormat] = useState<FormatF>("");
  const [subject, setSubject] = useState("");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [open, setOpen] = useState<string | null>(sp.get("open"));

  useEffect(() => {
    try {
      const v = localStorage.getItem("sv-library-view");
      if (v === "list" || v === "grid") setView(v);
    } catch {
      /* ignore */
    }
  }, []);
  function changeView(v: "grid" | "list") {
    setView(v);
    try {
      localStorage.setItem("sv-library-view", v);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (STATUS_Q[status]) p.set("status", STATUS_Q[status]);
    if (format) p.set("format", format);
    if (subject) p.set("subject", subject);
    if (debounced) p.set("q", debounced);
    p.set("limit", "120");
    try {
      const r = await api<{ videos: VideoListItem[] }>(`/api/videos?${p}`);
      setVideos(r.videos);
    } catch {
      setVideos([]);
    }
  }, [status, format, subject, debounced]);

  useEffect(() => {
    setVideos(null);
    load();
  }, [load]);

  function patchLocal(id: string, is_public: boolean) {
    setVideos((vs) => vs?.map((x) => (x.id === id ? { ...x, is_public } : x)) ?? vs);
  }

  async function togglePublic(v: VideoListItem) {
    const next = v.is_public === false;
    patchLocal(v.id, next);
    try {
      await setVideoPublic(v.id, next);
    } catch (e) {
      patchLocal(v.id, !next);
      toast.error(e instanceof Error ? e.message : "Couldn't update");
    }
  }

  const publicCount = (videos ?? []).filter((v) => v.status === "done" && v.is_public !== false).length;
  const filtered = !!(format || subject || debounced || status !== "done");

  return (
    <div>
      <PageHeader
        emoji="🎞️"
        title="Library"
        subtitle="Watch, download and publish your videos. The eye icon controls what visitors see on the public site."
        actions={
          <Link href="/studio/create">
            <Button icon={<Sparkles className="h-4 w-4" />}>New video</Button>
          </Link>
        }
      />

      {/* toolbar */}
      <div className="card sticky top-16 z-20 mb-6 p-3 lg:top-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <input
              className="input h-10 pl-10 pr-9"
              placeholder="Search by topic or title…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search videos"
            />
            {query && (
              <button onClick={() => setQuery("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-fg-subtle hover:text-fg">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented<StatusF>
              value={status}
              onChange={setStatus}
              options={[
                { value: "done", label: "Ready" },
                { value: "progress", label: "In progress" },
                { value: "failed", label: "Failed" },
                { value: "all", label: "All" },
              ]}
            />
            <Segmented<FormatF>
              value={format}
              onChange={setFormat}
              options={[
                { value: "", label: "All formats" },
                { value: "long", label: "Long" },
                { value: "short", label: "Shorts" },
              ]}
            />
            <select className="input h-10 w-auto min-w-[150px] py-0" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Filter by subject">
              <option value="">All subjects</option>
              {SUBJECTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.id}
                </option>
              ))}
            </select>
            <div className="flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
              <IconButton label="Grid view" active={view === "grid"} onClick={() => changeView("grid")} className="h-8 w-8 ring-0">
                <Grid3X3 className="h-4 w-4" />
              </IconButton>
              <IconButton label="List view" active={view === "list"} onClick={() => changeView("list")} className="h-8 w-8 ring-0">
                <List className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        </div>
      </div>

      {videos && videos.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-xs text-fg-muted">
          <span>
            {videos.length} video{videos.length === 1 ? "" : "s"}
            {status === "done" && (
              <>
                {" "}
                · <span className="text-emerald-300">{publicCount} public</span> · {videos.length - publicCount} private
              </>
            )}
          </span>
          {filtered && (
            <button
              className="font-semibold text-brand-300 hover:text-brand-800"
              onClick={() => {
                setFormat("");
                setSubject("");
                setQuery("");
                setStatus("done");
              }}
            >
              Reset filters
            </button>
          )}
        </div>
      )}

      {videos === null ? (
        <div className={cx(view === "grid" ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "space-y-3")}>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className={view === "grid" ? "aspect-[4/3]" : "h-24"} />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <Empty
          emoji="🔍"
          title={filtered ? "No videos match" : "No videos here yet"}
          text={filtered ? "Try a different search or filter." : "Finished videos appear here. Start one and come back in a few minutes!"}
          action={
            <Link href="/studio/create">
              <Button icon={<Sparkles className="h-4 w-4" />}>Create a video</Button>
            </Link>
          }
        />
      ) : (
        <motion.div
          layout
          className={cx(view === "grid" ? "grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "space-y-3")}
          initial="hidden"
          animate="show"
          variants={{ show: { transition: { staggerChildren: 0.04 } } }}
        >
          <AnimatePresence mode="popLayout">
            {videos.map((v) => (
              <VideoCard key={v.id} v={v} view={view} onOpen={() => setOpen(v.id)} onTogglePublic={togglePublic} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}
      <VideoModal id={open} onClose={() => setOpen(null)} onDeleted={load} onChanged={(c) => patchLocal(c.id, c.is_public)} />
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense>
      <Library />
    </Suspense>
  );
}
