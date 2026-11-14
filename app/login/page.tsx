"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui";
import { api } from "@/lib/client";

const FLOATERS = ["🍎", "🔢", "🌙", "⭐", "📚", "🐟", "🧮", "🌍", "✏️", "🎨"];

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth/login", { body: { password: pw } });
      const next = sp.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="label">Studio password</span>
        <div className="relative">
          <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-brand-400" />
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            className="input pl-11 text-lg"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="••••••••"
          />
        </div>
      </label>
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!pw}>
        Let&apos;s make videos! 🚀
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      {FLOATERS.map((e, i) => (
        <motion.span
          key={i}
          className="pointer-events-none absolute select-none text-4xl opacity-60 sm:text-5xl"
          style={{ left: `${(i * 97) % 100}%`, top: `${(i * 53 + 7) % 100}%` }}
          animate={{ y: [0, -18, 0], rotate: [0, i % 2 ? 10 : -10, 0] }}
          transition={{ duration: 4 + (i % 3), repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
        >
          {e}
        </motion.span>
      ))}
      <motion.div
        initial={{ y: 30, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
        className="card relative w-full max-w-md p-8"
      >
        <div className="mb-6 text-center">
          <motion.div animate={{ rotate: [0, -6, 6, 0] }} transition={{ duration: 2.4, repeat: Infinity }} className="mx-auto mb-3 w-fit text-6xl">
            🦉
          </motion.div>
          <h1 className="text-3xl font-semibold" style={{ fontKerning: "none" }}>SeerahVerse Video Studio</h1>
          <p className="mt-1 text-slate-500">Turn any lesson into a fun, narrated cartoon for YouTube.</p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </motion.div>
    </div>
  );
}
