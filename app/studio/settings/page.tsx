"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  Check,
  Cpu,
  Database,
  HardDrive,
  KeyRound,
  LayoutTemplate,
  LogOut,
  Palette,
  RotateCcw,
  Save,
  Sparkles,
  Stethoscope,
  Tv,
} from "lucide-react";
import { toast } from "sonner";
import { AGE_GROUPS, AI_MODELS, SHORT_DURATIONS, type AppSettings } from "@/lib/constants";
import { api } from "@/lib/client";
import { Button, Chip, Field, PageHeader, Segmented, Skeleton, cx } from "@/components/ui";
import { StylePanel, type StyleValue } from "@/components/StylePanel";
import { styleFromSettings } from "@/components/useAppSettings";
import { ResultPill, Section } from "@/components/settings/Section";
import { EnginePanel } from "@/components/settings/EnginePanel";

type TestState = { state: "idle" | "running" | "ok" | "fail"; text?: string };

const NAV = [
  { id: "channel", label: "Channel", icon: Tv },
  { id: "defaults", label: "Defaults", icon: LayoutTemplate },
  { id: "style", label: "Style & presenter", icon: Palette },
  { id: "ai", label: "AI", icon: Brain },
  { id: "rendering", label: "Rendering", icon: Cpu },
  { id: "health", label: "Health checks", icon: Stethoscope },
  { id: "account", label: "Account", icon: KeyRound },
];

function useTest() {
  const [t, setT] = useState<Record<string, TestState>>({});
  async function run(kind: "ai" | "db" | "blob") {
    setT((x) => ({ ...x, [kind]: { state: "running" } }));
    try {
      const r = await api<{ message: string }>("/api/test", { body: { kind } });
      setT((x) => ({ ...x, [kind]: { state: "ok", text: r.message.replace(/\s*✓\s*/, " ").trim() } }));
    } catch (e) {
      setT((x) => ({ ...x, [kind]: { state: "fail", text: e instanceof Error ? e.message : "Test failed" } }));
    }
  }
  return { t, run };
}

export default function SettingsPage() {
  const router = useRouter();
  const [saved, setSaved] = useState<AppSettings | null>(null);
  const [s, setS] = useState<AppSettings | null>(null);
  const [style, setStyle] = useState<StyleValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [section, setSection] = useState("channel");
  const { t, run } = useTest();

  useEffect(() => {
    api<{ settings: AppSettings }>("/api/settings")
      .then((r) => {
        setSaved(r.settings);
        setS(r.settings);
        setStyle(styleFromSettings(r.settings));
      })
      .catch((e) => toast.error(e instanceof Error ? e.message : "Couldn't load settings"));
  }, []);

  // highlight the section in view
  useEffect(() => {
    if (!s) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (vis) setSection(vis.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px" },
    );
    NAV.forEach((n) => {
      const el = document.getElementById(n.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, [s]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => {
    setS((x) => (x ? { ...x, [k]: v } : x));
    setDirty(true);
  };

  async function save() {
    if (!s || !style) return;
    setSaving(true);
    try {
      const r = await api<{ settings: AppSettings }>("/api/settings", { method: "PUT", body: { ...s, ...style } });
      setSaved(r.settings);
      setS(r.settings);
      setStyle(styleFromSettings(r.settings));
      setDirty(false);
      toast.success("Settings saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  function discard() {
    if (!saved) return;
    setS(saved);
    setStyle(styleFromSettings(saved));
    setDirty(false);
  }

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.push("/admin");
  }

  return (
    <div className="pb-24">
      <PageHeader emoji="🛠️" title="Settings" subtitle="Your channel, the default look of new videos, AI and the render engine." />

      <div className="grid gap-6 xl:grid-cols-[200px_minmax(0,1fr)]">
        {/* section nav */}
        <nav className="hidden xl:block">
          <div className="sticky top-8 space-y-1">
            {NAV.map((n) => {
              const on = section === n.id;
              return (
                <a
                  key={n.id}
                  href={`#${n.id}`}
                  className={cx(
                    "relative flex items-center gap-2.5 rounded-xl px-3 py-2 text-[13px] font-semibold transition",
                    on ? "text-fg" : "text-fg-subtle hover:bg-white/[0.04] hover:text-fg-muted",
                  )}
                >
                  {on && (
                    <motion.span layoutId="settings-nav" className="absolute inset-0 rounded-xl border border-white/10 bg-white/[0.06]" transition={{ type: "spring", stiffness: 400, damping: 34 }} />
                  )}
                  <n.icon className={cx("relative h-4 w-4", on && "text-brand-300")} />
                  <span className="relative">{n.label}</span>
                </a>
              );
            })}
          </div>
        </nav>

        {!s || !style ? (
          <div className="space-y-5">
            <Skeleton className="h-48" />
            <Skeleton className="h-72" />
            <Skeleton className="h-96" />
          </div>
        ) : (
          <div className="min-w-0 space-y-6">
            <Section id="channel" icon={<Tv className="h-5 w-5" />} title="Channel" desc="Shown on the title card, outro, thumbnails and the public site." tone="violet">
              <div className="grid gap-4 md:grid-cols-2">
                <Field label="Channel name">
                  <input className="input" value={s.channel} maxLength={80} onChange={(e) => set("channel", e.target.value)} />
                </Field>
                <Field label="Tagline">
                  <input className="input" value={s.tagline} maxLength={120} onChange={(e) => set("tagline", e.target.value)} />
                </Field>
              </div>
            </Section>

            <Section id="defaults" icon={<LayoutTemplate className="h-5 w-5" />} title="Defaults for new videos" desc="Pre-filled in Create and Batch — you can still change them per video." tone="cyan">
              <div className="grid gap-6 md:grid-cols-2">
                <div>
                  <span className="label">Format</span>
                  <Segmented
                    value={s.format as "long" | "short"}
                    onChange={(v) => set("format", v)}
                    options={[
                      { value: "long", label: "🖥️ Long · 16:9" },
                      { value: "short", label: "📱 Short · 9:16" },
                    ]}
                  />
                </div>
                <div>
                  <span className="label">Age group</span>
                  <div className="flex flex-wrap gap-2">
                    {AGE_GROUPS.map((a) => (
                      <Chip key={a.id} color="orange" active={s.age_group === a.id} onClick={() => set("age_group", a.id)}>
                        {a.emoji} {a.label}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="label">Short length</span>
                  <div className="flex flex-wrap gap-1.5">
                    {SHORT_DURATIONS.map((d) => (
                      <Chip key={d} color="rose" active={s.short_seconds === d} onClick={() => set("short_seconds", d)}>
                        {d < 60 ? `${d}s` : `${d / 60} min`}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="label flex items-center justify-between">
                    Long video length <span className="normal-case tracking-normal text-fg">{s.long_minutes} min</span>
                  </span>
                  <input type="range" min={1} max={20} value={s.long_minutes} onChange={(e) => set("long_minutes", parseInt(e.target.value, 10))} className="w-full" />
                  <div className="flex justify-between text-[11px] text-fg-subtle">
                    <span>1 min</span>
                    <span>10</span>
                    <span>20 min</span>
                  </div>
                </div>
              </div>
            </Section>

            <Section id="style" icon={<Palette className="h-5 w-5" />} title="Style & presenter" desc="Default presenter character, voice, music, colours and extras." tone="pink">
              <StylePanel
                value={style}
                onChange={(v) => {
                  setStyle(v);
                  setDirty(true);
                }}
              />
            </Section>

            <Section
              id="ai"
              icon={<Brain className="h-5 w-5" />}
              title="AI script writer"
              desc="Claude writes every script through Vercel AI Gateway (or your ANTHROPIC_API_KEY if set)."
              tone="amber"
              right={
                <div className="flex items-center gap-2">
                  <ResultPill state={t.ai?.state ?? "idle"} text={t.ai?.text} />
                  <Button size="sm" variant="secondary" icon={<Sparkles className="h-4 w-4" />} loading={t.ai?.state === "running"} onClick={() => run("ai")}>
                    Test AI
                  </Button>
                </div>
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                {AI_MODELS.map((m) => {
                  const on = s.model === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => set("model", m.id)}
                      className={cx(
                        "relative flex items-start gap-3 overflow-hidden rounded-2xl border p-4 text-left transition duration-300",
                        on ? "border-brand-400/50 bg-brand-500/[0.1] shadow-glow" : "border-white/[0.08] bg-white/[0.025] hover:border-white/20",
                      )}
                    >
                      <span className={cx("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border", on ? "border-transparent bg-brand-grad" : "border-white/25")}>
                        {on && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                      </span>
                      <span>
                        <span className="block font-display text-sm font-semibold text-fg">{m.name}</span>
                        <span className="mt-0.5 block text-xs text-fg-muted">{m.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section id="rendering" icon={<Cpu className="h-5 w-5" />} title="Rendering" desc="How many videos are made at once, and the optional fast-start engine." tone="sky">
              <div className="space-y-6">
                <div>
                  <span className="label flex items-center justify-between">
                    Videos rendering at the same time
                    <span className="rounded-lg bg-white/[0.06] px-2 py-0.5 font-display text-sm normal-case tracking-normal text-fg">{s.max_parallel}</span>
                  </span>
                  <input type="range" min={1} max={10} value={s.max_parallel} onChange={(e) => set("max_parallel", parseInt(e.target.value, 10))} className="w-full" />
                  <div className="mt-1 flex justify-between gap-1">
                    {Array.from({ length: 10 }, (_, i) => (
                      <span key={i} className={cx("h-1 flex-1 rounded-full transition", i < s.max_parallel ? "bg-brand-grad" : "bg-white/[0.07]")} />
                    ))}
                  </div>
                  <p className="hint">Vercel Hobby allows up to 10 machines at once. More = faster batches, but uses Sandbox hours quicker.</p>
                </div>
                <div className="divider" />
                <EnginePanel />
              </div>
            </Section>

            <Section id="health" icon={<Stethoscope className="h-5 w-5" />} title="Health checks" desc="Make sure every part of the studio is connected." tone="emerald">
              <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.07]">
                {(
                  [
                    { kind: "ai", label: "AI script writer", icon: Sparkles },
                    { kind: "db", label: "Database (Neon)", icon: Database },
                    { kind: "blob", label: "Video storage (Blob)", icon: HardDrive },
                  ] as const
                ).map((c) => (
                  <div key={c.kind} className="flex flex-wrap items-center gap-3 bg-white/[0.02] p-3.5">
                    <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.06] text-fg-muted">
                      <c.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-[140px] text-sm font-semibold text-fg">{c.label}</span>
                    <span className="min-w-0 flex-1">
                      <ResultPill state={t[c.kind]?.state ?? "idle"} text={t[c.kind]?.text} />
                    </span>
                    <Button size="sm" variant="secondary" loading={t[c.kind]?.state === "running"} onClick={() => run(c.kind)}>
                      Run check
                    </Button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    run("ai");
                    run("db");
                    run("blob");
                  }}
                >
                  Run all checks
                </Button>
              </div>
            </Section>

            <Section id="account" icon={<KeyRound className="h-5 w-5" />} title="Admin account" desc="Only you can open the studio; visitors only see the public site." tone="slate">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="max-w-xl text-[13px] text-fg-muted">
                  The admin password lives in <span className="font-semibold text-fg">Vercel → ai-vid-gen → Settings → Environment Variables → APP_PASSWORD</span>. Change it there and redeploy to update it.
                </p>
                <Button variant="danger" icon={<LogOut className="h-4 w-4" />} onClick={logout}>
                  Log out
                </Button>
              </div>
            </Section>
          </div>
        )}
      </div>

      {/* sticky save bar */}
      <AnimatePresence>
        {dirty && (
          <motion.div
            initial={{ y: 90, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 90, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="fixed inset-x-0 bottom-5 z-40 flex justify-center px-4 lg:pl-[268px]"
          >
            <div className="flex w-full max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-bg-elev/90 p-2.5 pl-4 shadow-[0_30px_80px_-20px_rgba(0,0,0,1)] backdrop-blur-xl">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.9)]" />
              <span className="flex-1 text-sm font-semibold text-fg">You have unsaved changes</span>
              <Button size="sm" variant="ghost" icon={<RotateCcw className="h-4 w-4" />} onClick={discard}>
                Discard
              </Button>
              <Button size="sm" icon={<Save className="h-4 w-4" />} loading={saving} onClick={save}>
                Save changes
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
