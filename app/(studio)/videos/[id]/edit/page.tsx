"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, ArrowLeft, Braces, Copy, GripVertical, Plus, RefreshCw, Rocket, Save, Settings2, Trash2, Wand2, MonitorPlay as Youtube } from "lucide-react";
import { toast } from "sonner";
import { SCENE_TYPES } from "@/lib/constants";
import { ApiError, api, type VideoFull } from "@/lib/client";
import { PlanSchema, blankScene, describeIssues, fmtDuration, planSeconds, planWords, sceneSeconds, type Scene, type VideoPlan, type YoutubeMeta } from "@/lib/plan";
import { Badge, Button, Card, Modal, Skeleton, cx } from "@/components/ui";
import { SceneForm } from "@/components/editor/SceneForm";
import { StylePanel, type StyleValue } from "@/components/StylePanel";
import { FormatPicker } from "@/components/FormatPicker";
import { StatusBadge } from "@/components/VideoCard";

const typeMeta = (t: string) => SCENE_TYPES.find((s) => s.type === t) ?? SCENE_TYPES[0];

function sceneLabel(s: Scene): string {
  switch (s.type) {
    case "title":
    case "outro":
      return s.title;
    case "quiz":
      return s.question;
    default:
      return "heading" in s ? s.heading : "";
  }
}

function SceneItem({ id, scene, index, active, speed, onSelect, onDup, onDel }: { id: string; scene: Scene; index: number; active: boolean; speed: number; onSelect: () => void; onDup: () => void; onDel: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const m = typeMeta(scene.type);
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cx(
        "group flex items-center gap-2 rounded-2xl border-2 bg-white p-2 pr-1 transition",
        active ? "border-brand-500 shadow-pop" : "border-transparent hover:border-brand-200",
        isDragging && "z-10 opacity-80 shadow-xl",
      )}
    >
      <button {...attributes} {...listeners} aria-label="Drag to reorder" className="cursor-grab touch-none rounded-lg p-1 text-slate-300 hover:text-brand-500 active:cursor-grabbing">
        <GripVertical className="h-4 w-4" />
      </button>
      <button onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl", active ? "bg-brand-500" : "bg-brand-50")}>{m.emoji}</span>
        <span className="min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-brand-500">
            {index + 1}. {m.name} · {Math.round(sceneSeconds(scene, speed))}s
          </span>
          <span className="block truncate text-sm font-semibold">{sceneLabel(scene) || scene.beats[0]?.say || "—"}</span>
        </span>
      </button>
      <div className="flex flex-col opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
        <button onClick={onDup} aria-label="Duplicate scene" className="rounded-lg p-1 text-brand-500 hover:bg-brand-50">
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button onClick={onDel} aria-label="Delete scene" className="rounded-lg p-1 text-red-500 hover:bg-red-50">
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

type Tab = "scene" | "youtube" | "settings" | "json";

export default function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [video, setVideo] = useState<VideoFull | null>(null);
  const [plan, setPlan] = useState<VideoPlan | null>(null);
  const [yt, setYt] = useState<YoutubeMeta>({ title: "", description: "", tags: [], hashtags: [] });
  const [keys, setKeys] = useState<string[]>([]);
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState<Tab>("scene");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [issues, setIssues] = useState<string[] | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [regenOpen, setRegenOpen] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [jsonText, setJsonText] = useState("");
  const [showWarnings, setShowWarnings] = useState(true);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const load = useCallback(async () => {
    try {
      const r = await api<{ video: VideoFull }>(`/api/videos/${id}`);
      setVideo(r.video);
      if (r.video.plan) {
        setPlan(r.video.plan);
        setKeys(r.video.plan.scenes.map((_, i) => `s${i}-${Date.now()}`));
      }
      if (r.video.youtube) setYt(r.video.youtube);
      setDirty(false);
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

  function change(p: VideoPlan) {
    setPlan(p);
    setDirty(true);
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
    setTab("scene");
  }
  function deleteScene(i: number) {
    if (!plan || plan.scenes.length <= 1) return toast.error("A video needs at least one scene.");
    change({ ...plan, scenes: plan.scenes.filter((_, k) => k !== i) });
    setKeys(keys.filter((_, k) => k !== i));
    setSel(Math.max(0, Math.min(sel, plan.scenes.length - 2)));
  }
  function onDragEnd(e: DragEndEvent) {
    if (!plan || !e.over || e.active.id === e.over.id) return;
    const from = keys.indexOf(String(e.active.id));
    const to = keys.indexOf(String(e.over.id));
    change({ ...plan, scenes: arrayMove(plan.scenes, from, to) });
    setKeys(arrayMove(keys, from, to));
    if (sel === from) setSel(to);
  }

  async function save(silent = false) {
    if (!plan) return false;
    setBusy("save");
    try {
      await api(`/api/videos/${id}`, { method: "PATCH", body: { plan, youtube: yt } });
      setDirty(false);
      if (!silent) toast.success("Saved ✅");
      return true;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
      return false;
    } finally {
      setBusy("");
    }
  }

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
      toast.success("🎬 Sent to the render studio!", { description: r.warnings.length ? `${r.warnings.length} note(s) to double-check later.` : undefined });
      router.push("/queue");
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
      toast.success("✨ Scene rewritten");
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
      toast.success("✍️ Writing a fresh script…");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy("");
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
      setTab("scene");
    } catch (e) {
      toast.error("That isn't valid JSON: " + (e instanceof Error ? e.message : ""));
    }
  }

  /* ---------------- render ---------------- */

  if (!video) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16" />
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <Skeleton className="h-[60vh]" />
          <Skeleton className="h-[60vh]" />
        </div>
      </div>
    );
  }

  if (!plan || video.status === "scripting") {
    return (
      <Card className="mx-auto max-w-xl p-8 text-center">
        <motion.div animate={{ rotate: [0, -8, 8, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-6xl">
          {video.status === "failed" ? "😿" : "✍️"}
        </motion.div>
        <h1 className="mt-3 text-2xl font-semibold">{video.status === "failed" ? "The script couldn't be written" : "Claude is writing the script…"}</h1>
        <p className="mt-1 text-slate-500">{video.status === "failed" ? video.error : video.message}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/queue">
            <Button variant="secondary">Back to queue</Button>
          </Link>
          {video.status === "failed" && (
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
        </div>
      </Card>
    );
  }

  const scene = plan.scenes[Math.min(sel, plan.scenes.length - 1)];
  const short = plan.format === "short";
  const over = total > plan.target_seconds * (short ? 1.08 : 1.2);
  const under = total < plan.target_seconds * 0.75;
  const style: StyleValue = {
    voice: plan.voice,
    speed: plan.speed,
    music: plan.music,
    sfx: plan.sfx,
    mascot: plan.mascot,
    captions: plan.captions,
    palette: plan.palette,
    chip: plan.brand.chip ?? "",
    greeting: plan.brand.greeting,
    subscribe: plan.brand.subscribe,
  };

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="card sticky top-16 z-30 flex flex-col gap-3 p-3 sm:p-4 lg:top-4 lg:flex-row lg:items-center">
        <Link href="/queue" className="hidden rounded-xl p-2 text-brand-600 hover:bg-brand-50 lg:block" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <input
            aria-label="Video title"
            className="w-full rounded-xl border-2 border-transparent bg-transparent px-2 py-1 font-display text-2xl font-semibold outline-none hover:border-brand-100 focus:border-brand-300"
            value={plan.title}
            onChange={(e) => change({ ...plan, title: e.target.value })}
          />
          <div className="flex flex-wrap items-center gap-2 px-2 text-sm">
            <StatusBadge status={video.status} />
            <Badge className={short ? "bg-rose-soft text-rose" : "bg-brand-50 text-brand-700"}>{short ? "📱 Short" : "🖥️ Long"}</Badge>
            <Badge className={over ? "bg-red-100 text-red-700" : under ? "bg-sun-soft text-amber-800" : "bg-leaf-soft text-green-800"}>
              ⏱️ ~{fmtDuration(total)} / target {fmtDuration(plan.target_seconds)}
            </Badge>
            <span className="text-xs font-semibold text-slate-400">
              {plan.scenes.length} scenes · {words} words
            </span>
            {dirty && <span className="text-xs font-bold text-orange-600">● unsaved</span>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" size="sm" icon={<RefreshCw className="h-4 w-4" />} onClick={() => setRegenOpen(true)} disabled={locked}>
            Rewrite all
          </Button>
          <Button variant="secondary" size="sm" icon={<Save className="h-4 w-4" />} loading={busy === "save"} onClick={() => save()} disabled={!dirty || locked}>
            Save
          </Button>
          <Button variant="success" icon={<Rocket className="h-4 w-4" />} loading={busy === "approve"} onClick={approve} disabled={locked}>
            {video.status === "done" ? "Re-render" : "Approve & render"}
          </Button>
        </div>
      </div>

      {locked && <p className="rounded-2xl bg-sky-soft p-3 text-sm font-semibold text-sky">🎨 This video is in the render studio right now — editing is paused. Cancel it in the queue to make changes.</p>}

      <AnimatePresence>
        {video.warnings?.length > 0 && showWarnings && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="rounded-3xl border-2 border-sun bg-sun-soft p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="flex items-center gap-2 font-semibold text-amber-900">
                  <AlertTriangle className="h-5 w-5" /> Please double-check ({video.warnings.length})
                </h3>
                <button onClick={() => setShowWarnings(false)} className="text-sm font-bold text-amber-800 hover:underline">
                  Hide
                </button>
              </div>
              <ul className="mt-2 list-disc space-y-1 pl-6 text-sm text-amber-900">
                {video.warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid gap-5 lg:grid-cols-[330px_minmax(0,1fr)]">
        {/* scene list */}
        <div className="lg:sticky lg:top-40 lg:max-h-[calc(100vh-11rem)] lg:self-start lg:overflow-y-auto lg:pr-1 scrollbar-thin">
          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between px-1">
              <h2 className="text-lg font-semibold">🎬 Scenes</h2>
              <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => setAddOpen(true)} disabled={locked}>
                Add
              </Button>
            </div>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={keys} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {plan.scenes.map((s, i) => (
                    <SceneItem
                      key={keys[i] ?? i}
                      id={keys[i] ?? String(i)}
                      scene={s}
                      index={i}
                      speed={plan.speed}
                      active={i === sel && tab === "scene"}
                      onSelect={() => {
                        setSel(i);
                        setTab("scene");
                      }}
                      onDup={() => insertScene(structuredClone(s), i + 1)}
                      onDel={() => deleteScene(i)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
            <div className="mt-3 grid grid-cols-3 gap-1.5 border-t border-brand-100 pt-3">
              {(
                [
                  { t: "youtube", label: "YouTube", icon: Youtube },
                  { t: "settings", label: "Style", icon: Settings2 },
                  { t: "json", label: "JSON", icon: Braces },
                ] as const
              ).map((b) => (
                <button
                  key={b.t}
                  onClick={() => {
                    if (b.t === "json") setJsonText(JSON.stringify(plan, null, 2));
                    setTab(b.t);
                  }}
                  className={cx(
                    "flex flex-col items-center gap-1 rounded-2xl py-2 text-xs font-bold transition",
                    tab === b.t ? "bg-brand-500 text-white" : "bg-brand-50 text-brand-700 hover:bg-brand-100",
                  )}
                >
                  <b.icon className="h-4 w-4" />
                  {b.label}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* editor */}
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div key={tab === "scene" ? `scene-${keys[sel]}` : tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
              {tab === "scene" && scene && (
                <Card className={cx("p-5 sm:p-6", locked && "pointer-events-none opacity-60")}>
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-2xl">{typeMeta(scene.type).emoji}</span>
                      <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-brand-500">Scene {sel + 1}</div>
                        <h2 className="text-xl font-semibold">{typeMeta(scene.type).name}</h2>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-slate-400">~{Math.round(sceneSeconds(scene, plan.speed))} seconds</span>
                  </div>
                  <div className="mb-6 flex flex-col gap-2 rounded-3xl bg-gradient-to-r from-brand-50 to-orange-soft p-3 sm:flex-row">
                    <input
                      className="input flex-1 border-transparent"
                      placeholder="✨ Ask AI to rewrite this scene… e.g. “use apples instead”, “make it a quiz”, “simpler words”"
                      value={instruction}
                      onChange={(e) => setInstruction(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && regenScene()}
                    />
                    <Button variant="warm" icon={<Wand2 className="h-4 w-4" />} loading={busy === "regen-scene"} onClick={regenScene}>
                      Rewrite scene
                    </Button>
                  </div>
                  <SceneForm scene={scene} speed={plan.speed} short={short} onChange={(s) => setScene(sel, s)} />
                </Card>
              )}

              {tab === "youtube" && (
                <Card className="space-y-4 p-5 sm:p-6">
                  <h2 className="flex items-center gap-2 text-xl font-semibold">
                    <Youtube className="h-6 w-6 text-red-500" /> YouTube details
                  </h2>
                  <label className="block">
                    <span className="label flex justify-between">
                      Title <span className={cx("text-xs", yt.title.length > 100 ? "text-red-500" : "text-slate-400")}>{yt.title.length}/100</span>
                    </span>
                    <input
                      className="input text-lg font-semibold"
                      value={yt.title}
                      onChange={(e) => {
                        setYt({ ...yt, title: e.target.value });
                        setDirty(true);
                      }}
                    />
                  </label>
                  <label className="block">
                    <span className="label">Description</span>
                    <textarea
                      className="input min-h-[220px]"
                      value={yt.description}
                      onChange={(e) => {
                        setYt({ ...yt, description: e.target.value });
                        setDirty(true);
                      }}
                    />
                  </label>
                  <label className="block">
                    <span className="label">Tags (comma separated)</span>
                    <input
                      className="input"
                      value={yt.tags.join(", ")}
                      onChange={(e) => {
                        setYt({ ...yt, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) });
                        setDirty(true);
                      }}
                    />
                  </label>
                  <label className="block">
                    <span className="label">Hashtags (space separated)</span>
                    <input
                      className="input"
                      value={yt.hashtags.join(" ")}
                      onChange={(e) => {
                        setYt({ ...yt, hashtags: e.target.value.split(/\s+/).filter(Boolean).map((h) => (h.startsWith("#") ? h : `#${h}`)) });
                        setDirty(true);
                      }}
                    />
                  </label>
                </Card>
              )}

              {tab === "settings" && (
                <Card className={cx("space-y-8 p-5 sm:p-6", locked && "pointer-events-none opacity-60")}>
                  <div>
                    <h2 className="mb-4 text-xl font-semibold">📐 Format & length</h2>
                    <FormatPicker
                      speed={plan.speed}
                      value={{ format: plan.format, target_seconds: plan.target_seconds }}
                      onChange={(f) => change({ ...plan, format: f.format, target_seconds: f.target_seconds, strict_length: f.format === "short" })}
                    />
                    <p className="hint mt-2">Changing the format keeps your scenes — for big changes use “Rewrite all”.</p>
                  </div>
                  <StylePanel
                    value={style}
                    onChange={(v) =>
                      change({
                        ...plan,
                        voice: v.voice,
                        speed: v.speed,
                        music: v.music,
                        sfx: v.sfx,
                        mascot: v.mascot,
                        captions: v.captions,
                        palette: v.palette,
                        brand: { ...plan.brand, chip: v.chip || undefined, greeting: v.greeting, subscribe: v.subscribe },
                      })
                    }
                  />
                </Card>
              )}

              {tab === "json" && (
                <Card className="p-5 sm:p-6">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xl font-semibold">🧩 Advanced: script JSON</h2>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setJsonText(JSON.stringify(plan, null, 2))}>
                        Reset
                      </Button>
                      <Button size="sm" onClick={applyJson} disabled={locked}>
                        Apply JSON
                      </Button>
                    </div>
                  </div>
                  <textarea
                    spellCheck={false}
                    className="input min-h-[65vh] font-mono text-xs leading-relaxed"
                    value={jsonText}
                    onChange={(e) => setJsonText(e.target.value)}
                    aria-label="Script JSON"
                  />
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* add scene */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="➕ Add a scene">
        <p className="mb-4 text-sm text-slate-500">It will be added after scene {sel + 1}. Then fill it in or ask AI to write it.</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {SCENE_TYPES.map((t) => (
            <button
              key={t.type}
              onClick={() => {
                insertScene(blankScene(t.type), Math.min(plan.scenes.length, sel + 1));
                setAddOpen(false);
              }}
              className="rounded-3xl border-2 border-brand-100 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-brand-400 hover:shadow-pop"
            >
              <div className="text-3xl">{t.emoji}</div>
              <div className="mt-1 font-display font-semibold">{t.name}</div>
              <div className="text-xs text-slate-500">{t.desc}</div>
            </button>
          ))}
        </div>
      </Modal>

      {/* rewrite all */}
      <Modal open={regenOpen} onClose={() => setRegenOpen(false)} title="🔄 Rewrite the whole script?">
        <p className="text-slate-600">Claude will write a brand-new script from your topic and details. Your current edits will be replaced.</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setRegenOpen(false)}>
            Keep my script
          </Button>
          <Button variant="warm" icon={<RefreshCw className="h-4 w-4" />} loading={busy === "regen-all"} onClick={regenAll}>
            Rewrite it
          </Button>
        </div>
      </Modal>

      {/* validation issues */}
      <Modal open={!!issues} onClose={() => setIssues(null)} title="🧐 A few things to fix">
        <ul className="space-y-2">
          {(issues ?? []).map((m, i) => (
            <li key={i} className="flex gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {m}
            </li>
          ))}
        </ul>
        <div className="mt-5 flex justify-end">
          <Button onClick={() => setIssues(null)}>OK, I&apos;ll fix them</Button>
        </div>
      </Modal>
    </div>
  );
}
