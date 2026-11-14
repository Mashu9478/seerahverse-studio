import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPublicVideo, listPublicVideos } from "@/lib/public";
import { Navbar } from "@/components/public/Navbar";
import { Footer } from "@/components/public/Footer";
import { CopyLinkButton } from "@/components/public/CopyLinkButton";
import { MoreVideos } from "@/components/public/MoreVideos";
import { ageLabel, fmtDuration, subjectEmoji } from "@/components/public/util";
import { cx } from "@/lib/cx";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const v = await getPublicVideo(id).catch(() => null);
  if (!v) return { title: "Video not found" };
  const description = (v.description || `${v.subject} lesson for ages ${v.age_group}`).slice(0, 200);
  return {
    title: v.title,
    description,
    openGraph: {
      title: v.title,
      description,
      type: "video.other",
      images: v.thumb_url ? [{ url: v.thumb_url }] : undefined,
      videos: v.video_url ? [{ url: v.video_url }] : undefined,
    },
    twitter: { card: "summary_large_image", title: v.title, description, images: v.thumb_url ? [v.thumb_url] : undefined },
  };
}

export default async function WatchPage({ params }: Props) {
  const { id } = await params;
  const v = await getPublicVideo(id).catch(() => null);
  if (!v) notFound();
  const others = (await listPublicVideos({ limit: 24 }).catch(() => [])).filter((x) => x.id !== v.id).slice(0, 8);
  const short = v.format === "short";

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[60vh] overflow-hidden">
        <div className="absolute left-1/2 top-[-30%] h-[70vh] w-[80vw] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[140px]" />
      </div>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <Link href="/#lessons" className="mb-6 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-fg-muted ring-1 ring-white/10 transition hover:bg-white/[0.06] hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> All lessons
        </Link>

        <div className={cx("grid gap-8", short ? "lg:grid-cols-[minmax(0,420px)_1fr]" : "lg:grid-cols-1")}>
          <div className={cx("overflow-hidden rounded-3xl border border-white/10 bg-black shadow-card", short && "mx-auto w-full max-w-[420px]")}>
            <video
              src={v.video_url ?? undefined}
              poster={v.thumb_url ?? undefined}
              controls
              playsInline
              preload="metadata"
              className={cx("block w-full bg-black", short ? "aspect-[9/16]" : "aspect-video")}
            />
          </div>

          <div className={cx("space-y-5", !short && "max-w-4xl")}>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className={cx("rounded-full px-3 py-1 ring-1", short ? "bg-pink-500/15 text-pink-200 ring-pink-400/30" : "bg-violet-500/15 text-violet-200 ring-violet-400/30")}>
                {short ? "Short" : "Lesson"}
              </span>
              <span className="rounded-full bg-white/[0.05] px-3 py-1 text-fg-muted ring-1 ring-white/10">
                {subjectEmoji(v.subject)} {v.subject}
              </span>
              {v.age_group && <span className="rounded-full bg-white/[0.05] px-3 py-1 text-fg-muted ring-1 ring-white/10">{ageLabel(v.age_group)}</span>}
              {v.duration_sec ? <span className="rounded-full bg-white/[0.05] px-3 py-1 font-mono text-fg-muted ring-1 ring-white/10">{fmtDuration(v.duration_sec)}</span> : null}
            </div>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight text-fg sm:text-4xl">{v.title}</h1>
            <div className="flex flex-wrap gap-2">
              <CopyLinkButton path={`/watch/${v.id}`} />
            </div>
            {v.description && (
              <div className="card p-6">
                <h2 className="label">About this video</h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-fg-muted">{v.description}</p>
                {v.hashtags?.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {v.hashtags.map((h) => (
                      <span key={h} className="rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-300 ring-1 ring-cyan-400/20">
                        {h}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {others.length > 0 && (
          <section className="mt-16">
            <div className="mb-6 flex items-end justify-between">
              <h2 className="text-2xl font-semibold tracking-tight text-fg">
                More <span className="text-gradient">lessons</span>
              </h2>
              <Link href="/#lessons" className="text-sm font-semibold text-brand-300 hover:text-brand-200">
                See all →
              </Link>
            </div>
            <MoreVideos videos={others} />
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
