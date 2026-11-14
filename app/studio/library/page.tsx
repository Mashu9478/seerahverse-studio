"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Sparkles } from "lucide-react";
import { SUBJECTS } from "@/lib/constants";
import { api, type VideoListItem } from "@/lib/client";
import { Button, Chip, Empty, PageHeader, Skeleton } from "@/components/ui";
import { VideoCard, VideoModal } from "@/components/VideoCard";

const STATUS_FILTERS = [
  { id: "done", label: "✅ Ready" },
  { id: "review,scripting,queued,rendering,uploading", label: "⚙️ In progress" },
  { id: "failed,canceled", label: "⚠️ Failed" },
  { id: "", label: "All" },
];

function Library() {
  const sp = useSearchParams();
  const [videos, setVideos] = useState<VideoListItem[] | null>(null);
  const [status, setStatus] = useState("done");
  const [format, setFormat] = useState("");
  const [subject, setSubject] = useState("");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState<string | null>(sp.get("open"));

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  const load = useCallback(async () => {
    const p = new URLSearchParams();
    if (status) p.set("status", status);
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

  return (
    <div>
      <PageHeader
        emoji="🎞️"
        title="Library"
        subtitle="All your finished videos — watch, download and copy YouTube details."
        actions={
          <Link href="/studio/create">
            <Button icon={<Sparkles className="h-4 w-4" />}>New video</Button>
          </Link>
        }
      />
      <div className="card mb-6 space-y-3 p-4">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
          <input className="input pl-11" placeholder="Search by topic or title…" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search videos" />
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((f) => (
            <Chip key={f.label} active={status === f.id} onClick={() => setStatus(f.id)}>
              {f.label}
            </Chip>
          ))}
          <span className="mx-1 w-px bg-brand-100" />
          <Chip color="rose" active={format === "short"} onClick={() => setFormat(format === "short" ? "" : "short")}>
            📱 Shorts
          </Chip>
          <Chip color="sky" active={format === "long"} onClick={() => setFormat(format === "long" ? "" : "long")}>
            🖥️ Long
          </Chip>
          <span className="mx-1 w-px bg-brand-100" />
          {SUBJECTS.map((s) => (
            <Chip key={s.id} color="orange" active={subject === s.id} onClick={() => setSubject(subject === s.id ? "" : s.id)}>
              {s.emoji} {s.id}
            </Chip>
          ))}
        </div>
      </div>

      {videos === null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="aspect-[4/3]" />
          ))}
        </div>
      ) : videos.length === 0 ? (
        <Empty
          emoji="🔍"
          title="No videos here yet"
          text={status === "done" ? "Finished videos appear here. Start one and come back in a few minutes!" : "Try a different filter."}
          action={
            <Link href="/studio/create">
              <Button icon={<Sparkles className="h-4 w-4" />}>Create a video</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {videos.map((v) => (
            <VideoCard key={v.id} v={v} onOpen={() => setOpen(v.id)} />
          ))}
        </div>
      )}
      <VideoModal id={open} onClose={() => setOpen(null)} onDeleted={load} />
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
