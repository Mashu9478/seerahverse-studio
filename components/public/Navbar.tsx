"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, ShieldCheck, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { Logo } from "@/components/Logo";
import { cx } from "@/components/ui";

const LINKS = [
  { href: "/#lessons", label: "Lessons" },
  { href: "/#shorts", label: "Shorts" },
  { href: "/#how", label: "How we teach" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header className="sticky top-0 z-40">
      <div
        className={cx(
          "transition-all duration-300",
          scrolled ? "border-b border-white/[0.07] bg-bg/70 shadow-[0_10px_40px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl" : "border-b border-transparent",
        )}
      >
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8" aria-label="Main">
          <Link href="/" aria-label="SeerahVerse Academia home" className="rounded-xl">
            <Logo sub="Academia" />
          </Link>
          <div className="hidden items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1 backdrop-blur md:flex">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-full px-4 py-1.5 text-sm font-semibold text-fg-muted transition hover:bg-white/[0.07] hover:text-fg"
              >
                {l.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/admin"
              className="hidden items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-semibold text-fg-subtle ring-1 ring-inset ring-white/10 transition hover:bg-white/[0.06] hover:text-fg sm:inline-flex"
            >
              <ShieldCheck className="h-4 w-4" /> Admin
            </Link>
            <button
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="rounded-xl p-2 text-fg ring-1 ring-inset ring-white/10 hover:bg-white/[0.06] md:hidden"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
      </div>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-4 mt-2 rounded-2xl border border-white/10 bg-bg-elev/95 p-2 shadow-card backdrop-blur-xl md:hidden"
          >
            {LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-sm font-semibold text-fg-muted hover:bg-white/[0.06] hover:text-fg">
                {l.label}
              </a>
            ))}
            <Link href="/admin" className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold text-fg-subtle hover:bg-white/[0.06] hover:text-fg">
              <ShieldCheck className="h-4 w-4" /> Admin
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
