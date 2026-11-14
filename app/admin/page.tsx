"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, useAnimationControls } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock, ShieldCheck } from "lucide-react";
import { Aurora, Button } from "@/components/ui";
import { LogoMark } from "@/components/Logo";
import { api } from "@/lib/client";

function LoginForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shake = useAnimationControls();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pw || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/login", { body: { password: pw } });
      const next = sp.get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/studio");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
      shake.start({ x: [0, -10, 10, -8, 8, -4, 4, 0], transition: { duration: 0.5 } });
    }
  }

  return (
    <motion.form animate={shake} onSubmit={submit} className="space-y-5" noValidate>
      <label className="block">
        <span className="label">Admin password</span>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input
            type={show ? "text" : "password"}
            autoFocus
            autoComplete="current-password"
            className="input h-12 pl-11 pr-12 text-base tracking-wide"
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              if (error) setError(null);
            }}
            placeholder="Enter your password"
            aria-invalid={!!error}
            aria-describedby={error ? "login-error" : undefined}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? "Hide password" : "Show password"}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-fg-subtle transition hover:bg-white/[0.06] hover:text-fg"
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </label>
      {error && (
        <motion.p
          id="login-error"
          role="alert"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-200"
        >
          <KeyRound className="h-4 w-4 shrink-0" /> {error}
        </motion.p>
      )}
      <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!pw} icon={!busy ? <ShieldCheck className="h-5 w-5" /> : undefined}>
        Sign in to Studio
      </Button>
    </motion.form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="relative isolate flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      <Aurora />
      <motion.div
        initial={{ y: 30, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 22 }}
        className="relative w-full max-w-md"
      >
        <div className="absolute -inset-px rounded-[2rem] bg-gradient-to-br from-brand-400/50 via-fuchsia-500/20 to-cyan-400/30 opacity-70 blur-[2px]" />
        <div className="relative rounded-[2rem] border border-white/10 bg-bg-card/90 p-8 shadow-[0_40px_120px_-30px_rgba(0,0,0,1)] backdrop-blur-2xl sm:p-10">
          <div className="mb-8 text-center">
            <motion.div
              initial={{ rotate: -8, scale: 0.8 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 220, damping: 12, delay: 0.1 }}
              className="mx-auto w-fit"
            >
              <LogoMark className="h-16 w-16 drop-shadow-[0_10px_30px_rgba(139,92,246,0.7)]" />
            </motion.div>
            <span className="eyebrow mt-6">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Restricted area
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-fg sm:text-3xl">Admin access</h1>
            <p className="mt-2 text-sm text-fg-muted">Sign in to create, review and publish SeerahVerse videos.</p>
          </div>
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </motion.div>
      <Link
        href="/"
        className="relative mt-8 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-fg-muted transition hover:bg-white/[0.06] hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" /> Back to site
      </Link>
    </div>
  );
}
