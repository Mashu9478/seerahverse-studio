"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Cpu, Database, HardDrive, Hammer, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { AGE_GROUPS, AI_MODELS, SHORT_DURATIONS, type AppSettings } from "@/lib/constants";
import { api } from "@/lib/client";
import { Badge, Button, Card, Chip, Field, PageHeader, Skeleton, cx } from "@/components/ui";
import { StylePanel, type StyleValue } from "@/components/StylePanel";
import { styleFromSettings } from "@/components/useAppSettings";

interface EngineInfo {
  engine: {
    status: "none" | "building" | "snapshotting" | "ready" | "failed";
    snapshot_id?: string;
    engine_version?: string;
    build_version?: string;
    log?: string;
    error?: string;
    started_at?: string;
    finished_at?: string;
  };
  deployed_version: string;
  outdated: boolean;
  queued: number;
}

function EnginePanel() {
  const [info, setInfo] = useState<EngineInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLPreElement>(null);

  const load = useCallback(async () => {
    try {
      setInfo(await api<EngineInfo>("/api/engine"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't check the engine");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const building = info?.engine.status === "building" || info?.engine.status === "snapshotting";
  useEffect(() => {
    if (!building) return;
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, [building, load]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [info?.engine.log]);

  async function build() {
    setBusy(true);
    try {
      await api("/api/engine", { method: "POST" });
      toast.success("🔨 Building the render engine — this takes a few minutes.");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the build");
    } finally {
      setBusy(false);
    }
  }

  const st = info?.engine.status ?? "none";
  const meta: Record<string, { label: string; cls: string; emoji: string }> = {
    none: { label: "Not built (optional)", cls: "bg-slate-100 text-slate-700", emoji: "🧱" },
    building: { label: "Building…", cls: "bg-orange-soft text-orange-700", emoji: "🔨" },
    snapshotting: { label: "Saving…", cls: "bg-sky-soft text-sky", emoji: "📸" },
    ready: { label: "Ready", cls: "bg-leaf-soft text-green-800", emoji: "✅" },
    failed: { label: "Build failed", cls: "bg-red-100 text-red-700", emoji: "⚠️" },
  };

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Cpu className="h-5 w-5 text-brand-500" /> Render engine
          </h2>
          <p className="text-sm text-slate-500">
            Videos are drawn and narrated on Vercel Sandbox machines. Rendering works right away; building the engine (≈1–2 min, optional) saves a ready-made copy so each video starts ~30 s faster.
          </p>
        </div>
        {info ? (
          <Badge className={meta[st].cls}>
            {meta[st].emoji} {meta[st].label}
          </Badge>
        ) : (
          <Skeleton className="h-6 w-24" />
        )}
      </div>
      {info && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-brand-50 p-3">
            <div className="text-xs font-bold text-slate-500">Deployed engine</div>
            <div className="font-display text-lg font-semibold">{info.deployed_version}</div>
          </div>
          <div className="rounded-2xl bg-brand-50 p-3">
            <div className="text-xs font-bold text-slate-500">Built engine</div>
            <div className="font-display text-lg font-semibold">{info.engine.engine_version ?? "—"}</div>
          </div>
          <div className="rounded-2xl bg-brand-50 p-3">
            <div className="text-xs font-bold text-slate-500">Videos waiting</div>
            <div className="font-display text-lg font-semibold">{info.queued}</div>
          </div>
        </div>
      )}
      {info?.outdated && (
        <p className="mt-3 rounded-2xl bg-sun-soft p-3 text-sm font-semibold text-amber-900">
          ⚠️ A newer engine version is deployed. Renders always use the newest engine code; rebuild so the saved copy has any new tools too.
        </p>
      )}
      {info?.engine.error && <p className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{info.engine.error}</p>}
      {(building || (info?.engine.log && st !== "ready")) && (
        <pre ref={logRef} className="scrollbar-thin mt-3 max-h-64 overflow-auto rounded-2xl bg-ink p-4 font-mono text-xs leading-relaxed text-green-200">
          {info?.engine.log || "Starting…"}
        </pre>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant={st === "ready" && !info?.outdated ? "secondary" : "primary"}
          icon={<Hammer className="h-4 w-4" />}
          loading={busy || building}
          onClick={build}
        >
          {st === "ready" ? "Rebuild engine" : building ? "Building…" : "Build fast-start engine"}
        </Button>
        <Button variant="ghost" onClick={load}>
          Refresh status
        </Button>
      </div>
    </Card>
  );
}

function Tests() {
  const [busy, setBusy] = useState("");
  async function run(kind: "ai" | "db" | "blob") {
    setBusy(kind);
    try {
      const r = await api<{ message: string }>("/api/test", { body: { kind } });
      toast.success(r.message);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed", { duration: 10000 });
    } finally {
      setBusy("");
    }
  }
  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-xl font-semibold">🩺 Health checks</h2>
      <p className="text-sm text-slate-500">Make sure every part of the studio is connected.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="secondary" icon={<Sparkles className="h-4 w-4" />} loading={busy === "ai"} onClick={() => run("ai")}>
          Test AI
        </Button>
        <Button variant="secondary" icon={<Database className="h-4 w-4" />} loading={busy === "db"} onClick={() => run("db")}>
          Test database
        </Button>
        <Button variant="secondary" icon={<HardDrive className="h-4 w-4" />} loading={busy === "blob"} onClick={() => run("blob")}>
          Test storage
        </Button>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const [s, setS] = useState<AppSettings | null>(null);
  const [style, setStyle] = useState<StyleValue | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    api<{ settings: AppSettings }>("/api/settings").then((r) => {
      setS(r.settings);
      setStyle(styleFromSettings(r.settings));
    });
  }, []);

  const set = <K extends keyof AppSettings>(k: K, v: AppSettings[K]) => {
    setS((x) => (x ? { ...x, [k]: v } : x));
    setDirty(true);
  };

  async function save() {
    if (!s || !style) return;
    setSaving(true);
    try {
      const r = await api<{ settings: AppSettings }>("/api/settings", { method: "PUT", body: { ...s, ...style } });
      setS(r.settings);
      setDirty(false);
      toast.success("Settings saved ✅");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        emoji="🛠️"
        title="Settings"
        subtitle="Your channel, default style, AI and render engine."
        actions={
          <Button icon={<Save className="h-4 w-4" />} loading={saving} onClick={save} disabled={!dirty}>
            {dirty ? "Save changes" : "Saved"}
          </Button>
        }
      />

      <EnginePanel />

      {!s || !style ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 text-xl font-semibold">📺 Channel</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Channel name" hint="Shown on the title card, outro and thumbnail.">
                <input className="input" value={s.channel} maxLength={80} onChange={(e) => set("channel", e.target.value)} />
              </Field>
              <Field label="Tagline">
                <input className="input" value={s.tagline} maxLength={120} onChange={(e) => set("tagline", e.target.value)} />
              </Field>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 text-xl font-semibold">📐 Default format & audience</h2>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <span className="label">Default format</span>
                <div className="flex gap-2">
                  <Chip color="rose" active={s.format === "short"} onClick={() => set("format", "short")}>
                    📱 Short
                  </Chip>
                  <Chip active={s.format === "long"} onClick={() => set("format", "long")}>
                    🖥️ Long
                  </Chip>
                </div>
              </div>
              <div>
                <span className="label">Default age</span>
                <div className="flex flex-wrap gap-2">
                  {AGE_GROUPS.map((a) => (
                    <Chip key={a.id} color="orange" active={s.age_group === a.id} onClick={() => set("age_group", a.id)}>
                      {a.emoji} {a.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <Field label="Default Short length">
                <select className="input" value={s.short_seconds} onChange={(e) => set("short_seconds", parseInt(e.target.value, 10))}>
                  {SHORT_DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d < 60 ? `${d} seconds` : `${d / 60} min`}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={`Default long video length: ${s.long_minutes} min`}>
                <input type="range" min={1} max={20} value={s.long_minutes} onChange={(e) => set("long_minutes", parseInt(e.target.value, 10))} className="w-full" />
              </Field>
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 text-xl font-semibold">🎨 Default style</h2>
            <StylePanel
              value={style}
              onChange={(v) => {
                setStyle(v);
                setDirty(true);
              }}
            />
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 text-xl font-semibold">🧠 AI & rendering</h2>
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <span className="label">Script-writing model</span>
                <div className="space-y-2">
                  {AI_MODELS.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => set("model", m.id)}
                      className={cx(
                        "flex w-full items-center justify-between rounded-2xl border-2 p-3 text-left transition",
                        s.model === m.id ? "border-brand-500 bg-brand-50" : "border-brand-100 hover:border-brand-300",
                      )}
                    >
                      <span>
                        <span className="block font-display font-semibold">{m.name}</span>
                        <span className="text-xs text-slate-500">{m.desc}</span>
                      </span>
                      {s.model === m.id && <span className="text-xl">✅</span>}
                    </button>
                  ))}
                </div>
                <p className="hint">Runs through Vercel AI Gateway — no separate API key needed on Vercel.</p>
              </div>
              <Field label={`Videos rendering at the same time: ${s.max_parallel}`} hint="Vercel Hobby allows up to 10 machines at once. More = faster batches, but uses Sandbox hours quicker.">
                <input type="range" min={1} max={10} value={s.max_parallel} onChange={(e) => set("max_parallel", parseInt(e.target.value, 10))} className="w-full" />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>1</span>
                  <span>5</span>
                  <span>10</span>
                </div>
              </Field>
            </div>
          </Card>

          <Tests />

          <div className="flex justify-end">
            <Button size="lg" icon={<Save className="h-5 w-5" />} loading={saving} onClick={save} disabled={!dirty}>
              {dirty ? "Save changes" : "All saved"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
