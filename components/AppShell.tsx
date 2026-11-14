"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clapperboard, Home, Layers, ListVideo, LogOut, Menu, Settings, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { api, celebrate, type VideoListItem } from "@/lib/client";
import { cx } from "./ui";

const NAV = [
  { href: "/", label: "Dashboard", icon: Home, color: "text-brand-500" },
  { href: "/create", label: "Create video", icon: Sparkles, color: "text-orange" },
  { href: "/batch", label: "Batch create", icon: Layers, color: "text-leaf" },
  { href: "/queue", label: "Queue", icon: ListVideo, color: "text-sky" },
  { href: "/library", label: "Library", icon: Clapperboard, color: "text-rose" },
  { href: "/settings", label: "Settings", icon: Settings, color: "text-slate-500" },
];

function Owl({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden>
      <rect width="64" height="64" rx="18" fill="#7B5CD6" />
      <path d="M16 13l7 8M48 13l-7 8" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
      <circle cx="23" cy="29" r="9.5" fill="#fff" />
      <circle cx="41" cy="29" r="9.5" fill="#fff" />
      <circle cx="24" cy="30" r="4.6" fill="#2B2045" />
      <circle cx="40" cy="30" r="4.6" fill="#2B2045" />
      <circle cx="25.5" cy="28" r="1.4" fill="#fff" />
      <circle cx="41.5" cy="28" r="1.4" fill="#fff" />
      <path d="M28 39h8l-4 7z" fill="#FF9F1C" />
    </svg>
  );
}

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
              toast.success(`🎉 “${name}” is ready!`, { action: { label: "Watch", onClick: () => router.push(`/library?open=${j.id}`) } });
            } else if (j.status === "review") {
              toast(`👀 Script ready for “${name}”`, { action: { label: "Review", onClick: () => router.push(`/videos/${j.id}/edit`) } });
            } else if (j.status === "failed") {
              toast.error(`⚠️ “${name}” failed`, { description: j.error ?? undefined, action: { label: "Open queue", onClick: () => router.push("/queue") } });
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
    router.push("/login");
  }

  const nav = (
    <nav className="flex flex-1 flex-col gap-1.5">
      {NAV.map((n) => {
        const on = n.href === "/" ? path === "/" : path.startsWith(n.href);
        const Icon = n.icon;
        const badge = n.href === "/queue" ? active : 0;
        return (
          <Link
            key={n.href}
            href={n.href}
            className={cx(
              "group relative flex items-center gap-3 rounded-2xl px-4 py-3 font-display text-[15px] font-semibold transition",
              on ? "bg-brand-500 text-white shadow-pop" : "text-ink hover:bg-brand-50",
            )}
          >
            <Icon className={cx("h-5 w-5 transition group-hover:scale-110", on ? "text-white" : n.color)} />
            {n.label}
            {badge > 0 && (
              <span className={cx("ml-auto rounded-full px-2 py-0.5 text-xs", on ? "bg-white text-brand-700" : "bg-orange text-white")}>
                {badge}
              </span>
            )}
            {n.href === "/queue" && review > 0 && (
              <span className={cx("rounded-full px-2 py-0.5 text-xs", badge ? "" : "ml-auto", "bg-sun text-ink")} title="Scripts waiting for review">
                👀 {review}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <Link href="/" className="mb-6 flex items-center gap-3 px-2">
      <Owl className="h-11 w-11 drop-shadow" />
      <div className="leading-tight">
        <div className="font-display text-lg font-semibold text-ink" style={{ fontKerning: "none" }}>SeerahVerse</div>
        <div className="text-xs font-bold uppercase tracking-wider text-brand-500">Video Studio</div>
      </div>
    </Link>
  );

  const footer = (
    <div className="mt-6 space-y-3">
      <Link
        href="/create"
        className="block rounded-3xl bg-gradient-to-br from-orange to-rose p-4 text-white shadow-soft transition hover:brightness-105"
      >
        <div className="font-display text-lg font-semibold">✨ New video</div>
        <div className="text-sm opacity-90">Topic in, cartoon out!</div>
      </Link>
      <button onClick={logout} className="flex w-full items-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold text-slate-500 hover:bg-brand-50">
        <LogOut className="h-4 w-4" /> Log out
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-brand-100 bg-white/80 p-5 backdrop-blur lg:flex">
        {brand}
        {nav}
        {footer}
      </aside>

      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-brand-100 bg-white/90 px-4 py-3 backdrop-blur lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Owl className="h-9 w-9" />
          <span className="font-display font-semibold">Video Studio</span>
        </Link>
        <button aria-label="Open menu" onClick={() => setOpen(true)} className="rounded-xl p-2 hover:bg-brand-50">
          <Menu className="h-6 w-6" />
          {active > 0 && <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-orange" />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-50 bg-ink/40 lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)}>
            <motion.aside
              initial={{ x: -320 }}
              animate={{ x: 0 }}
              exit={{ x: -320 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="flex h-full w-72 flex-col bg-white p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <button aria-label="Close menu" onClick={() => setOpen(false)} className="absolute right-3 top-3 rounded-xl p-2 hover:bg-brand-50">
                <X className="h-5 w-5" />
              </button>
              {brand}
              {nav}
              {footer}
            </motion.aside>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="min-w-0 flex-1 px-4 pb-16 pt-20 sm:px-6 lg:px-10 lg:pt-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
