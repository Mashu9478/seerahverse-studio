"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Eye, EyeOff, Layers, MessageSquareText, Sparkles } from "lucide-react";
import {
  wordCount,
  type ExplainerAction,
  type ExplainerBeat,
  type ExplainerPart,
  type ExplainerStep,
  type VideoPlan,
} from "@/lib/plan";
import { Card, IconButton, cx } from "@/components/ui";
import { URDU_FONT } from "@/components/LanguagePicker";

/* ------------------------------------------------------------------ helpers */

const ELEMENT_ACTIONS = new Set(["show", "hide", "pop", "wipe", "move", "scale", "rotate", "fill"]);

const ACTION_META: Record<string, { emoji: string; label: string; tone: string }> = {
  show: { emoji: "✨", label: "Show", tone: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/25" },
  pop: { emoji: "💥", label: "Pop in", tone: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/25" },
  wipe: { emoji: "🖌️", label: "Grow", tone: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/25" },
  hide: { emoji: "🫥", label: "Hide", tone: "bg-white/[0.05] text-fg-muted ring-white/10" },
  move: { emoji: "↔️", label: "Move", tone: "bg-sky-400/10 text-sky-200 ring-sky-400/25" },
  scale: { emoji: "🔍", label: "Scale", tone: "bg-sky-400/10 text-sky-200 ring-sky-400/25" },
  fill: { emoji: "🎨", label: "Colour", tone: "bg-fuchsia-400/10 text-fuchsia-200 ring-fuchsia-400/25" },
  camera: { emoji: "🎥", label: "Camera", tone: "bg-violet-400/10 text-violet-200 ring-violet-400/25" },
  label: { emoji: "🏷️", label: "Label", tone: "bg-amber-400/10 text-amber-200 ring-amber-400/25" },
  unlabel: { emoji: "🏷️", label: "Remove label", tone: "bg-white/[0.05] text-fg-muted ring-white/10" },
  flow: { emoji: "💧", label: "Flow", tone: "bg-cyan-400/10 text-cyan-200 ring-cyan-400/25" },
  pulse: { emoji: "📍", label: "Pulse", tone: "bg-rose-400/10 text-rose-200 ring-rose-400/25" },
};

/** Strip anything executable or external from an AI-written SVG before showing it in the page. */
function sanitizeSvg(src: string): { svg: string; vb: [number, number, number, number] | null; error?: string } {
  if (typeof window === "undefined" || !src) return { svg: "", vb: null };
  try {
    let text = src;
    if (!/xmlns=/.test(text.slice(0, 400))) text = text.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    const doc = new DOMParser().parseFromString(text, "image/svg+xml");
    if (doc.querySelector("parsererror")) return { svg: "", vb: null, error: "The diagram's SVG has a syntax error." };
    const root = doc.documentElement;
    root.querySelectorAll("script, foreignObject, iframe, object, embed, audio, video").forEach((n) => n.remove());
    const all = [root, ...Array.from(root.querySelectorAll("*"))];
    for (const el of all) {
      for (const a of Array.from(el.attributes)) {
        const n = a.name.toLowerCase();
        const v = a.value.trim().toLowerCase();
        if (n.startsWith("on")) el.removeAttribute(a.name);
        else if ((n === "href" || n === "xlink:href") && !v.startsWith("#")) el.removeAttribute(a.name);
        else if (v.includes("javascript:")) el.removeAttribute(a.name);
      }
    }
    const vbRaw = root.getAttribute("viewBox");
    const nums = vbRaw ? vbRaw.trim().split(/[\s,]+/).map(Number) : [];
    const vb = nums.length === 4 && nums.every((x) => Number.isFinite(x)) ? (nums as [number, number, number, number]) : null;
    root.setAttribute("width", "100%");
    root.setAttribute("height", "100%");
    root.setAttribute("preserveAspectRatio", "xMidYMid meet");
    return { svg: new XMLSerializer().serializeToString(root), vb };
  } catch {
    return { svg: "", vb: null, error: "Couldn't read the diagram." };
  }
}

function cssId(id: string) {
  return id.replace(/["\\]/g, "");
}

function timing(a: ExplainerAction) {
  if (a.word) return `“${a.word}”`;
  if (typeof a.at === "number") return `${a.at.toFixed(1)}s`;
  return "";
}

function actionTarget(a: ExplainerAction) {
  if (a.do === "label") return a.text ?? a.id ?? "";
  if (a.do === "camera") return a.box ? "zoom in" : "whole view";
  if (a.do === "flow") return a.shape === "steam" ? "vapour" : `${a.count ?? 8} particles`;
  if (a.do === "unlabel") return a.id === "*" ? "all" : a.id ?? "";
  return a.id ?? "";
}

function stepSeconds(step: ExplainerStep, speed: number) {
  const wps = 2.55 * speed;
  return step.beats.reduce((t, b) => t + wordCount(b.say) / wps + 0.15 + (b.pause ?? 0.35), 0);
}

/* ------------------------------------------------------------------ component */

export function ExplainerEditor({
  plan,
  onChange,
  locked,
}: {
  plan: VideoPlan;
  onChange: (p: VideoPlan) => void;
  locked: boolean;
}) {
  const ex = plan.explainer;
  const urdu = plan.language === "ur";
  const rtl = urdu ? ({ dir: "rtl" as const, lang: "ur", style: { fontFamily: URDU_FONT, lineHeight: 2 } }) : {};
  const [partIdx, setPartIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [startView, setStartView] = useState(false);
  const [hover, setHover] = useState<ExplainerAction | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const parts = ex?.parts ?? [];
  const pi = Math.min(partIdx, Math.max(0, parts.length - 1));
  const part: ExplainerPart | undefined = parts[pi];
  const si = part ? Math.min(stepIdx, part.steps.length - 1) : 0;
  const step: ExplainerStep | undefined = part?.steps[si];
  const portrait = plan.format === "short";
  const theme = ex?.theme ?? {};

  const stage = useMemo(() => (mounted && part ? sanitizeSvg(part.stage) : { svg: "", vb: null }), [mounted, part]);

  // flat list for prev / next
  const flat = useMemo(() => parts.flatMap((p, a) => p.steps.map((_, b) => [a, b] as const)), [parts]);
  const flatPos = flat.findIndex(([a, b]) => a === pi && b === si);

  if (!ex || !part || !step) {
    return (
      <Card className="p-8 text-center text-sm text-fg-muted lg:col-span-2">
        This diagram script is empty. Use “Regenerate” to write a new one.
      </Card>
    );
  }

  /* ---------------- immutable updates ---------------- */
  function setStep(next: ExplainerStep) {
    if (!ex) return;
    const parts2 = ex.parts.map((p, a) => (a === pi ? { ...p, steps: p.steps.map((s, b) => (b === si ? next : s)) } : p));
    onChange({ ...plan, explainer: { ...ex, parts: parts2 } });
  }
  function setBeat(k: number, b: ExplainerBeat) {
    if (!step) return;
    setStep({ ...step, beats: step.beats.map((x, i) => (i === k ? b : x)) });
  }

  /* ---------------- preview css (hidden parts + hover highlight) ---------------- */
  const hiddenCss =
    startView && part.hidden.length
      ? `${part.hidden.map((h) => `.xp-stage [id="${cssId(h)}"]`).join(",")}{opacity:0 !important}`
      : "";
  const hoverCss =
    hover && hover.id && ELEMENT_ACTIONS.has(hover.do)
      ? `.xp-stage [id="${cssId(hover.id)}"]{opacity:1 !important;filter:drop-shadow(0 0 6px #22D3EE) drop-shadow(0 0 14px #22D3EE)}`
      : "";
  const vb = stage.vb;
  const pointPct = (p?: number[]) => {
    if (!vb || !p || p.length < 2) return null;
    return { left: `${((p[0] - vb[0]) / vb[2]) * 100}%`, top: `${((p[1] - vb[1]) / vb[3]) * 100}%` };
  };
  const hoverPoint = hover && (hover.do === "label" || hover.do === "pulse") ? pointPct(hover.point) : null;
  const hoverBox =
    hover && hover.do === "camera" && hover.box && vb
      ? (() => {
          const [x, y, w] = hover.box as number[];
          const h = w * (vb[3] / vb[2]);
          return { left: `${((x - vb[0]) / vb[2]) * 100}%`, top: `${((y - vb[1]) / vb[3]) * 100}%`, width: `${(w / vb[2]) * 100}%`, height: `${(h / vb[3]) * 100}%` };
        })()
      : null;
  const hoverPath =
    hover && hover.do === "flow" && hover.path && vb ? hover.path.map((p) => `${p[0]},${p[1]}`).join(" ") : null;

  const hl = new Set(urdu ? (step.highlight ?? "").split(/\s+/).filter(Boolean) : ((step.highlight ?? "").toLowerCase().match(/[a-z']+/g) ?? []));
  const titleWords = step.title.split(" ");

  return (
    <div className="grid gap-5 lg:col-span-2 lg:grid-cols-[290px_minmax(0,1fr)]">
      {/* ---------------- left: parts & steps ---------------- */}
      <div className="lg:sticky lg:top-40 lg:self-start">
        <Card className="overflow-hidden p-0">
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
            <Layers className="h-4 w-4 text-cyan-300" />
            <span className="font-display text-sm font-semibold text-fg">Diagram steps</span>
            <span className="ml-auto rounded-full bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300 ring-1 ring-cyan-400/25">
              🔬 Explainer
            </span>
          </div>
          <div className="scrollbar-thin max-h-[70vh] space-y-3 overflow-y-auto p-3">
            {parts.map((p, a) => (
              <div key={a}>
                {parts.length > 1 && (
                  <div className="mb-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-fg-subtle">
                    Diagram {a + 1} · {p.steps.length} steps
                  </div>
                )}
                <div className="space-y-1.5">
                  {p.steps.map((s, b) => {
                    const on = a === pi && b === si;
                    return (
                      <button
                        key={b}
                        type="button"
                        onClick={() => {
                          setPartIdx(a);
                          setStepIdx(b);
                        }}
                        className={cx(
                          "group relative w-full overflow-hidden rounded-xl border p-3 text-left transition",
                          on ? "border-cyan-400/50 bg-cyan-400/[0.08] shadow-[0_0_24px_-10px_rgba(34,211,238,0.9)]" : "border-white/[0.07] bg-white/[0.02] hover:border-white/20",
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-white/[0.07] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-fg-muted">
                            {s.tag || (b === 0 ? "Intro" : "Recap")}
                          </span>
                          <span className="ml-auto text-[10px] font-semibold tabular-nums text-fg-subtle">~{Math.round(stepSeconds(s, plan.speed))}s</span>
                        </div>
                        <div className="mt-1.5 line-clamp-2 font-display text-[13px] font-semibold leading-snug text-fg">{s.title || "Untitled step"}</div>
                        <div className="mt-1 text-[11px] text-fg-subtle">
                          {s.beats.length} line{s.beats.length === 1 ? "" : "s"} · {s.beats.reduce((n, x) => n + (x.actions?.length ?? 0), 0)} animations
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ---------------- center: preview + step form ---------------- */}
      <div className="min-w-0">
        <AnimatePresence mode="wait">
          <motion.div key={`${pi}-${si}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
            <Card className={cx("overflow-hidden p-0", locked && "pointer-events-none opacity-60")}>
              {/* header */}
              <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] p-5">
                <div className="pointer-events-none absolute -left-10 -top-16 h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl" />
                <div className="relative flex items-center gap-3">
                  <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.1] to-white/[0.02] text-2xl">🔬</span>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-300">
                      {parts.length > 1 ? `Diagram ${pi + 1} · ` : ""}Step {si + 1} of {part.steps.length}
                    </div>
                    <h2 className="text-xl font-semibold text-fg">{step.title || "Untitled step"}</h2>
                  </div>
                </div>
                <div className="relative flex items-center gap-2">
                  <span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs font-semibold tabular-nums text-fg-muted">~{Math.round(stepSeconds(step, plan.speed))}s</span>
                  <IconButton
                    label="Previous step"
                    disabled={flatPos <= 0}
                    onClick={() => {
                      const [a, b] = flat[flatPos - 1];
                      setPartIdx(a);
                      setStepIdx(b);
                    }}
                    className="disabled:opacity-30"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    label="Next step"
                    disabled={flatPos >= flat.length - 1}
                    onClick={() => {
                      const [a, b] = flat[flatPos + 1];
                      setPartIdx(a);
                      setStepIdx(b);
                    }}
                    className="disabled:opacity-30"
                  >
                    <ArrowLeft className="h-4 w-4 rotate-180" />
                  </IconButton>
                </div>
              </div>

              <div className={cx("grid gap-6 p-5 sm:p-6", portrait ? "xl:grid-cols-[minmax(0,300px)_minmax(0,1fr)]" : "")}>
                {/* preview */}
                <div>
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Diagram preview</span>
                    <button
                      type="button"
                      onClick={() => setStartView(!startView)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] px-2 py-1 text-[11px] font-semibold text-fg-muted ring-1 ring-white/10 transition hover:bg-white/[0.09] hover:text-fg"
                      aria-pressed={startView}
                    >
                      {startView ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {startView ? "Start view" : "All parts"}
                    </button>
                  </div>
                  <div
                    className={cx(
                      "xp-stage relative mx-auto overflow-hidden rounded-2xl ring-1 ring-white/10 shadow-card",
                      portrait ? "aspect-[9/16] w-full max-w-[300px]" : "aspect-video w-full",
                    )}
                    style={{ background: theme.bg ?? "#EEF2F4" }}
                  >
                    <style>{hiddenCss + hoverCss}</style>
                    {stage.svg ? (
                      <div className="absolute inset-0" dangerouslySetInnerHTML={{ __html: stage.svg }} />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center p-6 text-center text-xs text-slate-600">
                        {stage.error ?? "Loading diagram…"}
                      </div>
                    )}
                    {/* header like the video */}
                    <div
                      className="pointer-events-none absolute inset-x-0 top-0 px-3 pb-6 pt-3 text-center"
                      style={{ background: `linear-gradient(to bottom, ${theme.bg ?? "#EEF2F4"}EE, ${theme.bg ?? "#EEF2F4"}99 60%, transparent)` }}
                    >
                      {step.tag && (
                        <span {...(urdu ? { dir: "rtl", style: { fontFamily: URDU_FONT } } : {})} className="inline-block rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-700">{step.tag}</span>
                      )}
                      <div
                        dir={urdu ? "rtl" : undefined}
                        className={cx("mt-1 font-display font-bold", urdu ? "leading-[2]" : "leading-tight", portrait ? "text-[17px]" : "text-[20px]")}
                        style={{ color: theme.ink ?? "#1E2A30", ...(urdu ? { fontFamily: URDU_FONT } : {}) }}
                      >
                        {titleWords.map((w, i) => (
                          <span key={i} style={(urdu ? hl.has(w) : hl.has(w.toLowerCase().replace(/[^a-z']/g, ""))) ? { color: theme.accent ?? "#1C7ED6" } : undefined}>
                            {w}{" "}
                          </span>
                        ))}
                      </div>
                    </div>
                    {hoverBox && <span className="pointer-events-none absolute rounded-lg border-2 border-dashed border-violet-500 bg-violet-500/10" style={hoverBox} />}
                    {hoverPoint && (
                      <span className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={hoverPoint}>
                        <span className="absolute -inset-3 animate-ping rounded-full bg-amber-400/60" />
                        <span className="relative block h-3 w-3 rounded-full border-2 border-white bg-amber-500" />
                      </span>
                    )}
                    {hoverPath && vb && (
                      <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox={vb.join(" ")} preserveAspectRatio="xMidYMid meet">
                        <polyline points={hoverPath} fill="none" stroke="#06B6D4" strokeWidth={vb[2] / 140} strokeDasharray={`${vb[2] / 60} ${vb[2] / 90}`} strokeLinecap="round" />
                      </svg>
                    )}
                  </div>
                  <p className="hint mt-2 text-center">Hover an animation below to see what it touches.</p>
                </div>

                {/* step form */}
                <div className="min-w-0 space-y-5">
                  <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
                    <div>
                      <label className="label">Step tag</label>
                      <input {...rtl} className="input" value={step.tag ?? ""} placeholder={urdu ? "مرحلہ ۱ از ۴" : "Step 1 / 4"} maxLength={24} onChange={(e) => setStep({ ...step, tag: e.target.value || null })} />
                    </div>
                    <div>
                      <label className="label">Title on screen</label>
                      <input {...rtl} className="input" value={step.title} maxLength={60} onChange={(e) => setStep({ ...step, title: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Coloured word(s) in the title</label>
                    <input {...rtl} className="input" value={step.highlight ?? ""} placeholder={urdu ? "مثلاً پانی" : "e.g. water"} onChange={(e) => setStep({ ...step, highlight: e.target.value })} />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="h-4 w-4 text-brand-300" />
                      <h3 className="font-display text-sm font-semibold text-fg">Narration</h3>
                    </div>
                    {step.beats.map((b, k) => (
                      <div key={k} className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3.5">
                        <div className="mb-2 flex items-center justify-between text-[11px] font-semibold text-fg-subtle">
                          <span>Line {k + 1}</span>
                          <span className="tabular-nums">{wordCount(b.say)} words</span>
                        </div>
                        <textarea
                          {...rtl}
                          className="input min-h-[72px] text-sm"
                          value={b.say}
                          onChange={(e) => setBeat(k, { ...b, say: e.target.value })}
                          aria-label={`Narration line ${k + 1}`}
                        />
                        <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_110px]">
                          <input
                            {...rtl}
                            className="input py-2 text-xs"
                            value={b.caption ?? ""}
                            placeholder="Caption (blank = same as narration)"
                            onChange={(e) => setBeat(k, { ...b, caption: e.target.value || undefined })}
                          />
                          <label className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-2.5 text-xs text-fg-subtle">
                            Pause
                            <input
                              type="number"
                              min={0}
                              max={5}
                              step={0.1}
                              className="w-full bg-transparent text-right text-fg outline-none"
                              value={b.pause ?? 0.35}
                              onChange={(e) => setBeat(k, { ...b, pause: Math.max(0, Math.min(5, parseFloat(e.target.value) || 0)) })}
                            />
                            s
                          </label>
                        </div>
                        {(b.actions?.length ?? 0) > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {b.actions.map((a, j) => {
                              const m = ACTION_META[a.do] ?? { emoji: "•", label: a.do, tone: "bg-white/[0.05] text-fg-muted ring-white/10" };
                              const target = actionTarget(a);
                              const t = timing(a);
                              return (
                                <span
                                  key={j}
                                  onMouseEnter={() => setHover(a)}
                                  onMouseLeave={() => setHover(null)}
                                  className={cx("inline-flex cursor-default items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold ring-1 ring-inset transition hover:brightness-125", m.tone)}
                                >
                                  <span>{m.emoji}</span>
                                  {m.label}
                                  {target && <span className="max-w-[120px] truncate font-mono text-[10px] opacity-80">{target}</span>}
                                  {t && <span className="opacity-60">@ {t}</span>}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.05] p-3 text-xs text-cyan-100/90">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300" />
                    Animations stay linked to the diagram. To change the drawing or the animations, edit the JSON tab or use “Regenerate”.
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
