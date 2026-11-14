"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Captions, Check, Clock, Copy, Download, Eye, EyeOff, ImageDown, Monitor, Pencil, Play, RotateCcw, Smartphone, Trash2, Tv } from "lucide-react";
import { toast } from "sonner";
import { STATUS_META, SUBJECTS } from "@/lib/constants";
import { api, copyText, downloadUrl, slug, timeAgo, type VideoFull, type VideoListItem } from "@/lib/client";
import { fmtDuration } from "@/lib/plan";
import { Badge, Button, IconButton, Modal, Skeleton, cx } from "./ui";

export function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.draft;
  const live = ["scripting", "queued", "rendering", "uploading"].includes(status);
  return (
    <Badge className={m.color}>
      {live ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> : <span>{m.emoji}</span>}
      {m.label}
    </Badge>
  );
}

export function subjectEmoji(s: string) {
  return SUBJECTS.find((x) => x.id === s)?.emoji ?? "📘";
}

export function FormatBadge({ format, className }: { format: string; className?: string }) {
  const short = format === "short";
  return (
    <Badge
      className={cx(
        "backdrop-blur-md",
        short ? "bg-pink-500/25 text-pink-200 ring-pink-300/30" : "bg-violet-500/25 text-violet-200 ring-violet-300/30",
        className,
      )}
    >
      {short ? <Smartphone className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
      {short ? "Short" : "Long"}
    </Badge>
  );
}

/** Thumbnail that plays a silent preview of the video while hovered. */
function HoverPreview({ v, className }: { v: VideoListItem; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [hover, setHover] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (hover) {
      el.currentTime = Math.min(3, (v.duration_sec ?? 10) / 4);
      el.play().catch(() => {});
    } else el.pause();
  }, [hover, v.duration_sec]);
  return (
    <div className={cx("relative overflow-hidden", className)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}>
      {v.thumb_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={v.thumb_url} alt="" className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
      ) : (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-violet-600/30 via-fuchsia-500/10 to-cyan-500/20 text-5xl">
          {subjectEmoji(v.subject)}
        </div>
      )}
      {v.video_url && hover && (
        <video ref={ref} src={v.video_url} muted loop playsInline preload="none" className="absolute inset-0 h-full w-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/20" />
    </div>
  );
}

export function VideoCard({
  v,
  onOpen,
  onTogglePublic,
  view = "grid",
}: {
  v: VideoListItem;
  onOpen: () => void;
  onTogglePublic?: (v: VideoListItem) => void;
  view?: "grid" | "list";
}) {
  const title = v.youtube?.title || v.title || v.topic;
  const short = v.format === "short";
  const isPublic = v.is_public !== false;
  const done = v.status === "done";

  const publicBtn = onTogglePublic && done && (
    <IconButton
      label={isPublic ? "Visible on public site — click to hide" : "Hidden from public site — click to show"}
      onClick={(e) => {
        e.stopPropagation();
        onTogglePublic(v);
      }}
      className={cx("bg-black/40 backdrop-blur-md", isPublic ? "text-emerald-300 ring-emerald-400/30" : "text-fg-subtle")}
    >
      {isPublic ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
    </IconButton>
  );

  if (view === "list") {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        className="card card-hover group flex items-center gap-4 p-3"
      >
        <button onClick={onOpen} className="relative shrink-0 overflow-hidden rounded-xl" aria-label={`Open ${title}`}>
          <HoverPreview v={v} className={short ? "h-24 w-[54px]" : "h-[72px] w-32"} />
          {done && (
            <span className="absolute inset-0 grid place-items-center opacity-0 transition group-hover:opacity-100">
              <Play className="h-5 w-5 fill-white text-white" />
            </span>
          )}
        </button>
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <h3 className="truncate font-display text-[15px] font-semibold text-fg">{title}</h3>
          <p className="mt-0.5 truncate text-xs text-fg-muted">
            {subjectEmoji(v.subject)} {v.subject} · {v.age_group} yrs · {timeAgo(v.created_at)}
          </p>
        </button>
        <div className="hidden items-center gap-2 sm:flex">
          <FormatBadge format={v.format} />
          {v.duration_sec ? (
            <Badge className="bg-white/[0.06] text-fg-muted">
              <Clock className="h-3 w-3" /> {fmtDuration(v.duration_sec)}
            </Badge>
          ) : null}
          <StatusBadge status={v.status} />
        </div>
        {publicBtn}
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 260, damping: 26 }}
      className="group relative rounded-3xl p-px"
    >
      <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-white/15 via-white/[0.04] to-white/[0.02] transition duration-500 group-hover:from-violet-400/70 group-hover:via-fuchsia-500/30 group-hover:to-cyan-400/50" />
      <div className="relative h-full overflow-hidden rounded-[calc(1.5rem-1px)] bg-bg-card/95 transition duration-300 group-hover:shadow-glow">
        <button onClick={onOpen} className="relative block w-full text-left" aria-label={`Open ${title}`}>
          <HoverPreview v={v} className={short ? "aspect-[3/4]" : "aspect-video"} />
          {done && (
            <span className="absolute inset-0 grid place-items-center">
              <span className="grid h-14 w-14 scale-75 place-items-center rounded-full bg-white/15 text-white opacity-0 ring-1 ring-white/40 backdrop-blur-md transition duration-300 group-hover:scale-100 group-hover:opacity-100">
                <Play className="h-6 w-6 translate-x-0.5 fill-white" />
              </span>
            </span>
          )}
          <div className="absolute left-3 top-3 flex gap-1.5">
            <FormatBadge format={v.format} />
            {done && !isPublic && (
              <Badge className="bg-black/50 text-fg-muted backdrop-blur-md">
                <EyeOff className="h-3 w-3" /> Private
              </Badge>
            )}
          </div>
          {v.duration_sec ? (
            <span className="absolute bottom-3 right-3 rounded-lg bg-black/60 px-2 py-0.5 font-mono text-[11px] font-semibold text-white ring-1 ring-white/10 backdrop-blur-md">
              {fmtDuration(v.duration_sec)}
            </span>
          ) : null}
        </button>
        {publicBtn && <div className="absolute right-3 top-3">{publicBtn}</div>}
        <div className="p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <StatusBadge status={v.status} />
            <span className="text-[11px] text-fg-subtle">{timeAgo(v.created_at)}</span>
          </div>
          <h3 className="line-clamp-2 font-display text-[15px] font-semibold leading-snug text-fg">{title}</h3>
          <p className="mt-1 text-xs text-fg-muted">
            {subjectEmoji(v.subject)} {v.subject} · {v.age_group} yrs
          </p>
        </div>
      </div>
    </motion.div>
  );
}

/** Update a video's public visibility. Returns the new value (or throws). */
export async function setVideoPublic(id: string, value: boolean) {
  await api(`/api/videos/${id}`, { method: "PATCH", body: { is_public: value } });
  toast.success(value ? "Visible on public site" : "Hidden from public site", {
    icon: value ? "👁️" : "🙈",
  });
  return value;
}

function CopyRow({ label, text, onCopy, scroll }: { label: string; text: string; onCopy: (l: string, t: string) => Promise<boolean>; scroll?: boolean }) {
  const [ok, setOk] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{label}</span>
        <button
          onClick={async () => {
            if (await onCopy(label, text)) {
              setOk(true);
              setTimeout(() => setOk(false), 1600);
            }
          }}
          className={cx(
            "flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition",
            ok ? "bg-emerald-400/15 text-emerald-300" : "text-fg-muted hover:bg-white/[0.08] hover:text-fg",
          )}
        >
          {ok ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} {ok ? "Copied" : "Copy"}
        </button>
      </div>
      <p className={cx("whitespace-pre-wrap rounded-xl border border-white/[0.06] bg-black/25 p-3 text-[13px] leading-relaxed text-fg-muted", scroll && "max-h-40 overflow-y-auto")}>
        {text}
      </p>
    </div>
  );
}

export function VideoModal({
  id,
  onClose,
  onDeleted,
  onChanged,
}: {
  id: string | null;
  onClose: () => void;
  onDeleted?: () => void;
  onChanged?: (v: { id: string; is_public: boolean }) => void;
}) {
  const [v, setV] = useState<VideoFull | null>(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    setV(null);
    setBusy("");
    if (!id) return;
    api<{ video: VideoFull }>(`/api/videos/${id}`)
      .then((r) => setV(r.video))
      .catch((e) => toast.error(e.message));
  }, [id]);

  const yt = v?.youtube;
  const name = slug(yt?.title || v?.plan?.title || v?.topic || "video");
  const isPublic = v?.is_public !== false;

  async function copy(label: string, text: string) {
    if (await copyText(text)) {
      toast.success(`${label} copied`);
      return true;
    }
    toast.error("Couldn't copy — select the text and copy it manually.");
    return false;
  }

  async function togglePublic() {
    if (!v) return;
    const next = !isPublic;
    setV({ ...v, is_public: next });
    try {
      await setVideoPublic(v.id, next);
      onChanged?.({ id: v.id, is_public: next });
    } catch (e) {
      setV({ ...v, is_public: !next });
      toast.error(e instanceof Error ? e.message : "Couldn't update");
    }
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
    if (busy !== "confirm-delete") {
      setBusy("confirm-delete");
      setTimeout(() => setBusy((b) => (b === "confirm-delete" ? "" : b)), 4000);
      return;
    }
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
    <Modal open={!!id} onClose={onClose} className="max-w-6xl">
      {!v ? (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <Skeleton className="aspect-video w-full" />
          <div className="space-y-3">
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-8 w-5/6" />
            <Skeleton className="h-40 w-full" />
          </div>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
          <div>
            <div
              className={cx(
                "relative overflow-hidden rounded-2xl bg-black ring-1 ring-white/10 shadow-[0_30px_80px_-30px_rgba(139,92,246,0.6)]",
                v.format === "short" ? "mx-auto aspect-[9/16] max-h-[70vh]" : "aspect-video",
              )}
            >
              {v.video_url ? (
                <video src={v.video_url} poster={v.thumb_url ?? undefined} controls autoPlay playsInline className="h-full w-full" />
              ) : (
                <div className="grid h-full place-items-center bg-gradient-to-br from-violet-600/20 to-cyan-500/10 p-6 text-center">
                  <div>
                    <div className="text-5xl">{STATUS_META[v.status]?.emoji}</div>
                    <div className="mt-2 font-display text-xl text-fg">{STATUS_META[v.status]?.label}</div>
                    {v.error && <p className="mt-2 max-w-sm text-sm text-rose-300">{v.error}</p>}
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
                    Captions
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-5">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={v.status} />
                <FormatBadge format={v.format} />
              </div>
              <h2 className="mt-3 text-2xl font-semibold leading-tight text-fg">{yt?.title || v.plan?.title || v.topic}</h2>
              <p className="mt-1 text-sm text-fg-muted">
                {subjectEmoji(v.subject)} {v.subject} · {v.age_group} yrs · {v.duration_sec ? fmtDuration(v.duration_sec) : fmtDuration(v.target_seconds)}
              </p>
            </div>

            {v.status === "done" && (
              <button
                onClick={togglePublic}
                className={cx(
                  "flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left transition",
                  isPublic ? "border-emerald-400/30 bg-emerald-400/[0.08]" : "border-white/[0.08] bg-white/[0.03] hover:border-white/20",
                )}
              >
                <span className={cx("grid h-10 w-10 place-items-center rounded-xl", isPublic ? "bg-emerald-400/20 text-emerald-300" : "bg-white/[0.06] text-fg-subtle")}>
                  {isPublic ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
                </span>
                <span className="flex-1">
                  <span className="block text-sm font-semibold text-fg">{isPublic ? "Visible on public site" : "Hidden from public site"}</span>
                  <span className="block text-xs text-fg-subtle">{isPublic ? "Visitors can watch this video. Click to hide it." : "Only you can see it. Click to publish."}</span>
                </span>
              </button>
            )}

            {yt && (
              <div className="space-y-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-fg">
                    <Tv className="h-4 w-4 text-rose-400" /> YouTube details
                  </h3>
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<Copy className="h-3.5 w-3.5" />}
                    onClick={() => copy("Everything", `${yt.title}\n\n${yt.description}\n\n${yt.hashtags.join(" ")}\n\nTags: ${yt.tags.join(", ")}`)}
                  >
                    Copy all
                  </Button>
                </div>
                <CopyRow label="Title" text={yt.title} onCopy={copy} />
                <CopyRow label="Description" text={`${yt.description}\n\n${yt.hashtags.join(" ")}`} onCopy={copy} scroll />
                <CopyRow label="Tags" text={yt.tags.join(", ")} onCopy={copy} />
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Link href={`/studio/videos/${v.id}/edit`}>
                <Button variant="secondary" icon={<Pencil className="h-4 w-4" />}>
                  Edit script
                </Button>
              </Link>
              {v.plan && ["done", "failed", "canceled", "review"].includes(v.status) && (
                <Button variant="outline" icon={<RotateCcw className="h-4 w-4" />} loading={busy === "rerender"} onClick={rerender}>
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
