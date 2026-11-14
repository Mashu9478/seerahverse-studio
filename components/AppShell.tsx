"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clapperboard, ExternalLink, Home, Layers, ListVideo, LogOut, Menu, Settings, ShieldCheck, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { api, celebrate, type VideoListItem } from "@/lib/client";
import { cx } from "./ui";
import { Logo } from "./Logo";

const NAV = [
  { href: "/studio", label: "Dashboard", icon: Home },
  { href: "/studio/create", label: "Create video", icon: Sparkles },
  { href: "/studio/batch", label: "Batch create", icon: Layers },
  { href: "/studio/queue", label: "Render queue", icon: ListVideo },
  { href: "/studio/library", label: "Library", icon: Clapperboard },
  { href: "/studio/settings", label: "Settings", icon: Settings },
];

export default function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [review, setReview] = useState(0);
  const seen = useRef<Map<string, string>>(new Map());
  const first = useRef(true);

  useEffect(() => setOpen(false), [path]);

  // Heartbeat: keeps the render queue moving and announces finished videos anywhere in the app.
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const { jobs } = await api<{ jobs: VideoListItem[] }>("/api/jobs");
        if (stop) return;
        setActive(jobs.filter((j) => ["scripting", "queued", "rendering", "uploading"].includes(j.status)).length);
        setReview(jobs.filter((j) => j.status === "review").length);
        for (const j of jobs) {
          const prev = seen.current.get(j.id);
          if (!first.current && prev && prev !== j.status) {
            const name = j.title || j.topic;
            if (j.status === "done") {
              celebrate();
              toast.success(`🎉 “${name}” is ready!`, { action: { label: "Watch", onClick: () => router.push(`/studio/library?open=${j.id}`) } });
            } else if (j.status === "review") {
              toast(`👀 Script ready for “${name}”`, { action: { label: "Review", onClick: () => router.push(`/studio/videos/${j.id}/edit`) } });
            } else if (j.status === "failed") {
              toast.error(`⚠️ “${name}” failed`, { description: j.error ?? undefined, action: { label: "Open queue", onClick: () => router.push("/studio/queue") } });
            }
          }
          seen.current.set(j.id, j.status);
        }
        first.current = false;
      } catch {
        /* offline or logged out */
      }
    };
    poll();
    const t = setInterval(poll, 6000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [router]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/admin");
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1">
      <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-fg-subtle">Workspace</div>
      {NAV.map((n) => {
        const on = n.href === "/studio" ? path === "/studio" : path.startsWith(n.href);
        const Icon = n.icon;
        const badge = n.href === "/studio/queue" ? active : 0;
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cx(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
              on ? "text-fg" : "text-fg-muted hover:bg-white/[0.04] hover:text-fg",
            )}
          >
            {on && (
              <motion.span
                layoutId="nav-active"
                transition={{ type: "spring", stiffness: 400, damping: 34 }}
                className="absolute inset-0 rounded-xl border border-white/10 bg-gradient-to-r from-brand-500/25 via-fuchsia-500/10 to-transparent shadow-[0_0_30px_-10px_rgba(139,92,246,0.9)]"
              />
            )}
            {on && <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-grad" />}
            <Icon className={cx("relative h-[18px] w-[18px] transition group-hover:scale-110", on ? "text-brand-300" : "text-fg-subtle group-hover:text-fg-muted")} />
            <span className="relative">{n.label}</span>
            {badge > 0 && (
              <span className="relative ml-auto flex items-center gap-1.5 rounded-full bg-cyan-400/15 px-2 py-0.5 text-[11px] text-cyan-300 ring-1 ring-cyan-400/30">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
                {badge}
              </span>
            )}
            {n.href === "/studio/queue" && review > 0 && (
              <span
                className={cx("relative rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] text-amber-300 ring-1 ring-amber-400/30", badge ? "" : "ml-auto")}
                title="Scripts waiting for review"
              >
                {review} review
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <Link href="/studio" className="mb-8 flex items-center px-2">
      <Logo />
    </Link>
  );

  const footer = (
    <div className="mt-6 space-y-2">
      <Link
        href="/studio/create"
        className="group relative block overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-brand-500/30 via-fuchsia-500/15 to-transparent p-4 transition hover:border-brand-400/50 hover:shadow-glow"
      >
        <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-fuchsia-500/30 blur-2xl transition group-hover:scale-125" />
        <div className="relative flex items-center gap-2 font-display text-sm font-semibold text-fg">
          <Sparkles className="h-4 w-4 text-brand-300" /> New video
        </div>
        <div className="relative mt-0.5 text-xs text-fg-muted">Topic in, cartoon out.</div>
      </Link>
      <Link href="/" target="_blank" className="flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold text-fg-muted transition hover:bg-white/[0.04] hover:text-fg">
        <ExternalLink className="h-4 w-4" /> View public site
      </Link>
      <div className="flex items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-400/15 text-emerald-300">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-[13px] font-semibold text-fg">Admin</div>
          <div className="text-[11px] text-fg-subtle">Full access</div>
        </div>
        <button onClick={logout} aria-label="Log out" title="Log out" className="rounded-lg p-2 text-fg-subtle transition hover:bg-white/[0.08] hover:text-fg">
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-[268px] shrink-0 flex-col border-r border-white/[0.06] bg-bg-panel/80 p-4 pt-6 backdrop-blur-xl lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-white/[0.06] bg-bg/80 px-4 py-3 backdrop-blur-xl lg:hidden">
        <Link href="/studio">
          <Logo />
        </Link>
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="relative rounded-xl p-2 text-fg ring-1 ring-white/10 hover:bg-white/[0.06]">
          <Menu className="h-6 w-6" />
          {active > 0 && <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.9)]" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="flex h-full w-72 flex-col border-r border-white/10 bg-bg-panel p-4 pt-6"
              onClick={(e) => e.stopPropagation()}
            >
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-xl p-2 text-fg-muted hover:bg-white/[0.06]">
                <X className="h-5 w-5" />
              </button>
              {brand}
              {nav}
              {footer}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="relative min-w-0 flex-1 px-4 pb-16 pt-20 sm:px-6 lg:px-10 lg:pt-10">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
