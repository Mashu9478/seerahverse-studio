"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { arrayMove } from "@dnd-kit/sortable";
import {
  AlertTriangle,
  ArrowLeft,
  Braces,
  Check,
  CircleAlert,
  Clock,
  CloudOff,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Palette,
  RefreshCw,
  Rocket,
  SlidersHorizontal,
  Sparkles,
  Wand2,
  MonitorPlay as Youtube,
} from "lucide-react";
import { toast } from "sonner";
import { SCENE_TYPES, STATUS_META } from "@/lib/constants";
import { ApiError, api, type VideoFull } from "@/lib/client";
import {
  PlanSchema,
  blankScene,
  describeIssues,
  fmtDuration,
  planSeconds,
  planWords,
  explainerBeats,
  sceneSeconds,
  type Scene,
  type VideoPlan,
  type YoutubeMeta,
} from "@/lib/plan";
import { Badge, Button, Card, IconButton, Modal, Segmented, Skeleton, cx } from "@/components/ui";
import { SceneForm } from "@/components/editor/SceneForm";
import { SceneList, typeMeta } from "@/components/editor/SceneList";
import { YoutubePanel } from "@/components/editor/YoutubePanel";
import { ExplainerEditor } from "@/components/editor/ExplainerEditor";
import { StylePanel, type StyleValue } from "@/components/StylePanel";
import { LanguageChip, URDU_FONT } from "@/components/LanguagePicker";
import { FormatPicker } from "@/components/FormatPicker";

type SideTab = "style" | "youtube" | "warnings" | "json";
type SaveState = "saved" | "saving" | "unsaved" | "error";

function StatusPill({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.draft;
  const live = ["scripting", "queued", "rendering", "uploading"].includes(status);
  return (
    <Badge className={m.color}>
      {live ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> : <span>{m.emoji}</span>}
      {m.label}
    </Badge>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const map = {
    saved: { icon: <Check className="h-3.5 w-3.5" />, text: "Saved", cls: "text-emerald-300" },
    saving: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, text: "Saving…", cls: "text-fg-muted" },
    unsaved: { icon: <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />, text: "Unsaved", cls: "text-amber-300" },
    error: { icon: <CloudOff className="h-3.5 w-3.5" />, text: "Not saved — retry", cls: "text-rose-300" },
  }[state];
  return (
    <AnimatePresence mode="wait">
      <motion.button
        key={state}
        type="button"
        onClick={state === "error" || state === "unsaved" ? onRetry : undefined}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        className={cx("flex items-center gap-1.5 text-xs font-semibold", map.cls)}
      >
        {map.icon}
        {map.text}
      </motion.button>
    </AnimatePresence>
  );
}

/** Estimated duration vs target with colour states. */
function DurationMeter({ total, target, short }: { total: number; target: number; short: boolean }) {
  const ratio = total / Math.max(1, target);
  const over = ratio > (short ? 1.08 : 1.2);
  const under = ratio < 0.75;
  const tone = over ? "#FB7185" : under ? "#FBBF24" : "#34D399";
  const msg = over ? "Too long" : under ? "A bit short" : "On target";
  return (
    <div className="flex min-w-[210px] items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-1.5">
      <Clock className="h-4 w-4 shrink-0" style={{ color: tone }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2 text-[11px] font-semibold">
          <span className="tabular-nums text-fg">
            ~{fmtDuration(total)} <span className="text-fg-subtle">/ {fmtDuration(target)}</span>
          </span>
          <span style={{ color: tone }}>{msg}</span>
        </div>
        <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: tone, boxShadow: `0 0 10px ${tone}` }}
            initial={false}
            animate={{ width: `${Math.min(100, ratio * (100 / 1.25))}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 22 }}
          />
          {/* target marker */}
          <span className="absolute inset-y-0 w-px bg-white/50" style={{ left: `${100 / 1.25}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [video, setVideo] = useState<VideoFull | null>(null);
  const [plan, setPlan] = useState<VideoPlan | null>(null);
  const [yt, setYt] = useState<YoutubeMeta>({ title: "", description: "", tags: [], hashtags: [] });
  const [keys, setKeys] = useState<string[]>([]);
  const [sel, setSel] = useState(0);
  const [side, setSide] = useState<SideTab>("style");
  const [sideOpen, setSideOpen] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [busy, setBusy] = useState("");
  const [issues, setIssues] = useState<string[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const version = useRef(0);

  const load = useCallback(async () => {
    try {
      const r = await api<{ video: VideoFull }>(`/api/videos/${id}`);
      setVideo(r.video);
      if (r.video.plan) {
        setPlan(r.video.plan);
        setKeys(r.video.plan.scenes.map((_, i) => `s${i}-${Date.now()}`));
        setJsonText(JSON.stringify(r.video.plan, null, 2));
      }
      if (r.video.youtube) setYt(r.video.youtube);
      setDirty(false);
      setSaveState("saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't load");
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // poll while the script is being written
  useEffect(() => {
    if (!video || video.status !== "scripting") return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [video, load]);

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const total = useMemo(() => (plan ? planSeconds(plan) : 0), [plan]);
  const words = useMemo(() => (plan ? planWords(plan) : 0), [plan]);
  const locked = !!video && ["queued", "rendering", "uploading"].includes(video.status);

  function markDirty() {
    version.current += 1;
    setDirty(true);
    setSaveState("unsaved");
  }
  function change(p: VideoPlan) {
    setPlan(p);
    markDirty();
  }
  function changeYt(y: YoutubeMeta) {
    setYt(y);
    markDirty();
  }
  function setScene(i: number, s: Scene) {
    if (!plan) return;
    change({ ...plan, scenes: plan.scenes.map((x, k) => (k === i ? s : x)) });
  }
  function insertScene(s: Scene, at: number) {
    if (!plan) return;
    const scenes = [...plan.scenes];
    scenes.splice(at, 0, s);
    const k = [...keys];
    k.splice(at, 0, `n${Date.now()}`);
    setKeys(k);
    change({ ...plan, scenes });
    setSel(at);
  }
  function deleteScene(i: number) {
    if (!plan || plan.scenes.length <= 1) return toast.error("A video needs at least one scene.");
    const removed = plan.scenes[i];
    const removedKey = keys[i];
    change({ ...plan, scenes: plan.scenes.filter((_, k) => k !== i) });
    setKeys(keys.filter((_, k) => k !== i));
    setSel(Math.max(0, Math.min(sel, plan.scenes.length - 2)));
    toast(`Scene ${i + 1} deleted`, {
      action: {
        label: "Undo",
        onClick: () =>
          setPlan((p) => {
            if (!p) return p;
            const scenes = [...p.scenes];
            scenes.splice(i, 0, removed);
            setKeys((ks) => {
              const c = [...ks];
              c.splice(i, 0, removedKey);
              return c;
            });
            markDirty();
            return { ...p, scenes };
          }),
      },
    });
  }
  function moveScene(from: number, to: number) {
    if (!plan || from < 0 || to < 0) return;
    change({ ...plan, scenes: arrayMove(plan.scenes, from, to) });
    setKeys(arrayMove(keys, from, to));
    if (sel === from) setSel(to);
  }

  const save = useCallback(
    async (silent = true) => {
      if (!plan) return false;
      const v = version.current;
      setSaveState("saving");
      try {
        await api(`/api/videos/${id}`, { method: "PATCH", body: { plan, youtube: yt } });
        if (version.current === v) {
          setDirty(false);
          setSaveState("saved");
        } else setSaveState("unsaved");
        if (!silent) toast.success("Saved");
        return true;
      } catch (e) {
        setSaveState("error");
        if (!silent) toast.error(e instanceof Error ? e.message : "Couldn't save");
        return false;
      }
    },
    [id, plan, yt],
  );

  // autosave 1.5 s after the last edit
  useEffect(() => {
    if (!dirty || locked || busy === "approve" || !plan) return;
    const t = setTimeout(() => save(true), 1500);
    return () => clearTimeout(t);
  }, [dirty, locked, busy, plan, yt, save]);

  // Ctrl/Cmd+S saves now
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!locked) save(false);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [save, locked]);

  async function approve() {
    if (!plan) return;
    const check = PlanSchema.safeParse(plan);
    if (!check.success) {
      setIssues(describeIssues(check.error));
      return;
    }
    setBusy("approve");
    try {
      const r = await api<{ warnings: string[] }>(`/api/videos/${id}/approve`, { body: { plan, youtube: yt } });
      setDirty(false);
      setSaveState("saved");
      toast.success("Sent to the render studio", {
        description: r.warnings.length ? `${r.warnings.length} note(s) to double-check later.` : "You'll get a notification when it's ready.",
      });
      router.push("/studio/queue");
    } catch (e) {
      if (e instanceof ApiError && e.issues) setIssues(e.issues);
      else toast.error(e instanceof Error ? e.message : "Couldn't start rendering");
      setBusy("");
    }
  }

  async function regenScene() {
    if (!plan) return;
    setBusy("regen-scene");
    try {
      const r = await api<{ scene: Scene }>(`/api/videos/${id}/regenerate-scene`, { body: { index: sel, instruction, plan } });
      setScene(sel, r.scene);
      setInstruction("");
      toast.success("Scene rewritten");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't rewrite the scene");
    } finally {
      setBusy("");
    }
  }

  async function regenAll() {
    setBusy("regen-all");
    try {
      await api(`/api/videos/${id}/generate`, { body: { review: true } });
      setRegenOpen(false);
      toast.success("Writing a fresh script…");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
    }
  }

  function validateJson(text: string) {
    setJsonText(text);
    try {
      const r = PlanSchema.safeParse(JSON.parse(text));
      setJsonError(r.success ? null : describeIssues(r.error)[0] ?? "Invalid script");
    } catch (e) {
      setJsonError("Not valid JSON: " + (e instanceof Error ? e.message : ""));
    }
  }

  function applyJson() {
    try {
      const parsed = JSON.parse(jsonText);
      const r = PlanSchema.safeParse(parsed);
      if (!r.success) {
        setIssues(describeIssues(r.error));
        return;
      }
      change(r.data);
      setKeys(r.data.scenes.map((_, i) => `j${i}-${Date.now()}`));
      setSel(0);
      toast.success("JSON applied");
    } catch (e) {
      toast.error("That isn't valid JSON: " + (e instanceof Error ? e.message : ""));
    }
  }

  /* ---------------- loading / writing states ---------------- */

  if (!video) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <div className="grid gap-4 lg:grid-cols-[290px_1fr] xl:grid-cols-[290px_1fr_360px]">
          <Skeleton className="h-[65vh]" />
          <Skeleton className="h-[65vh]" />
          <Skeleton className="hidden h-[65vh] xl:block" />
        </div>
      </div>
    );
  }

  if (!plan || video.status === "scripting") {
    const failed = video.status === "failed";
    return (
      <div className="relative mx-auto mt-6 max-w-xl">
        <div className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-brand-500/20 blur-3xl" />
        <Card className="p-10 text-center">
          <div className="relative mx-auto grid h-20 w-20 place-items-center">
            {!failed && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-brand-500/40" />}
            <motion.div
              animate={failed ? {} : { rotate: [0, -8, 8, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className={cx(
                "relative grid h-20 w-20 place-items-center rounded-3xl border border-white/10 text-4xl",
                failed ? "bg-rose-500/15" : "bg-gradient-to-br from-brand-500/40 to-fuchsia-500/20 shadow-glow",
              )}
            >
              {failed ? "😿" : "✍️"}
            </motion.div>
          </div>
          <h1 className="mt-6 text-2xl font-semibold text-fg">{failed ? "The script couldn't be written" : "Claude is writing the script…"}</h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">{failed ? video.error : video.message}</p>
          {!failed && (
            <div className="mx-auto mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full w-1/3 animate-[shimmer_1.4s_ease-in-out_infinite] rounded-full bg-brand-grad" style={{ transform: "translateX(-100%)" }} />
            </div>
          )}
          <div className="mt-8 flex justify-center gap-2">
            <Link href="/studio/queue">
              <Button variant="secondary" icon={<ArrowLeft className="h-4 w-4" />}>
                Back to queue
              </Button>
            </Link>
            {failed && (
              <Button
                icon={<RefreshCw className="h-4 w-4" />}
                onClick={async () => {
                  await api(`/api/videos/${id}/retry`, { method: "POST" }).catch((e) => toast.error(e.message));
                  load();
                }}
              >
                Try again
              </Button>
            )}
            {failed && (
              <Link href={`/studio/create?edit=${id}`}>
                <Button variant="secondary" icon={<SlidersHorizontal className="h-4 w-4" />}>
                  Edit options
                </Button>
              </Link>
            )}
          </div>
        </Card>
      </div>
    );
  }

  const isExplainer = plan.style === "explainer" || !!plan.explainer;
  const scene: Scene | undefined = plan.scenes[Math.min(sel, plan.scenes.length - 1)];
  const short = plan.format === "short";
  const stepCount = (plan.explainer?.parts ?? []).reduce((n, p) => n + p.steps.length, 0);
  const urdu = plan.language === "ur";
  const style: StyleValue = {
    language: urdu ? "ur" : "en",
    voice: plan.voice,
    speed: plan.speed,
    music: plan.music,
    sfx: plan.sfx,
    mascot: plan.mascot,
    presenter: plan.presenter ?? (plan.mascot ? "ollie" : "none"),
    style: isExplainer ? "explainer" : "presenter",
    captions: plan.captions,
    palette: plan.palette,
    chip: plan.brand.chip ?? "",
    greeting: plan.brand.greeting,
    subscribe: plan.brand.subscribe,
  };
  const warnings = video.warnings ?? [];
  const meta = scene ? typeMeta(scene.type) : null;

  const sideTabs: { value: SideTab; label: React.ReactNode }[] = [
    { value: "style", label: <span className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" />Style</span> },
    { value: "youtube", label: <span className="flex items-center gap-1.5"><Youtube className="h-3.5 w-3.5" />YouTube</span> },
    {
      value: "warnings",
      label: (
        <span className="flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          {warnings.length > 0 && <span className="rounded-full bg-amber-400/20 px-1.5 text-[10px] text-amber-300">{warnings.length}</span>}
        </span>
      ),
    },
    { value: "json", label: <span className="flex items-center gap-1.5"><Braces className="h-3.5 w-3.5" /></span> },
  ];

  return (
    <div className="space-y-5">
      {/* ===================== top bar ===================== */}
      <div className="card sticky top-16 z-30 p-3 lg:top-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Link
              href="/studio/queue"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-fg-muted ring-1 ring-white/10 transition hover:bg-white/[0.06] hover:text-fg"
              aria-label="Back to queue"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="min-w-0 flex-1">
              <input
                aria-label="Video title"
                dir={urdu ? "rtl" : undefined}
                style={urdu ? { fontFamily: URDU_FONT } : undefined}
                className="w-full rounded-lg border border-transparent bg-transparent px-2 py-0.5 font-display text-xl font-semibold text-fg outline-none transition hover:border-white/10 focus:border-brand-400/60 focus:bg-white/[0.04]"
                value={plan.title}
                onChange={(e) => change({ ...plan, title: e.target.value })}
                disabled={locked}
              />
              <div className="mt-1 flex flex-wrap items-center gap-2 px-2">
                <StatusPill status={video.status} />
                <Badge className={short ? "bg-pink-500/15 text-pink-300" : "bg-violet-500/15 text-violet-300"}>{short ? "📱 Short · 9:16" : "🖥️ Long · 16:9"}</Badge>
                {urdu && <LanguageChip value="ur" />}
                <span className="text-[11px] font-semibold text-fg-subtle">
                  {isExplainer ? `${stepCount} steps` : `${plan.scenes.length} scenes`} · {words} words
                </span>
                <span className="mx-1 hidden h-3 w-px bg-white/10 sm:block" />
                <SaveIndicator state={saveState} onRetry={() => save(false)} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DurationMeter total={total} target={plan.target_seconds} short={short} />
            <Button variant="secondary" size="md" icon={<RefreshCw className="h-4 w-4" />} onClick={() => setRegenOpen(true)} disabled={locked}>
              Regenerate
            </Button>
            <Button size="md" icon={<Rocket className="h-4 w-4" />} loading={busy === "approve"} onClick={approve} disabled={locked}>
              {video.status === "done" ? "Re-render" : "Approve & render"}
            </Button>
          </div>
        </div>
      </div>

      {locked && (
        <div className="flex items-center gap-3 rounded-2xl border border-cyan-400/25 bg-cyan-400/[0.07] p-3.5 text-sm text-cyan-200">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-300 opacity-60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-300" />
          </span>
          This video is in the render studio right now — editing is paused. Cancel it in the queue to make changes.
        </div>
      )}

      {/* ===================== 3 panes ===================== */}
      <div
        className={cx(
          "grid gap-5 lg:grid-cols-[290px_minmax(0,1fr)]",
          sideOpen ? "xl:grid-cols-[290px_minmax(0,1fr)_380px]" : "xl:grid-cols-[290px_minmax(0,1fr)_52px]",
        )}
      >
        {isExplainer ? (
          <ExplainerEditor plan={plan} onChange={change} locked={locked} />
        ) : scene && meta ? (
        <>
        {/* left: scenes */}
        <div className="lg:sticky lg:top-40 lg:self-start">
          <SceneList
            scenes={plan.scenes}
            keys={keys}
            sel={sel}
            speed={plan.speed}
            locked={locked}
            onSelect={setSel}
            onDup={(i) => insertScene(structuredClone(plan.scenes[i]), i + 1)}
            onDel={deleteScene}
            onMove={moveScene}
            onAdd={() => setAddOpen(true)}
          />
        </div>

        {/* center: selected scene */}
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={`scene-${keys[sel] ?? sel}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              <Card className={cx("overflow-hidden p-0", locked && "pointer-events-none opacity-60")}>
                <div className="relative border-b border-white/[0.06] p-5 sm:p-6">
                  <div className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-brand-500/20 blur-3xl" />
                  <div className="relative flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.1] to-white/[0.02] text-2xl">
                        {meta.emoji}
                      </span>
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">
                          Scene {sel + 1} of {plan.scenes.length}
                        </div>
                        <h2 className="text-xl font-semibold text-fg">{meta.name}</h2>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-semibold tabular-nums text-fg-muted">
                        ~{Math.round(sceneSeconds(scene, plan.speed))}s
                      </span>
                      <IconButton label="Previous scene" disabled={sel === 0} onClick={() => setSel(Math.max(0, sel - 1))} className="disabled:opacity-30">
                        <ArrowLeft className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        label="Next scene"
                        disabled={sel >= plan.scenes.length - 1}
                        onClick={() => setSel(Math.min(plan.scenes.length - 1, sel + 1))}
                        className="disabled:opacity-30"
                      >
                        <ArrowLeft className="h-4 w-4 rotate-180" />
                      </IconButton>
                    </div>
                  </div>

                  {/* AI rewrite */}
                  <div className="relative mt-5 rounded-2xl bg-gradient-to-r from-brand-500/40 via-fuchsia-500/30 to-cyan-400/30 p-px">
                    <div className="flex flex-col gap-2 rounded-[15px] bg-bg-elev/95 p-2 sm:flex-row sm:items-center">
                      <Sparkles className="ml-2 hidden h-4 w-4 shrink-0 text-brand-300 sm:block" />
                      <input
                        className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-fg outline-none placeholder:text-fg-subtle"
                        placeholder="Ask AI to rewrite this scene… e.g. “use apples instead”, “simpler words”, “make it a quiz”"
                        value={instruction}
                        onChange={(e) => setInstruction(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && busy !== "regen-scene" && regenScene()}
                      />
                      <Button size="sm" variant="warm" icon={<Wand2 className="h-4 w-4" />} loading={busy === "regen-scene"} onClick={regenScene}>
                        Rewrite scene
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="p-5 sm:p-6">
                  <SceneForm scene={scene} speed={plan.speed} short={short} onChange={(s) => setScene(sel, s)} />
                </div>
              </Card>
            </motion.div>
          </AnimatePresence>
        </div>
        </>
        ) : (
          <Card className="p-8 text-center text-sm text-fg-muted lg:col-span-2">This script has no scenes. Use “Regenerate” to write a new one.</Card>
        )}

        {/* right: side panel */}
        <div className="min-w-0 lg:col-span-2 xl:col-span-1 xl:sticky xl:top-40 xl:self-start">
          {sideOpen ? (
            <Card className="flex flex-col overflow-hidden p-0">
              <div className="flex items-center gap-2 border-b border-white/[0.06] p-2">
                <Segmented value={side} onChange={(v) => setSide(v)} options={sideTabs} className="flex-1 justify-between" />
                <IconButton label="Collapse panel" onClick={() => setSideOpen(false)} className="hidden xl:inline-flex">
                  <PanelRightClose className="h-4 w-4" />
                </IconButton>
              </div>
              <div className="scrollbar-thin overflow-y-auto p-4 xl:max-h-[calc(100vh-14rem)]">
                <AnimatePresence mode="wait">
                  <motion.div key={side} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }}>
                    {side === "style" && (
                      <div className={cx("space-y-7", locked && "pointer-events-none opacity-60")}>
                        {isExplainer ? (
                          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm text-fg-muted">
                            <div className="font-display text-sm font-semibold text-fg">{short ? "📱 Short · 9:16" : "🖥️ Long · 16:9"}</div>
                            <p className="mt-1 text-xs text-fg-subtle">The diagram was drawn for this screen shape. To change format or length, use “Regenerate”.</p>
                          </div>
                        ) : (
                        <div>
                          <h3 className="mb-3 font-display text-sm font-semibold text-fg">Format & length</h3>
                          <FormatPicker
                            speed={plan.speed}
                            value={{ format: plan.format, target_seconds: plan.target_seconds }}
                            onChange={(f) => change({ ...plan, format: f.format, target_seconds: f.target_seconds, strict_length: f.format === "short" })}
                          />
                          <p className="hint mt-2">Changing the format keeps your scenes — for big changes use “Regenerate”.</p>
                        </div>
                        )}
                        <div className="divider" />
                        <StylePanel
                          lockStyle
                          value={style}
                          onChange={(v) =>
                            change({
                              ...plan,
                              voice: v.voice,
                              speed: v.speed,
                              music: v.music,
                              sfx: v.sfx,
                              mascot: !isExplainer && v.presenter !== "none",
                              presenter: (isExplainer ? "none" : v.presenter) as typeof plan.presenter,
                              captions: v.captions,
                              palette: v.palette,
                              brand: { ...plan.brand, chip: v.chip || undefined, greeting: v.greeting, subscribe: v.subscribe },
                            })
                          }
                        />
                      </div>
                    )}

                    {side === "youtube" && <YoutubePanel value={yt} onChange={changeYt} />}

                    {side === "warnings" && (
                      <div className="space-y-3">
                        <h3 className="font-display text-sm font-semibold text-fg">Please double-check</h3>
                        {warnings.length === 0 ? (
                          <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.06] p-4 text-sm text-emerald-200">
                            <Check className="h-5 w-5" /> No warnings for this script.
                          </div>
                        ) : (
                          warnings.map((w, i) => (
                            <div key={i} className="flex gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/[0.06] p-3.5 text-sm text-amber-100">
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                              <span>{w}</span>
                            </div>
                          ))
                        )}
                        <p className="hint">Islamic references (ayah, hadith, Seerah) are always flagged — verify them with a trusted source before publishing.</p>
                        <div className="divider my-2" />
                        <h3 className="font-display text-sm font-semibold text-fg">{isExplainer ? "Narration checks" : "Scene checks"}</h3>
                        {isExplainer && explainerBeats(plan.explainer).some((b) => !b.say.trim()) && (
                          <div className="flex w-full items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] p-3 text-left text-sm text-rose-200">
                            <CircleAlert className="h-4 w-4 shrink-0" /> A step has an empty narration line
                          </div>
                        )}
                        {plan.scenes.map((s, i) => {
                          const empty = s.beats.some((b) => !b.say.trim());
                          if (!empty) return null;
                          return (
                            <button
                              key={i}
                              onClick={() => setSel(i)}
                              className="flex w-full items-center gap-2 rounded-xl border border-rose-400/20 bg-rose-500/[0.06] p-3 text-left text-sm text-rose-200 transition hover:bg-rose-500/10"
                            >
                              <CircleAlert className="h-4 w-4 shrink-0" /> Scene {i + 1} has an empty narration beat
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {side === "json" && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-display text-sm font-semibold text-fg">Script JSON</h3>
                          <div className="flex gap-1.5">
                            <Button size="sm" variant="ghost" onClick={() => validateJson(JSON.stringify(plan, null, 2))}>
                              Reset
                            </Button>
                            <Button size="sm" onClick={applyJson} disabled={locked || !!jsonError}>
                              Apply
                            </Button>
                          </div>
                        </div>
                        <div
                          className={cx(
                            "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold",
                            jsonError ? "bg-rose-500/10 text-rose-300" : "bg-emerald-400/10 text-emerald-300",
                          )}
                        >
                          {jsonError ? <CircleAlert className="h-3.5 w-3.5 shrink-0" /> : <Check className="h-3.5 w-3.5" />}
                          <span className="truncate">{jsonError ?? "Valid script"}</span>
                        </div>
                        <textarea
                          spellCheck={false}
                          className="input min-h-[55vh] bg-[#07060d] font-mono text-[11px] leading-relaxed text-[#C4B5FD]"
                          value={jsonText}
                          onChange={(e) => validateJson(e.target.value)}
                          aria-label="Script JSON"
                        />
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </Card>
          ) : (
            <div className="card hidden flex-col items-center gap-2 p-2 xl:flex">
              <IconButton label="Open panel" onClick={() => setSideOpen(true)}>
                <PanelRightOpen className="h-4 w-4" />
              </IconButton>
              {(["style", "youtube", "warnings", "json"] as SideTab[]).map((t) => {
                const Icon = { style: Palette, youtube: Youtube, warnings: AlertTriangle, json: Braces }[t];
                return (
                  <IconButton
                    key={t}
                    label={t}
                    onClick={() => {
                      setSide(t);
                      setSideOpen(true);
                    }}
                  >
                    <Icon className="h-4 w-4" />
                  </IconButton>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ===================== add scene ===================== */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add a scene" className="max-w-4xl">
        <p className="-mt-2 mb-5 text-sm text-fg-muted">It will be added after scene {sel + 1}. Fill it in yourself or ask AI to write it.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {SCENE_TYPES.map((t, i) => (
            <motion.button
              key={t.type}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.025 }}
              onClick={() => {
                insertScene(blankScene(t.type), Math.min(plan.scenes.length, sel + 1));
                setAddOpen(false);
              }}
              className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 text-left transition duration-300 hover:-translate-y-0.5 hover:border-brand-400/50 hover:shadow-glow"
            >
              <span className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full bg-brand-500/0 blur-2xl transition group-hover:bg-brand-500/40" />
              <div className="relative grid h-11 w-11 place-items-center rounded-xl bg-white/[0.06] text-2xl transition group-hover:scale-110">{t.emoji}</div>
              <div className="relative mt-3 font-display text-sm font-semibold text-fg">{t.name}</div>
              <div className="relative mt-0.5 text-xs text-fg-subtle">{t.desc}</div>
            </motion.button>
          ))}
        </div>
      </Modal>

      {/* ===================== rewrite all ===================== */}
      <Modal open={regenOpen} onClose={() => setRegenOpen(false)} title="Regenerate the whole script?" className="max-w-lg">
        <p className="text-sm text-fg-muted">Claude will write a brand-new script from your topic and details. Your current edits will be replaced.</p>
        <div className="mt-6 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRegenOpen(false)}>
            Keep my script
          </Button>
          <Button variant="warm" icon={<RefreshCw className="h-4 w-4" />} loading={busy === "regen-all"} onClick={regenAll}>
            Regenerate
          </Button>
        </div>
      </Modal>

      {/* ===================== validation issues ===================== */}
      <Modal open={!!issues} onClose={() => setIssues(null)} title="A few things to fix" className="max-w-lg">
        <ul className="space-y-2">
          {(issues ?? []).map((m, i) => (
            <li key={i} className="flex gap-2 rounded-xl border border-rose-400/20 bg-rose-500/[0.07] p-3 text-sm text-rose-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {m}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex justify-end">
          <Button onClick={() => setIssues(null)}>OK, I&apos;ll fix them</Button>
        </div>
      </Modal>
    </div>
  );
}
