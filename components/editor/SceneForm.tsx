"use client";

import type { Scene } from "@/lib/plan";
import { Toggle } from "../ui";
import { BeatsEditor } from "./BeatsEditor";
import { AtPicker, EmojiIn, ListEditor, NumIn, SelectIn, TextIn } from "./fields";

export function SceneForm({ scene, onChange, speed, short }: { scene: Scene; onChange: (s: Scene) => void; speed: number; short: boolean }) {
  const H = short ? 28 : 40;
  const beats = scene.beats;
  const beatsEditor = (
    <BeatsEditor
      beats={beats}
      speed={speed}
      onChange={(b) => onChange({ ...scene, beats: b } as Scene)}
      fixedCount={scene.type === "quiz" ? 2 : undefined}
      labels={scene.type === "quiz" ? ["Ask", "Reveal"] : undefined}
    />
  );

  const body = (() => {
    switch (scene.type) {
      case "title": {
        const s = scene;
        const p = (x: Partial<typeof s>) => onChange({ ...s, ...x });
        return (
          <div className="space-y-4">
            <TextIn label="Title" big value={s.title} max={short ? 32 : 48} onChange={(v) => p({ title: v })} />
            <TextIn label="Subtitle" value={s.subtitle} max={60} onChange={(v) => p({ subtitle: v })} />
            <div>
              <span className="label">Hero emojis (1–4)</span>
              <div className="flex flex-wrap gap-2">
                {[0, 1, 2, 3].map((i) => (
                  <input
                    key={i}
                    aria-label={`Emoji ${i + 1}`}
                    className="input w-16 text-center text-2xl"
                    value={s.emojis[i] ?? ""}
                    onChange={(e) => {
                      const arr = [...s.emojis];
                      arr[i] = e.target.value;
                      p({ emojis: arr.filter(Boolean) });
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      }
      case "concept":
      case "recap": {
        const s = scene;
        return (
          <div className="space-y-4">
            <div className="flex gap-3">
              <TextIn className="flex-1" label="Heading" value={s.heading} max={H} onChange={(v) => onChange({ ...s, heading: v })} />
              {s.type === "concept" && <EmojiIn label="Big emoji" value={s.emoji} onChange={(v) => onChange({ ...s, emoji: v })} />}
            </div>
            <ListEditor
              title={s.type === "concept" ? "Points (≤4)" : "Recap points (≤5)"}
              items={s.points}
              max={s.type === "concept" ? 4 : 5}
              addLabel="Add point"
              onChange={(pts) => onChange({ ...s, points: pts })}
              make={() => ({ text: "", at: Math.max(0, beats.length - 1) })}
              render={(pt, set) => (
                <div className="space-y-2">
                  <input className="input" placeholder="Short point (≤ 8 words)" value={pt.text} onChange={(e) => set({ ...pt, text: e.target.value })} />
                  <AtPicker beats={beats} at={pt.at} word={pt.word} onChange={(at, word) => set({ ...pt, at, word })} />
                </div>
              )}
            />
          </div>
        );
      }
      case "objects": {
        const s = scene;
        return (
          <div className="space-y-4">
            <TextIn label="Heading" value={s.heading} max={H} onChange={(v) => onChange({ ...s, heading: v })} />
            <ListEditor
              title="Groups of objects (1–3)"
              items={s.groups}
              max={3}
              addLabel="Add group"
              onChange={(g) => onChange({ ...s, groups: g })}
              make={() => ({ emoji: "🍎", count: 3, at: 0 })}
              render={(g, set) => (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-end gap-3">
                    <EmojiIn value={g.emoji} onChange={(v) => set({ ...g, emoji: v })} />
                    <NumIn className="w-24" label="Count" value={g.count} min={1} max={20} onChange={(v) => set({ ...g, count: v })} />
                    <TextIn className="min-w-[120px] flex-1" label="Label (optional)" value={g.label} onChange={(v) => set({ ...g, label: v || undefined })} />
                  </div>
                  <div className="text-xl tracking-wider">{Array.from({ length: Math.min(20, Math.max(0, g.count)) }, () => g.emoji).join("")}</div>
                  <AtPicker beats={beats} at={g.at} word={g.word} onChange={(at, word) => set({ ...g, at, word })} />
                </div>
              )}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectIn
                label="Sign between groups"
                value={(s.operator ?? "none") as string}
                options={[
                  { value: "none", label: "None" },
                  { value: "+", label: "+ plus" },
                  { value: "-", label: "− minus" },
                  { value: "×", label: "× times" },
                  { value: "=", label: "= equals" },
                ]}
                onChange={(v) => onChange({ ...s, operator: v === "none" ? null : (v as "+" | "-" | "×" | "=") })}
              />
              <TextIn
                label="Equation (optional)"
                placeholder="5 + 5 = 10"
                value={s.equation?.text}
                onChange={(v) => onChange({ ...s, equation: v ? { ...(s.equation ?? {}), text: v } : undefined })}
              />
            </div>
            {s.equation && <AtPicker label="Equation appears on" beats={beats} at={s.equation.at} word={s.equation.word} onChange={(at, word) => onChange({ ...s, equation: { ...s.equation!, at, word } })} />}
            <Toggle
              emoji="🔢"
              label="Count aloud"
              desc="Highlight one object per beat (beats should be “One.”, “Two.”…)"
              checked={!!s.count_beats}
              onChange={(on) => onChange({ ...s, count_beats: on ? { start: 0, step: 1 } : undefined })}
            />
            {s.count_beats && (
              <div className="grid gap-3 sm:grid-cols-2">
                <SelectIn
                  label="Counting starts at"
                  value={String(s.count_beats.start)}
                  options={beats.map((b, i) => ({ value: String(i), label: `Beat ${i + 1}: ${b.say.slice(0, 30)}` }))}
                  onChange={(v) => onChange({ ...s, count_beats: { ...s.count_beats!, start: parseInt(v, 10) } })}
                />
                <SelectIn
                  label="Count by"
                  value={String(s.count_beats.step)}
                  options={[
                    { value: "1", label: "Ones (1, 2, 3…)" },
                    { value: "2", label: "Pairs (2, 4, 6…)" },
                  ]}
                  onChange={(v) => onChange({ ...s, count_beats: { ...s.count_beats!, step: parseInt(v, 10) } })}
                />
              </div>
            )}
          </div>
        );
      }
      case "equation": {
        const s = scene;
        const p = (x: Partial<typeof s>) => onChange({ ...s, ...x });
        return (
          <div className="space-y-4">
            <TextIn label="Heading" value={s.heading} max={H} onChange={(v) => p({ heading: v })} />
            <div className="flex flex-wrap items-end gap-3">
              <NumIn className="w-24" label="Number" value={s.a} onChange={(v) => p({ a: v })} />
              <SelectIn
                className="w-24"
                label="Sign"
                value={s.op}
                options={[
                  { value: "+", label: "+" },
                  { value: "-", label: "−" },
                  { value: "×", label: "×" },
                  { value: "÷", label: "÷" },
                ]}
                onChange={(v) => p({ op: v })}
              />
              <NumIn className="w-24" label="Number" value={s.b} onChange={(v) => p({ b: v })} />
              <span className="pb-3 text-2xl font-bold">=</span>
              <NumIn className="w-24" label="Answer" value={s.answer} onChange={(v) => p({ answer: v })} />
              <SelectIn
                className="w-40"
                label="Layout"
                value={s.layout}
                options={[
                  { value: "vertical", label: "📒 Vertical (workbook)" },
                  { value: "horizontal", label: "➡️ Horizontal" },
                ]}
                onChange={(v) => p({ layout: v })}
              />
              <EmojiIn label="Helper objects" value={s.emoji} onChange={(v) => p({ emoji: v || undefined })} />
            </div>
            <AtPicker label="Problem appears on" beats={beats} at={s.show_at} noWord onChange={(at) => p({ show_at: at })} />
            <AtPicker label="Answer pops in on" beats={beats} at={s.answer_at} word={s.answer_word} onChange={(at, word) => p({ answer_at: at, answer_word: word })} />
          </div>
        );
      }
      case "quiz": {
        const s = scene;
        const p = (x: Partial<typeof s>) => onChange({ ...s, ...x });
        return (
          <div className="space-y-4">
            <TextIn label="Question on screen" big value={s.question} max={short ? 60 : 80} onChange={(v) => p({ question: v })} />
            <div className="flex flex-wrap items-end gap-3">
              <SelectIn
                className="w-48"
                label="Answer type"
                value={s.kind}
                options={[
                  { value: "number", label: "🔢 Say the answer" },
                  { value: "choice", label: "🔘 Multiple choice" },
                ]}
                onChange={(v) => p(v === "choice" ? { kind: v, options: s.options?.length ? s.options : ["", ""], correct: 0 } : { kind: v, options: undefined, correct: String(s.correct ?? "") })}
              />
              <NumIn className="w-32" label="Think time (s)" value={s.think_seconds ?? 3} min={2} max={6} onChange={(v) => p({ think_seconds: v })} />
              {s.kind === "number" && <TextIn className="w-40" label="Correct answer" value={String(s.correct ?? "")} onChange={(v) => p({ correct: v })} />}
            </div>
            {s.kind === "choice" && (
              <ListEditor
                title="Options (2–4) — tap ✓ for the right one"
                items={s.options ?? []}
                max={4}
                addLabel="Add option"
                onChange={(o) => p({ options: o, correct: Math.min(Number(s.correct) || 0, Math.max(0, o.length - 1)) })}
                make={() => ""}
                render={(o, set, i) => (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => p({ correct: i })}
                      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border-2 font-bold ${Number(s.correct) === i ? "border-leaf bg-leaf text-white" : "border-slate-300 text-slate-400"}`}
                      aria-label="Mark correct"
                    >
                      ✓
                    </button>
                    <input className="input" value={o} placeholder={`Option ${i + 1}`} onChange={(e) => set(e.target.value)} />
                  </div>
                )}
              />
            )}
            <p className="rounded-2xl bg-sun-soft p-3 text-sm text-amber-900">⏳ A countdown plays between the “Ask” beat and the “Reveal” beat.</p>
          </div>
        );
      }
      case "steps": {
        const s = scene;
        return (
          <div className="space-y-4">
            <TextIn label="Heading" value={s.heading} max={H} onChange={(v) => onChange({ ...s, heading: v })} />
            <ListEditor
              title="Steps (2–5)"
              items={s.steps}
              max={5}
              addLabel="Add step"
              onChange={(st) => onChange({ ...s, steps: st })}
              make={() => ({ emoji: "⭐", text: "", at: Math.max(0, beats.length - 1) })}
              render={(st, set) => (
                <div className="space-y-2">
                  <div className="flex items-end gap-3">
                    <EmojiIn value={st.emoji} onChange={(v) => set({ ...st, emoji: v })} />
                    <TextIn className="flex-1" label="Text" value={st.text} max={40} onChange={(v) => set({ ...st, text: v })} />
                  </div>
                  <AtPicker beats={beats} at={st.at} word={st.word} onChange={(at, word) => set({ ...st, at, word })} />
                </div>
              )}
            />
          </div>
        );
      }
      case "compare": {
        const s = scene;
        const side = (k: "left" | "right") => {
          const sd = s[k];
          const setSide = (v: typeof sd) => onChange({ ...s, [k]: v });
          return (
            <div className="space-y-3 rounded-3xl bg-brand-50/60 p-3">
              <div className="flex items-end gap-2">
                <EmojiIn value={sd.emoji} onChange={(v) => setSide({ ...sd, emoji: v })} />
                <TextIn className="flex-1" label={k === "left" ? "Left title" : "Right title"} value={sd.title} max={20} onChange={(v) => setSide({ ...sd, title: v })} />
              </div>
              <ListEditor
                title="Items"
                items={sd.items}
                max={5}
                addLabel="Add item"
                onChange={(it) => setSide({ ...sd, items: it })}
                make={() => ({ emoji: "⭐", at: Math.max(0, beats.length - 1) })}
                render={(it, set) => (
                  <div className="space-y-2">
                    <div className="flex items-end gap-2">
                      <EmojiIn value={it.emoji} onChange={(v) => set({ ...it, emoji: v })} />
                      <TextIn className="flex-1" label="Label" value={it.text} max={16} onChange={(v) => set({ ...it, text: v || undefined })} />
                    </div>
                    <AtPicker beats={beats} at={it.at} noWord onChange={(at) => set({ ...it, at })} />
                  </div>
                )}
              />
            </div>
          );
        };
        return (
          <div className="space-y-4">
            <TextIn label="Heading" value={s.heading} max={H} onChange={(v) => onChange({ ...s, heading: v })} />
            <div className="grid gap-3 lg:grid-cols-2">
              {side("left")}
              {side("right")}
            </div>
          </div>
        );
      }
      case "story": {
        const s = scene;
        return (
          <div className="space-y-4">
            <TextIn label="Heading" value={s.heading} max={H} onChange={(v) => onChange({ ...s, heading: v })} />
            <ListEditor
              title="Characters (≤3)"
              items={s.characters}
              max={3}
              addLabel="Add character"
              onChange={(c) => onChange({ ...s, characters: c })}
              make={() => ({ emoji: "🧒", name: "", side: "right" as const })}
              render={(c, set) => (
                <div className="flex flex-wrap items-end gap-2">
                  <EmojiIn value={c.emoji} onChange={(v) => set({ ...c, emoji: v })} />
                  <TextIn className="min-w-[120px] flex-1" label="Name" value={c.name} max={14} onChange={(v) => set({ ...c, name: v })} />
                  <SelectIn
                    className="w-32"
                    label="Stands"
                    value={c.side}
                    options={[
                      { value: "left", label: "⬅️ Left" },
                      { value: "center", label: "⏺️ Center" },
                      { value: "right", label: "➡️ Right" },
                    ]}
                    onChange={(v) => set({ ...c, side: v })}
                  />
                </div>
              )}
            />
            <ListEditor
              title="Props (≤3)"
              items={s.props}
              max={3}
              addLabel="Add prop"
              onChange={(pr) => onChange({ ...s, props: pr })}
              make={() => ({ emoji: "🍎", count: 3, at: 0 })}
              render={(pr, set) => (
                <div className="space-y-2">
                  <div className="flex items-end gap-2">
                    <EmojiIn value={pr.emoji} onChange={(v) => set({ ...pr, emoji: v })} />
                    <NumIn className="w-24" label="Count" min={1} max={20} value={pr.count} onChange={(v) => set({ ...pr, count: v })} />
                  </div>
                  <AtPicker beats={beats} at={pr.at} word={pr.word} onChange={(at, word) => set({ ...pr, at, word })} />
                </div>
              )}
            />
            <TextIn
              label="Equation boxes (optional)"
              placeholder="8 + 8 = 16"
              value={s.equation?.text}
              onChange={(v) => onChange({ ...s, equation: v ? { ...(s.equation ?? {}), text: v } : undefined })}
            />
            {s.equation && <AtPicker label="Equation fills on" beats={beats} at={s.equation.at} noWord onChange={(at) => onChange({ ...s, equation: { ...s.equation!, at } })} />}
          </div>
        );
      }
      case "fact": {
        const s = scene;
        return (
          <div className="space-y-4">
            <div className="flex gap-3">
              <TextIn className="flex-1" label="Heading" value={s.heading} max={H} onChange={(v) => onChange({ ...s, heading: v })} />
              <EmojiIn value={s.emoji} onChange={(v) => onChange({ ...s, emoji: v })} />
            </div>
            <label className="block">
              <span className="label">Fact text (≤ 20 words)</span>
              <textarea className="input min-h-[80px]" value={s.text} onChange={(e) => onChange({ ...s, text: e.target.value })} />
            </label>
          </div>
        );
      }
      case "islamic": {
        const s = scene;
        const p = (x: Partial<typeof s>) => onChange({ ...s, ...x });
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
              <TextIn className="min-w-[200px] flex-1" label="Heading" value={s.heading} max={H} onChange={(v) => p({ heading: v })} />
              <SelectIn
                className="w-40"
                label="Kind"
                value={s.kind}
                options={[
                  { value: "ayah", label: "📖 Ayah" },
                  { value: "hadith", label: "📜 Hadith" },
                  { value: "seerah", label: "🐪 Seerah" },
                  { value: "dua", label: "🤲 Dua" },
                ]}
                onChange={(v) => p({ kind: v })}
              />
              <EmojiIn value={s.emoji} onChange={(v) => p({ emoji: v || undefined })} />
            </div>
            <label className="block">
              <span className="label">Arabic (optional — paste exact text only)</span>
              <textarea dir="rtl" className="input min-h-[70px] text-right text-xl" value={s.arabic ?? ""} onChange={(e) => p({ arabic: e.target.value || undefined })} />
              <span className="hint block">Only paste Arabic you have verified from a trusted mushaf or hadith collection.</span>
            </label>
            <label className="block">
              <span className="label">Translation / story text</span>
              <textarea className="input min-h-[80px]" value={s.translation} onChange={(e) => p({ translation: e.target.value })} />
            </label>
            <TextIn label="Reference" placeholder="e.g. Surah Al-Baqarah 2:286 · Sahih al-Bukhari 6018 · Seerah" value={s.reference} onChange={(v) => p({ reference: v })} />
            <p className="rounded-2xl bg-leaf-soft p-3 text-sm text-green-900">🕌 Please double-check the reference and translation with a trusted source before publishing.</p>
          </div>
        );
      }
      case "outro": {
        const s = scene;
        return (
          <div className="space-y-4">
            <TextIn label="Big goodbye text" big value={s.title} max={short ? 28 : 40} onChange={(v) => onChange({ ...s, title: v })} />
            <TextIn label="Subtitle (optional)" value={s.subtitle} onChange={(v) => onChange({ ...s, subtitle: v || undefined })} />
          </div>
        );
      }
    }
  })();

  return (
    <div className="space-y-6">
      {body}
      <div className="border-t border-brand-100 pt-5">{beatsEditor}</div>
    </div>
  );
}
