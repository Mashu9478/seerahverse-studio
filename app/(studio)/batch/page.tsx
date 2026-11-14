"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ClipboardPaste, Copy, Plus, Rocket, Settings2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AGE_GROUPS, SHORT_DURATIONS, SUBJECTS } from "@/lib/constants";
import { api } from "@/lib/client";
import { Button, Card, Modal, PageHeader, Toggle, cx } from "@/components/ui";
import { StylePanel, StyleSummary, type StyleValue } from "@/components/StylePanel";
import { styleFromSettings, useAppSettings } from "@/components/useAppSettings";

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
  const totalMin = filled.reduce((a, r) => a + r.seconds, 0) / 60;
  const parallel = settings?.max_parallel ?? 4;

  function update(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }
  function addRow(copy?: Row) {
    if (rows.length >= 30) return toast.error("A batch can have up to 30 videos.");
    setRows((rs) => [...rs, copy ? { ...copy, key: newKey() } : { key: newKey(), topic: "", details: "", ...defaults }]);
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
    toast.success(`Added ${add.length} topic${add.length === 1 ? "" : "s"} ✨`);
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
            settings: style,
          })),
        },
      });
      toast.success(`🚀 ${r.ids.length} videos started!`, { description: "Claude is writing all the scripts in parallel." });
      router.push("/queue");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the batch");
      setBusy(false);
    }
  }

  const durationSelect = (format: "long" | "short", seconds: number, onChange: (s: number) => void, label: string) =>
    format === "short" ? (
      <select aria-label={label} className="input py-2" value={seconds} onChange={(e) => onChange(parseInt(e.target.value, 10))}>
        {SHORT_DURATIONS.map((s) => (
          <option key={s} value={s}>
            {s < 60 ? `${s} sec` : `${s / 60} min`}
          </option>
        ))}
      </select>
    ) : (
      <select aria-label={label} className="input py-2" value={Math.round(seconds / 60)} onChange={(e) => onChange(parseInt(e.target.value, 10) * 60)}>
        {Array.from({ length: 20 }, (_, i) => i + 1).map((m) => (
          <option key={m} value={m}>
            {m} min
          </option>
        ))}
      </select>
    );

  return (
    <div>
      <PageHeader
        emoji="📚"
        title="Batch create"
        subtitle="Plan a whole week of videos at once. Every row becomes its own video — they're written and rendered in parallel."
        actions={
          <>
            <Button variant="secondary" icon={<ClipboardPaste className="h-4 w-4" />} onClick={() => setPaste(true)}>
              Paste many topics
            </Button>
            <Button variant="secondary" icon={<Plus className="h-4 w-4" />} onClick={() => addRow()}>
              Add row
            </Button>
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <label className="label" htmlFor="bname">
                  Batch name
                </label>
                <input id="bname" className="input" placeholder="e.g. Grade 1 Maths — Week 3" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
              </div>
              <div>
                <span className="label">Set all rows to…</span>
                <div className="flex flex-wrap gap-2">
                  <select aria-label="Default format" className="input w-auto py-2" value={defaults.format} onChange={(e) => {
                    const f = e.target.value as "long" | "short";
                    applyDefaultsToAll({ ...defaults, format: f, seconds: f === "short" ? 60 : 300 });
                  }}>
                    <option value="short">📱 Shorts</option>
                    <option value="long">🖥️ Long</option>
                  </select>
                  <div className="w-28">{durationSelect(defaults.format, defaults.seconds, (s) => applyDefaultsToAll({ ...defaults, seconds: s }), "Default length")}</div>
                  <select aria-label="Default age" className="input w-auto py-2" value={defaults.age_group} onChange={(e) => applyDefaultsToAll({ ...defaults, age_group: e.target.value })}>
                    {AGE_GROUPS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.emoji} {a.label}
                      </option>
                    ))}
                  </select>
                  <select aria-label="Default subject" className="input w-auto py-2" value={defaults.subject} onChange={(e) => applyDefaultsToAll({ ...defaults, subject: e.target.value })}>
                    {SUBJECTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.emoji} {s.id}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            <AnimatePresence initial={false}>
              {rows.map((r, i) => (
                <motion.div
                  key={r.key}
                  layout
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 40 }}
                  className={cx("card p-4", r.topic.trim() ? "ring-brand-200" : "")}
                >
                  <div className="flex gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-500 font-display font-semibold text-white">{i + 1}</div>
                    <div className="min-w-0 flex-1 space-y-2.5">
                      <div className="flex flex-col gap-2 md:flex-row">
                        <input
                          aria-label={`Topic ${i + 1}`}
                          className="input flex-1 font-semibold"
                          placeholder="Topic, e.g. Counting by 2s"
                          value={r.topic}
                          maxLength={200}
                          onChange={(e) => update(r.key, { topic: e.target.value })}
                        />
                        <div className="flex gap-2">
                          <select
                            aria-label="Format"
                            className="input w-auto py-2"
                            value={r.format}
                            onChange={(e) => {
                              const f = e.target.value as "long" | "short";
                              update(r.key, { format: f, seconds: f === "short" ? 60 : 300 });
                            }}
                          >
                            <option value="short">📱 Short</option>
                            <option value="long">🖥️ Long</option>
                          </select>
                          <div className="w-28">{durationSelect(r.format, r.seconds, (s) => update(r.key, { seconds: s }), "Length")}</div>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 md:flex-row">
                        <input
                          aria-label="Details"
                          className="input flex-1 text-sm"
                          placeholder="Details / learning goals (optional)"
                          value={r.details}
                          maxLength={2000}
                          onChange={(e) => update(r.key, { details: e.target.value })}
                        />
                        <div className="flex gap-2">
                          <select aria-label="Age" className="input w-auto py-2 text-sm" value={r.age_group} onChange={(e) => update(r.key, { age_group: e.target.value })}>
                            {AGE_GROUPS.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.label}
                              </option>
                            ))}
                          </select>
                          <select aria-label="Subject" className="input w-auto py-2 text-sm" value={r.subject} onChange={(e) => update(r.key, { subject: e.target.value })}>
                            {SUBJECTS.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.emoji} {s.id}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button aria-label="Duplicate row" title="Duplicate" onClick={() => addRow(r)} className="rounded-xl p-2 text-brand-600 hover:bg-brand-50">
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        aria-label="Delete row"
                        title="Delete"
                        onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                        className="rounded-xl p-2 text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            <button
              onClick={() => addRow()}
              className="flex w-full items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-brand-200 py-4 font-display font-semibold text-brand-600 transition hover:border-brand-400 hover:bg-white"
            >
              <Plus className="h-5 w-5" /> Add another video
            </button>
          </div>
        </div>

        <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">🎨 Shared style</h3>
              <Button size="sm" variant="secondary" icon={<Settings2 className="h-4 w-4" />} onClick={() => setShowStyle(true)}>
                Change
              </Button>
            </div>
            <div className="mt-3">{style && <StyleSummary value={style} />}</div>
          </Card>
          <Card className="p-5">
            <h3 className="text-lg font-semibold">🧾 Summary</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 text-center">
              <div className="rounded-2xl bg-brand-50 p-3">
                <div className="font-display text-3xl font-semibold text-brand-700">{filled.length}</div>
                <div className="text-xs font-bold text-slate-500">videos</div>
              </div>
              <div className="rounded-2xl bg-orange-soft p-3">
                <div className="font-display text-3xl font-semibold text-orange-700">{Math.round(totalMin * 10) / 10}</div>
                <div className="text-xs font-bold text-slate-500">minutes total</div>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              ⏱️ Scripts are written in parallel (~1 min). Up to {parallel} videos render at the same time (change in Settings); each takes roughly as long as the video itself.
              💳 Uses AI Gateway credits for scripts and Vercel Sandbox time for rendering.
            </p>
            <div className="mt-4">
              <Toggle emoji="👀" label="Review each script first" desc="Off = fully automatic" checked={review} onChange={setReview} />
            </div>
            <Button size="lg" variant="success" className="mt-4 w-full" loading={busy} icon={<Rocket className="h-5 w-5" />} onClick={generate} disabled={!filled.length}>
              Generate all {filled.length || ""} videos
            </Button>
          </Card>
        </div>
      </div>

      <Modal open={paste} onClose={() => setPaste(false)} title="📋 Paste many topics">
        <p className="mb-3 text-sm text-slate-500">
          One topic per line. Optional details after a <b>|</b> — e.g. <code className="rounded bg-brand-50 px-1">Counting by 5s | use coins and hands</code>
        </p>
        <textarea
          className="input min-h-[220px] font-mono text-sm"
          autoFocus
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder={"Doubles to 10\nDoubles plus one | use the fish tank example\nNumber bonds to 10\nThe five pillars of Islam\nWhy do leaves change colour?"}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setPaste(false)}>
            Cancel
          </Button>
          <Button onClick={doPaste} icon={<ClipboardPaste className="h-4 w-4" />}>
            Add topics
          </Button>
        </div>
      </Modal>

      <Modal open={showStyle} onClose={() => setShowStyle(false)} title="🎨 Style for every video in this batch" className="max-w-5xl">
        {style && <StylePanel value={style} onChange={setStyle} />}
        <div className="mt-6 flex justify-end">
          <Button onClick={() => setShowStyle(false)}>Done</Button>
        </div>
      </Modal>
    </div>
  );
}
