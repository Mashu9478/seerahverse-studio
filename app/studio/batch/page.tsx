"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ClipboardPaste,
  Clock3,
  Copy,
  Film,
  GripVertical,
  Layers,
  ListPlus,
  Plus,
  Rocket,
  Settings2,
  Smartphone,
  MonitorPlay,
  Timer,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { AGE_GROUPS, SHORT_DURATIONS, SUBJECTS, characterById } from "@/lib/constants";
import { api } from "@/lib/client";
import { Button, IconButton, Modal, PageHeader, Segmented, Switch, cx } from "@/components/ui";
import { StylePanel, StyleSummary, type StyleValue } from "@/components/StylePanel";
import { styleToSettings, styleFromSettings, useAppSettings } from "@/components/useAppSettings";

interface Row {
  key: string;
  topic: string;
  details: string;
  subject: string;
  age_group: string;
  format: "long" | "short";
  seconds: number;
}

let n = 0;
const newKey = () => `r${Date.now()}-${n++}`;

function DurationSelect({ format, seconds, onChange, label }: { format: "long" | "short"; seconds: number; onChange: (s: number) => void; label: string }) {
  return format === "short" ? (
    <select aria-label={label} className="input h-10 py-0 text-sm" value={seconds} onChange={(e) => onChange(parseInt(e.target.value, 10))}>
      {SHORT_DURATIONS.map((s) => (
        <option key={s} value={s}>
          {s < 60 ? `${s} sec` : `${s / 60} min`}
        </option>
      ))}
    </select>
  ) : (
    <select aria-label={label} className="input h-10 py-0 text-sm" value={Math.round(seconds / 60)} onChange={(e) => onChange(parseInt(e.target.value, 10) * 60)}>
      {Array.from({ length: 20 }, (_, i) => i + 1).map((m) => (
        <option key={m} value={m}>
          {m} min
        </option>
      ))}
    </select>
  );
}

function FormatToggle({ value, onChange }: { value: "long" | "short"; onChange: (f: "long" | "short") => void }) {
  return (
    <div className="inline-flex h-10 shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-1">
      {(
        [
          { v: "short", icon: Smartphone, label: "Short" },
          { v: "long", icon: MonitorPlay, label: "Long" },
        ] as const
      ).map((o) => {
        const Icon = o.icon;
        const on = value === o.v;
        return (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(o.v)}
            aria-pressed={on}
            title={o.label}
            className={cx(
              "flex items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition",
              on ? (o.v === "short" ? "bg-pink-500/20 text-pink-200 ring-1 ring-pink-400/30" : "bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/30") : "text-fg-subtle hover:text-fg-muted",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function BatchPage() {
  const router = useRouter();
  const settings = useAppSettings();
  const [style, setStyle] = useState<StyleValue | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [review, setReview] = useState(false);
  const [paste, setPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [showStyle, setShowStyle] = useState(false);
  const [styleOpen, setStyleOpen] = useState(true);
  const [busy, setBusy] = useState(false);
  const [defaults, setDefaults] = useState<Omit<Row, "key" | "topic" | "details">>({
    subject: "Math",
    age_group: "6-7",
    format: "short",
    seconds: 60,
  });

  useEffect(() => {
    if (!settings || style) return;
    setStyle(styleFromSettings(settings));
    const d = {
      subject: "Math",
      age_group: settings.age_group,
      format: settings.format as "long" | "short",
      seconds: settings.format === "short" ? settings.short_seconds : settings.long_minutes * 60,
    };
    setDefaults(d);
    setRows([
      { key: newKey(), topic: "", details: "", ...d },
      { key: newKey(), topic: "", details: "", ...d },
      { key: newKey(), topic: "", details: "", ...d },
    ]);
  }, [settings, style]);

  const filled = rows.filter((r) => r.topic.trim().length >= 2);
  const totalSec = filled.reduce((a, r) => a + r.seconds, 0);
  const shorts = filled.filter((r) => r.format === "short").length;
  const parallel = settings?.max_parallel ?? 4;
  // rough wall-clock estimate: scripts ~1 min in parallel, then renders in waves of `parallel`
  const renderEach = filled.map((r) => Math.max(1, r.format === "short" ? 1.5 : (r.seconds / 60) * 1.2));
  const waves = Math.ceil(filled.length / parallel);
  const estMin = filled.length ? Math.round(1 + waves * Math.max(...renderEach)) : 0;
  const presenter = characterById(style?.presenter || (style?.mascot === false ? "none" : "ollie"));

  function update(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addRow(copy?: Row, afterKey?: string) {
    if (rows.length >= 30) return toast.error("A batch can have up to 30 videos.");
    const row = copy ? { ...copy, key: newKey() } : { key: newKey(), topic: "", details: "", ...defaults };
    setRows((rs) => {
      if (!afterKey) return [...rs, row];
      const i = rs.findIndex((r) => r.key === afterKey);
      return [...rs.slice(0, i + 1), row, ...rs.slice(i + 1)];
    });
  }
  function applyDefaultsToAll(d: typeof defaults) {
    setDefaults(d);
    setRows((rs) => rs.map((r) => ({ ...r, ...d })));
  }
  function doPaste() {
    const lines = pasteText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length >= 2);
    if (!lines.length) return toast.error("Paste one topic per line.");
    const kept = rows.filter((r) => r.topic.trim());
    const add = lines.slice(0, 30 - kept.length).map((l) => {
      const [topic, ...rest] = l.split(/\s*\|\s*/);
      return { key: newKey(), topic: topic.slice(0, 200), details: rest.join(" | ").slice(0, 2000), ...defaults };
    });
    setRows([...kept, ...add]);
    setPaste(false);
    setPasteText("");
    toast.success(`Added ${add.length} topic${add.length === 1 ? "" : "s"}`);
  }

  async function generate() {
    if (!style) return;
    if (!filled.length) return toast.error("Add at least one topic.");
    setBusy(true);
    try {
      const r = await api<{ ids: string[] }>("/api/videos", {
        body: {
          batch_name: name || undefined,
          videos: filled.map((r) => ({
            topic: r.topic.trim(),
            details: r.details,
            subject: r.subject,
            age_group: r.age_group,
            format: r.format,
            target_seconds: r.seconds,
            review,
            image_urls: [],
            settings: styleToSettings(style),
          })),
        },
      });
      toast.success(`${r.ids.length} videos started`, { description: "Claude is writing all the scripts in parallel." });
      router.push("/studio/queue");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the batch");
      setBusy(false);
    }
  }

  const pasteCount = pasteText.split(/\r?\n/).filter((l) => l.trim().length >= 2).length;

  return (
    <div className="pb-28">
      <PageHeader
        emoji="📚"
        title="Batch create"
        subtitle="Plan a whole week of videos at once. Every row becomes its own video — scripts are written and rendered in parallel."
        actions={
          <>
            <Button variant="secondary" icon={<ClipboardPaste className="h-4 w-4" />} onClick={() => setPaste(true)}>
              Paste many topics
            </Button>
            <Button variant="outline" icon={<Plus className="h-4 w-4" />} onClick={() => addRow()}>
              Add row
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-4">
          {/* batch settings */}
          <div className="card p-4 sm:p-5">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto]">
              <div>
                <label className="label" htmlFor="bname">
                  Batch name
                </label>
                <input id="bname" className="input" placeholder="e.g. Grade 1 Maths — Week 3" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
              </div>
              <div>
                <span className="label">Apply to every row</span>
                <div className="flex flex-wrap items-center gap-2">
                  <FormatToggle value={defaults.format} onChange={(f) => applyDefaultsToAll({ ...defaults, format: f, seconds: f === "short" ? 60 : 300 })} />
                  <div className="w-28">
                    <DurationSelect format={defaults.format} seconds={defaults.seconds} onChange={(s) => applyDefaultsToAll({ ...defaults, seconds: s })} label="Default length" />
                  </div>
                  <select aria-label="Default age" className="input h-10 w-auto py-0 text-sm" value={defaults.age_group} onChange={(e) => applyDefaultsToAll({ ...defaults, age_group: e.target.value })}>
                    {AGE_GROUPS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.emoji} {a.label}
                      </option>
                    ))}
                  </select>
                  <select aria-label="Default subject" className="input h-10 w-auto py-0 text-sm" value={defaults.subject} onChange={(e) => applyDefaultsToAll({ ...defaults, subject: e.target.value })}>
                    {SUBJECTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.emoji} {s.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* rows header */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-sm font-semibold text-fg-muted">
              <Layers className="h-4 w-4 text-brand-300" /> {rows.length} row{rows.length === 1 ? "" : "s"}
              <span className="text-fg-subtle">· {filled.length} ready</span>
            </div>
            <span className="text-xs text-fg-subtle">max 30 per batch</span>
          </div>

          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {rows.map((r, i) => {
                const ready = r.topic.trim().length >= 2;
                return (
                  <motion.div
                    key={r.key}
                    layout
                    initial={{ opacity: 0, y: -10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 60, transition: { duration: 0.2 } }}
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    className={cx(
                      "group relative overflow-hidden rounded-2xl border bg-bg-card/80 p-3 backdrop-blur-xl transition duration-300 sm:p-4",
                      ready ? "border-brand-400/25 shadow-[0_0_0_1px_rgba(139,92,246,0.08),0_20px_40px_-30px_rgba(139,92,246,0.9)]" : "border-white/[0.07] hover:border-white/15",
                    )}
                  >
                    {ready && <span className="absolute inset-y-3 left-0 w-[3px] rounded-r-full bg-brand-grad" />}
                    <div className="flex gap-3">
                      <div className="flex shrink-0 flex-col items-center gap-1 pt-1">
                        <GripVertical className="h-4 w-4 cursor-grab text-fg-subtle opacity-40 transition group-hover:opacity-100" aria-hidden />
                        <span
                          className={cx(
                            "grid h-8 w-8 place-items-center rounded-lg font-display text-sm font-semibold tabular-nums transition",
                            ready ? "bg-brand-grad text-white shadow-pop" : "bg-white/[0.06] text-fg-subtle",
                          )}
                        >
                          {i + 1}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="flex flex-col gap-2 md:flex-row">
                          <input
                            aria-label={`Topic ${i + 1}`}
                            className="input h-10 flex-1 py-0 font-semibold"
                            placeholder="Topic (English or اردو), e.g. Counting by 2s"
                            dir="auto"
                            value={r.topic}
                            maxLength={200}
                            onChange={(e) => update(r.key, { topic: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && i === rows.length - 1 && r.topic.trim()) addRow();
                            }}
                          />
                          <div className="flex gap-2">
                            <FormatToggle value={r.format} onChange={(f) => update(r.key, { format: f, seconds: f === "short" ? 60 : 300 })} />
                            <div className="w-24 sm:w-28">
                              <DurationSelect format={r.format} seconds={r.seconds} onChange={(s) => update(r.key, { seconds: s })} label="Length" />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 md:flex-row">
                          <input
                            aria-label="Details"
                            className="input h-10 flex-1 py-0 text-sm"
                            placeholder="Details / learning goals (optional)"
                            value={r.details}
                            maxLength={2000}
                            onChange={(e) => update(r.key, { details: e.target.value })}
                          />
                          <div className="flex gap-2">
                            <select aria-label="Age" className="input h-10 w-auto py-0 text-sm" value={r.age_group} onChange={(e) => update(r.key, { age_group: e.target.value })}>
                              {AGE_GROUPS.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.label}
                                </option>
                              ))}
                            </select>
                            <select aria-label="Subject" className="input h-10 w-auto py-0 text-sm" value={r.subject} onChange={(e) => update(r.key, { subject: e.target.value })}>
                              {SUBJECTS.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.emoji} {s.id}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col gap-1.5">
                        <IconButton label="Duplicate row" onClick={() => addRow(r, r.key)}>
                          <Copy className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          label="Delete row"
                          onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                          className="hover:bg-red-100 hover:text-red-700 hover:ring-red-200"
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>

            <motion.button
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => addRow()}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 py-4 text-sm font-semibold text-fg-muted transition hover:border-brand-400/50 hover:bg-brand-500/[0.06] hover:text-fg"
            >
              <ListPlus className="h-5 w-5 text-brand-300" /> Add another video
            </motion.button>
          </div>
        </div>

        {/* right column */}
        <div className="space-y-4 xl:sticky xl:top-8 xl:self-start">
          <div className="card overflow-hidden">
            <button type="button" onClick={() => setStyleOpen(!styleOpen)} className="flex w-full items-center gap-3 p-5 text-left" aria-expanded={styleOpen}>
              {style?.style === "explainer" || style?.language === "ur" ? (
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-cyan-400/10 text-2xl ring-1 ring-cyan-300/30">🔬</span>
              ) : presenter.id !== "none" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={presenter.img} alt="" className="h-12 w-12 shrink-0 object-contain drop-shadow-[0_8px_14px_rgba(0,0,0,0.6)]" />
              ) : (
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-2xl">🎙️</span>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-fg">Shared style</div>
                <div className="truncate text-xs text-fg-subtle">Applies to every video · {style?.language === "ur" ? "in Urdu · " : ""}{style?.style === "explainer" || style?.language === "ur" ? "diagram explainer" : presenter.id === "none" ? "no character" : `hosted by ${presenter.short}`}</div>
              </div>
              <ChevronDown className={cx("h-4 w-4 text-fg-subtle transition", styleOpen && "rotate-180")} />
            </button>
            <AnimatePresence initial={false}>
              {styleOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="space-y-4 border-t border-white/[0.06] px-5 pb-5 pt-4">
                    {style && <StyleSummary value={style} />}
                    <Button size="sm" variant="secondary" className="w-full" icon={<Settings2 className="h-4 w-4" />} onClick={() => setShowStyle(true)}>
                      Change style, voice & look
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="card relative overflow-hidden p-5">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl" />
            <h3 className="relative text-[15px] font-semibold text-fg">Summary</h3>
            <div className="relative mt-4 grid grid-cols-2 gap-3">
              {[
                { k: "Videos", v: filled.length, icon: Film, tone: "text-violet-300 bg-violet-500/10" },
                { k: "Minutes", v: Math.round((totalSec / 60) * 10) / 10, icon: Clock3, tone: "text-cyan-300 bg-cyan-400/10" },
                { k: "Shorts / Long", v: `${shorts} / ${filled.length - shorts}`, icon: Smartphone, tone: "text-pink-300 bg-pink-500/10" },
                { k: "Est. ready in", v: estMin ? `~${estMin}m` : "—", icon: Timer, tone: "text-amber-300 bg-amber-400/10" },
              ].map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.k} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
                    <span className={cx("grid h-7 w-7 place-items-center rounded-lg", s.tone)}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <motion.div key={String(s.v)} initial={{ y: 5, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mt-2 font-display text-2xl font-semibold text-fg tabular-nums">
                      {s.v}
                    </motion.div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{s.k}</div>
                  </div>
                );
              })}
            </div>
            <p className="relative mt-4 text-xs leading-relaxed text-fg-subtle">
              Scripts are written in parallel (~1 min). Up to {parallel} videos render at once (change in Settings). Uses AI credits for scripts and Vercel Sandbox time for rendering.
            </p>
            <button
              type="button"
              onClick={() => setReview(!review)}
              role="switch"
              aria-checked={review}
              className={cx(
                "relative mt-4 flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
                review ? "border-brand-400/40 bg-brand-500/[0.1]" : "border-white/[0.08] bg-white/[0.03] hover:border-white/20",
              )}
            >
              <span className="text-xl">👀</span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-fg">Review each script first</span>
                <span className="block text-[11px] text-fg-subtle">{review ? "Each waits for your approval" : "Off — fully automatic"}</span>
              </span>
              <Switch checked={review} />
            </button>
          </div>
        </div>
      </div>

      {/* sticky action bar */}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 lg:left-[268px]">
        <div className="pointer-events-auto mx-auto mb-4 max-w-5xl px-4">
          <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-bg-elev/90 p-3 pl-5 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] backdrop-blur-2xl">
            <div className="hidden min-w-0 flex-1 sm:block">
              <div className="text-sm font-semibold text-fg">
                {filled.length ? `${filled.length} video${filled.length === 1 ? "" : "s"} ready to generate` : "Add at least one topic"}
              </div>
              <div className="truncate text-xs text-fg-subtle">
                {filled.length ? `${Math.round((totalSec / 60) * 10) / 10} min of content · ${review ? "review on" : "fully automatic"}${estMin ? ` · ready in ~${estMin} min` : ""}` : "Type topics in the rows above, or paste many at once."}
              </div>
            </div>
            <Segmented
              className="hidden md:inline-flex"
              value={review ? "review" : "auto"}
              onChange={(v) => setReview(v === "review")}
              options={[
                { value: "review", label: "Review first" },
                { value: "auto", label: "Automatic" },
              ]}
            />
            <Button size="lg" className="w-full sm:w-auto" loading={busy} icon={<Rocket className="h-5 w-5" />} onClick={generate} disabled={!filled.length}>
              Generate all {filled.length || ""} videos
            </Button>
          </div>
        </div>
      </div>

      <Modal open={paste} onClose={() => setPaste(false)} title="Paste many topics">
        <p className="mb-3 text-sm text-fg-muted">
          One topic per line. Add optional details after a <b className="text-fg">|</b> — e.g.{" "}
          <code className="rounded-md bg-white/[0.08] px-1.5 py-0.5 text-[12px] text-brand-800">Counting by 5s | use coins and hands</code>
        </p>
        <textarea
          className="input min-h-[240px] font-mono text-sm leading-relaxed"
          autoFocus
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={"Doubles to 10\nDoubles plus one | use the fish tank example\nNumber bonds to 10\nThe five pillars of Islam\nWhy do leaves change colour?"}
        />
        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="text-xs text-fg-subtle">{pasteCount} topic{pasteCount === 1 ? "" : "s"} detected</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setPaste(false)}>
              Cancel
            </Button>
            <Button onClick={doPaste} disabled={!pasteCount} icon={<ClipboardPaste className="h-4 w-4" />}>
              Add {pasteCount || ""} topics
            </Button>
          </div>
        </div>
      </Modal>

      <Modal open={showStyle} onClose={() => setShowStyle(false)} title="Style for every video in this batch" className="max-w-5xl">
        {style && <StylePanel value={style} onChange={setStyle} />}
        <div className="mt-6 flex justify-end">
          <Button onClick={() => setShowStyle(false)}>Done</Button>
        </div>
      </Modal>
    </div>
  );
}
