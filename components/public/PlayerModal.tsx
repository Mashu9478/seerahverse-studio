"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Modal, cx } from "@/components/ui";
import { ageLabel, fmtDuration, subjectEmoji, type PublicVideo } from "./util";
import { CopyLinkButton } from "./CopyLinkButton";

export function PlayerModal({ video, onClose }: { video: PublicVideo | null; onClose: () => void }) {
  const short = video?.format === "short";
  return (
    <Modal open={!!video} onClose={onClose} className={cx(short ? "max-w-4xl" : "max-w-5xl", "p-0 sm:p-0")}>
      {video && (
        <div className={cx("grid", short ? "md:grid-cols-[minmax(0,360px)_1fr]" : "")}>
          <div className={cx("overflow-hidden bg-black", short ? "rounded-t-3xl md:rounded-l-3xl md:rounded-tr-none" : "rounded-t-3xl")}>
            <video
              key={video.id}
              src={video.video_url ?? undefined}
              poster={video.thumb_url ?? undefined}
              controls
              autoPlay
              playsInline
              className={cx("mx-auto block w-full bg-black", short ? "aspect-[9/16] max-h-[78vh]" : "aspect-video")}
            />
          </div>
          <div className="space-y-4 p-6 sm:p-7">
            <div className="flex flex-wrap gap-2 text-[11px] font-semibold">
              <span className={cx("rounded-full px-2.5 py-1 ring-1", short ? "bg-pink-500/15 text-pink-200 ring-pink-400/30" : "bg-violet-500/15 text-violet-200 ring-violet-400/30")}>
                {short ? "Short" : "Lesson"}
              </span>
              <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-fg-muted ring-1 ring-white/10">
                {subjectEmoji(video.subject)} {video.subject}
              </span>
              {video.age_group && <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-fg-muted ring-1 ring-white/10">{ageLabel(video.age_group)}</span>}
              {video.duration_sec ? (
                <span className="rounded-full bg-white/[0.05] px-2.5 py-1 font-mono text-fg-muted ring-1 ring-white/10">{fmtDuration(video.duration_sec)}</span>
              ) : null}
            </div>
            <h2 className="pr-10 text-xl font-semibold leading-snug text-fg sm:text-2xl">{video.title}</h2>
            {video.description && (
              <p className="line-clamp-6 whitespace-pre-line text-sm leading-relaxed text-fg-muted">{video.description}</p>
            )}
            {video.hashtags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {video.hashtags.map((h) => (
                  <span key={h} className="text-xs font-semibold text-cyan-300/90">
                    {h}
                  </span>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-1">
              <Link
                href={`/watch/${video.id}`}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/[0.06] px-4 text-sm font-semibold text-fg ring-1 ring-inset ring-white/12 transition hover:bg-white/[0.1]"
              >
                <ExternalLink className="h-4 w-4" /> Open page
              </Link>
              <CopyLinkButton path={`/watch/${video.id}`} />
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
