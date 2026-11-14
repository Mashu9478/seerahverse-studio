import Link from "next/link";
import { Home } from "lucide-react";
import { Aurora } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden p-6 text-center">
      <Aurora />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/characters/ollie.png" alt="" className="h-36 w-36 animate-floaty object-contain drop-shadow-[0_20px_30px_rgba(0,0,0,0.6)]" />
      <div className="mt-6 font-display text-7xl font-semibold tracking-tight text-gradient">404</div>
      <h1 className="mt-3 text-2xl font-semibold text-fg">Oops — this page went on an adventure</h1>
      <p className="mt-2 max-w-md text-sm text-fg-muted">We couldn&apos;t find what you were looking for. Let&apos;s head back and keep learning.</p>
      <Link
        href="/"
        className="mt-8 inline-flex h-12 items-center gap-2 rounded-2xl bg-brand-grad px-6 font-display font-semibold text-white shadow-pop ring-1 ring-inset ring-white/20 transition hover:shadow-glow hover:brightness-110 active:scale-[0.97]"
      >
        <Home className="h-4 w-4" /> Back home
      </Link>
    </div>
  );
}
