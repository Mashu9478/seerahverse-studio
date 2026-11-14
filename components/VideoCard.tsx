"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Captions, Copy, Download, ImageDown, Pencil, Play, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { STATUS_META, SUBJECTS } from "@/lib/constants";
import { api, copyText, downloadUrl, slug, timeAgo, type VideoFull, type VideoListItem } from "@/lib/client";
import { fmtDuration } from "@/lib/plan";
import { Badge, Button, Modal, Skeleton, cx } from "./ui";

export function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.draft;
  return (
    <Badge className={m.color}>
      {m.emoji} {m.label}
    </Badge>
  );
}

export function subjectEmoji(s: string) {
  return SUBJECTS.find((x) => x.id === s)?.emoji ?? "📘";
}

export function VideoCard({ v, onOpen }: { v: VideoListItem; onOpen: () => void }) {
  const title = v.youtube?.title || v.title || v.topic;
  const short = v.format === "short";
  return (
    <motion.div layout initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="card group overflow-hidden">
      <button onClick={onOpen} className="relative block w-full overflow-hidden bg-gradient-to-br from-brand-100 to-orange-soft text-left">
        <div className={cx("relative w-full", short ? "aspect-[9/12]" : "aspect-video")}>
          {v.thumb_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={v.thumb_url} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-300 group-hover:scale-105" />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-6xl">{subjectEmoji(v.subject)}</div>
          )}
          {v.status === "done" && (
            <div className="absolute inset-0 grid place-items-center bg-ink/0 transition group-hover:bg-ink/25">
              <span className="grid h-14 w-14 scale-90 place-items-center rounded-full bg-white/95 text-brand-600 opacity-0 shadow-lg transition group-hover:scale-100 group-hover:opacity-100">
                <Play className="h-6 w-6 translate-x-0.5" />
              </span>
            </div>
          )}
          <div className="absolute left-2 top-2 flex gap-1.5">
            <Badge className={short ? "bg-rose text-white" : "bg-brand-500 text-white"}>{short ? "📱 Short" : "🖥️ Long"}</Badge>
          </div>
          {v.duration_sec ? (
            <span className="absolute bottom-2 right-2 rounded-lg bg-ink/80 px-1.5 py-0.5 text-xs font-bold text-white">{fmtDuration(v.duration_sec)}</span>
          ) : null}
        </div>
      </button>
      <div className="p-4">
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <StatusBadge status={v.status} />
          <span className="text-xs text-slate-400">{timeAgo(v.created_at)}</span>
        </div>
        <h3 className="line-clamp-2 font-display text-[17px] font-semibold leading-snug">{title}</h3>
        <p className="mt-0.5 text-xs font-semibold text-slate-500">
          {subjectEmoji(v.subject)} {v.subject} · {v.age_group} yrs
        </p>
      </div>
    </motion.div>
  );
}

export function VideoModal({ id, onClose, onDeleted }: { id: string | null; onClose: () => void; onDeleted?: () => void }) {
  const [v, setV] = useState<VideoFull | null>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    setV(null);
    if (!id) return;
    api<{ video: VideoFull }>(`/api/videos/${id}`)
      .then((r) => setV(r.video))
      .catch((e) => toast.error(e.message));
  }, [id]);

  const yt = v?.youtube;
  const name = slug(yt?.title || v?.plan?.title || v?.topic || "video");

  async function copy(label: string, text: string) {
    if (await copyText(text)) toast.success(`${label} copied!`);
    else toast.error("Couldn't copy — select the text and copy it manually.");
  }

  async function rerender() {
    if (!v) return;
    setBusy("rerender");
    try {
      await api(`/api/videos/${v.id}/approve`, { body: {} });
      toast.success("Re-render queued 🎬");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  async function remove() {
    if (!v) return;
    if (busy !== "confirm-delete") return setBusy("confirm-delete");
    setBusy("delete");
    try {
      await api(`/api/videos/${v.id}`, { method: "DELETE" });
      toast.success("Video deleted");
      onDeleted?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
      setBusy("");
    }
  }

  return (
    <Modal open={!!id} onClose={onClose} className="max-w-5xl">
      {!v ? (
        <div className="space-y-4">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-6 w-2/3" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div>
            <div className={cx("overflow-hidden rounded-3xl bg-ink", v.format === "short" ? "mx-auto aspect-[9/16] max-h-[70vh]" : "aspect-video")}>
              {v.video_url ? (
                <video src={v.video_url} poster={v.thumb_url ?? undefined} controls autoPlay playsInline className="h-full w-full" />
              ) : (
                <div className="grid h-full place-items-center p-6 text-center text-white">
                  <div>
                    <div className="text-5xl">{STATUS_META[v.status]?.emoji}</div>
                    <div className="mt-2 font-display text-xl">{STATUS_META[v.status]?.label}</div>
                    {v.error && <p className="mt-2 max-w-sm text-sm text-red-200">{v.error}</p>}
                  </div>
                </div>
              )}
            </div>
            {v.video_url && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button icon={<Download className="h-4 w-4" />} onClick={() => downloadUrl(v.video_url!, `${name}.mp4`)}>
                  Download MP4
                </Button>
                {v.thumb_url && (
                  <Button variant="secondary" icon={<ImageDown className="h-4 w-4" />} onClick={() => downloadUrl(v.thumb_url!, `${name}-thumbnail.jpg`)}>
                    Thumbnail
                  </Button>
                )}
                {v.srt_url && (
                  <Button variant="secondary" icon={<Captions className="h-4 w-4" />} onClick={() => downloadUrl(v.srt_url!, `${name}.srt`)}>
                    Captions .srt
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-4">
            <div>
              <StatusBadge status={v.status} />
              <h2 className="mt-2 text-2xl font-semibold leading-tight">{yt?.title || v.plan?.title || v.topic}</h2>
              <p className="text-sm text-slate-500">
                {subjectEmoji(v.subject)} {v.subject} · {v.age_group} yrs · {v.format === "short" ? "Short" : "Long"} ·{" "}
                {v.duration_sec ? fmtDuration(v.duration_sec) : fmtDuration(v.target_seconds)}
              </p>
            </div>
            {yt && (
              <div className="space-y-3 rounded-3xl bg-brand-50/70 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">📺 YouTube details</h3>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Copy className="h-3.5 w-3.5" />}
                    onClick={() => copy("Everything", `${yt.title}\n\n${yt.description}\n\n${yt.hashtags.join(" ")}\n\nTags: ${yt.tags.join(", ")}`)}
                  >
                    Copy all
                  </Button>
                </div>
                {[
                  { k: "Title", t: yt.title },
                  { k: "Description", t: `${yt.description}\n\n${yt.hashtags.join(" ")}` },
                  { k: "Tags", t: yt.tags.join(", ") },
                ].map((row) => (
                  <div key={row.k}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wide text-brand-700">{row.k}</span>
                      <button onClick={() => copy(row.k, row.t)} className="flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold text-brand-600 hover:bg-white">
                        <Copy className="h-3 w-3" /> Copy
                      </button>
                    </div>
                    <p className={cx("whitespace-pre-wrap rounded-2xl bg-white p-3 text-sm", row.k === "Description" && "max-h-40 overflow-y-auto scrollbar-thin")}>{row.t}</p>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Link href={`/videos/${v.id}/edit`}>
                <Button variant="secondary" icon={<Pencil className="h-4 w-4" />}>
                  Edit script
                </Button>
              </Link>
              {v.plan && ["done", "failed", "canceled", "review"].includes(v.status) && (
                <Button variant="warm" icon={<RotateCcw className="h-4 w-4" />} loading={busy === "rerender"} onClick={rerender}>
                  {v.status === "done" ? "Re-render" : "Render"}
                </Button>
              )}
              <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} loading={busy === "delete"} onClick={remove}>
                {busy === "confirm-delete" ? "Click again to delete" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
