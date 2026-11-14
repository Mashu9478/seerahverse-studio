"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { MUSIC, PALETTES, VOICES } from "@/lib/constants";
import { Chip, Toggle, cx } from "./ui";

export interface StyleValue {
  voice: string;
  speed: number;
  music: "none" | "cheerful" | "calm";
  sfx: boolean;
  mascot: boolean;
  captions: boolean;
  palette: "bright" | "pastel" | "ocean" | "sunset" | "forest" | "candy";
  chip: string;
  greeting: boolean;
  subscribe: boolean;
}

export function VoicePicker({ value, onChange, compact }: { value: string; onChange: (v: string) => void; compact?: boolean }) {
  const [playing, setPlaying] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => () => audio.current?.pause(), []);

  function preview(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (playing === id) {
      audio.current?.pause();
      setPlaying(null);
      return;
    }
    audio.current?.pause();
    const a = new Audio(`/voices/${id}.mp3`);
    audio.current = a;
    a.onended = () => setPlaying(null);
    a.onerror = () => setPlaying(null);
    a.play().then(() => setPlaying(id)).catch(() => setPlaying(null));
  }

  return (
    <div className={cx("grid gap-2.5", compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5")}>
      {VOICES.map((v) => {
        const on = v.id === value;
        return (
          <div
            key={v.id}
            role="radio"
            aria-checked={on}
            tabIndex={0}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onChange(v.id)}
            onClick={() => onChange(v.id)}
            className={cx(
              "relative cursor-pointer rounded-2xl border-2 p-3 transition hover:-translate-y-0.5",
              on ? "border-brand-500 bg-brand-50 shadow-pop" : "border-brand-100 bg-white hover:border-brand-300",
            )}
          >
            <div className="flex items-start justify-between">
              <span className="text-2xl">{v.emoji}</span>
              <button
                type="button"
                aria-label={`Preview ${v.name}`}
                onClick={(e) => preview(v.id, e)}
                className={cx(
                  "grid h-8 w-8 place-items-center rounded-full transition",
                  playing === v.id ? "bg-orange text-white" : "bg-brand-100 text-brand-700 hover:bg-brand-200",
                )}
              >
                {playing === v.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
              </button>
            </div>
            <div className="mt-1 font-display font-semibold">{v.name}</div>
            <div className="text-xs text-slate-500">
              {v.desc} · {v.accent}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StylePanel({ value, onChange }: { value: StyleValue; onChange: (v: StyleValue) => void }) {
  const set = <K extends keyof StyleValue>(k: K, v: StyleValue[K]) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-7">
      <section>
        <h3 className="mb-3 text-lg font-semibold">🎙️ Narrator voice</h3>
        <VoicePicker value={value.voice} onChange={(v) => set("voice", v)} />
        <div className="mt-4 max-w-md">
          <div className="flex items-center justify-between">
            <span className="label">Speaking speed</span>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-sm font-bold text-brand-700">{value.speed.toFixed(2)}×</span>
          </div>
          <input
            type="range"
            min={0.8}
            max={1.15}
            step={0.01}
            value={value.speed}
            onChange={(e) => set("speed", parseFloat(e.target.value))}
            className="w-full"
            aria-label="Speaking speed"
          />
          <div className="flex justify-between text-xs text-slate-500">
            <span>🐢 Slow & clear</span>
            <span>🐇 Quick</span>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">🎵 Background sound</h3>
        <div className="grid gap-2.5 sm:grid-cols-3">
          {MUSIC.map((m) => (
            <button
              type="button"
              key={m.id}
              onClick={() => set("music", m.id)}
              className={cx(
                "rounded-2xl border-2 p-3 text-left transition",
                value.music === m.id ? "border-brand-500 bg-brand-50 shadow-pop" : "border-brand-100 bg-white hover:border-brand-300",
              )}
            >
              <div className="text-2xl">{m.emoji}</div>
              <div className="font-display font-semibold">{m.name}</div>
              <div className="text-xs text-slate-500">{m.desc}</div>
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <Toggle emoji="🔔" label="Sound effects" desc="Pops, dings and countdown ticks" checked={value.sfx} onChange={(v) => set("sfx", v)} />
          <Toggle emoji="🦉" label="Ollie the Owl" desc="Friendly presenter in the corner" checked={value.mascot} onChange={(v) => set("mascot", v)} />
          <Toggle emoji="💬" label="Captions on screen" desc="Great for early readers" checked={value.captions} onChange={(v) => set("captions", v)} />
          <Toggle emoji="🤲" label="Islamic greeting" desc="Assalamu alaikum & Allah Hafiz" checked={value.greeting} onChange={(v) => set("greeting", v)} />
          <Toggle emoji="🔔" label="Like & Subscribe outro" desc="Friendly reminder at the end" checked={value.subscribe} onChange={(v) => set("subscribe", v)} />
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">🎨 Colours & label</h3>
        <div className="flex flex-wrap gap-2.5">
          {PALETTES.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => set("palette", p.id)}
              className={cx(
                "flex items-center gap-2 rounded-2xl border-2 px-3 py-2 transition",
                value.palette === p.id ? "border-brand-500 bg-brand-50 shadow-pop" : "border-brand-100 bg-white hover:border-brand-300",
              )}
            >
              <span className="flex -space-x-1.5">
                {p.colors.map((c) => (
                  <span key={c} className="h-6 w-6 rounded-full ring-2 ring-white" style={{ background: c }} />
                ))}
              </span>
              <span className="font-display text-sm font-semibold">{p.name}</span>
            </button>
          ))}
        </div>
        <div className="mt-4 max-w-md">
          <label className="label" htmlFor="chip">
            Corner label (optional)
          </label>
          <input id="chip" className="input" value={value.chip} maxLength={40} placeholder="e.g. Chapter 3 · Doubles" onChange={(e) => set("chip", e.target.value)} />
          <p className="hint">Shows as a small tag in the top-left of every scene.</p>
        </div>
      </section>
    </div>
  );
}

export function StyleSummary({ value }: { value: StyleValue }) {
  const voice = VOICES.find((v) => v.id === value.voice);
  const music = MUSIC.find((m) => m.id === value.music);
  return (
    <div className="flex flex-wrap gap-1.5">
      <Chip active>{voice?.emoji} {voice?.name ?? value.voice}</Chip>
      <Chip>{music?.emoji} {music?.name}</Chip>
      <Chip>⏩ {value.speed.toFixed(2)}×</Chip>
      {value.mascot && <Chip>🦉 Ollie</Chip>}
      {value.captions && <Chip>💬 Captions</Chip>}
      {value.greeting && <Chip>🤲 Greeting</Chip>}
    </div>
  );
}
