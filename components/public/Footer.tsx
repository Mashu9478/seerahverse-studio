import Link from "next/link";
import { Logo } from "@/components/Logo";

export function Footer({ tagline }: { tagline?: string }) {
  return (
    <footer className="relative mt-24 border-t border-white/[0.06]">
      <div className="divider absolute inset-x-0 top-0" />
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm text-fg-muted">
            AI-made, animated learning videos for kids — by Hamas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-fg-subtle">
          <a href="/#lessons" className="hover:text-fg">Lessons</a>
          <a href="/#shorts" className="hover:text-fg">Shorts</a>
          <a href="/#how" className="hover:text-fg">How we teach</a>
          <Link href="/admin" className="text-xs text-fg-subtle/70 hover:text-fg">Admin</Link>
        </div>
      </div>
      <div className="border-t border-white/[0.05] py-5 text-center text-xs text-fg-subtle">
        © {new Date().getFullYear()} AI_LEARNING_VIDEO_GENERATION_BY_HAMAS. All rights reserved. · Emoji graphics: Twemoji, CC-BY 4.0
      </div>
    </footer>
  );
}
