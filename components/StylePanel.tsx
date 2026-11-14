"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { Check, Clapperboard, Mic2, Music2, Palette, Pause, Play, UserRound, Wand2 } from "lucide-react";
import { MUSIC, PALETTES, VOICES, characterById } from "@/lib/constants";
import { PresenterPicker } from "./PresenterPicker";
import { VideoStylePicker } from "./VideoStylePicker";
import { Chip, Segmented, Toggle, cx } from "./ui";

export interface StyleValue {
  voice: string;
  speed: number;
  music: "none" | "cheerful" | "calm";
  sfx: boolean;
  mascot: boolean;
  presenter: string;
  /** "presenter" = character + emoji scenes, "explainer" = illustrated diagram that changes step by step */
  style: "presenter" | "explainer";
  captions: boolean;
  palette: "bright" | "pastel" | "ocean" | "sunset" | "forest" | "candy";
  chip: string;
  greeting: boolean;
  subscribe: boolean;
}

/* ------------------------------------------------------------------ section shell */
function Section({
  icon,
  title,
  desc,
  tone,
  children,
  aside,
}: {
  icon: ReactNode;
  title: string;
  desc?: string;
  tone: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="panel relative overflow-hidden p-4 sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset ring-white/10", tone)}>{icon}</span>
          <div>
            <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
            {desc && <p className="text-xs text-fg-subtle">{desc}</p>}
          </div>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ equaliser */
function Equalizer({ on }: { on: boolean }) {
  return (
    <span className="flex h-4 items-end gap-[3px]" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className={cx("w-[3px] rounded-full", on ? "bg-cyan-300" : "bg-white/20")}
          animate={on ? { height: ["30%", "100%", "45%", "85%", "30%"] } : { height: "30%" }}
          transition={on ? { duration: 0.9, repeat: Infinity, delay: i * 0.12, ease: "easeInOut" } : { duration: 0.2 }}
        />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------ voice picker */
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
    <div role="radiogroup" aria-label="Narrator voice" className={cx("grid gap-2.5", compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5")}>
      {VOICES.map((v) => {
        const on = v.id === value;
        const isPlaying = playing === v.id;
        return (
          <motion.div
            key={v.id}
            role="radio"
            aria-checked={on}
            tabIndex={0}
            whileHover={{ y: -2 }}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onChange(v.id)}
            onClick={() => onChange(v.id)}
            className={cx(
              "group relative cursor-pointer overflow-hidden rounded-2xl border p-3 transition duration-300",
              on
                ? "border-brand-400/60 bg-brand-500/[0.14] shadow-[0_0_0_1px_rgba(167,139,250,0.25),0_16px_40px_-18px_rgba(139,92,246,0.9)]"
                : "border-white/[0.08] bg-white/[0.025] hover:border-white/20 hover:bg-white/[0.045]",
            )}
          >
            {on && <span className="pointer-events-none absolute -right-8 -top-8 h-20 w-20 rounded-full bg-brand-500/40 blur-2xl" />}
            <div className="relative flex items-start justify-between">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/[0.06] text-lg">{v.emoji}</span>
              <button
                type="button"
                aria-label={isPlaying ? `Stop ${v.name}` : `Preview ${v.name}`}
                onClick={(e) => preview(v.id, e)}
                className={cx(
                  "grid h-8 w-8 place-items-center rounded-full transition",
                  isPlaying ? "bg-cyan-400 text-[#06222A] shadow-glow-cyan" : "bg-white/[0.08] text-fg-muted hover:bg-white/[0.16] hover:text-fg",
                )}
              >
                {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 translate-x-[1px]" />}
              </button>
            </div>
            <div className="relative mt-2 flex items-center gap-2">
              <span className="font-display text-sm font-semibold text-fg">{v.name}</span>
              <Equalizer on={isPlaying} />
            </div>
            <div className="relative text-[11px] text-fg-subtle">
              {v.desc} · {v.accent}
            </div>
            {on && (
              <span className="absolute bottom-2.5 right-2.5 grid h-4 w-4 place-items-center rounded-full bg-brand-500 text-white">
                <Check className="h-2.5 w-2.5" strokeWidth={3.5} />
              </span>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ speed slider */
function SpeedSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const pct = ((value - 0.8) / (1.15 - 0.8)) * 100;
  const label = value < 0.88 ? "Slow & clear" : value < 0.98 ? "Natural" : value < 1.06 ? "Lively" : "Quick";
  return (
    <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/20 p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-fg-muted">Speaking speed</span>
        <span className="flex items-center gap-2">
          <span className="text-xs text-fg-subtle">{label}</span>
          <span className="rounded-lg bg-white/[0.08] px-2 py-0.5 font-display text-sm font-semibold text-fg tabular-nums ring-1 ring-white/10">
            {value.toFixed(2)}×
          </span>
        </span>
      </div>
      <div className="relative h-6">
        <div className="absolute top-1/2 h-2 w-full -translate-y-1/2 rounded-full bg-white/[0.08]" />
        <div className="absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-cool-grad shadow-[0_0_14px_rgba(34,211,238,0.5)]" style={{ width: `${pct}%` }} />
        <div
          className="pointer-events-none absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-bg-elev shadow-[0_0_0_4px_rgba(139,92,246,0.3)]"
          style={{ left: `${pct}%` }}
        />
        <input
          type="range"
          min={0.8}
          max={1.15}
          step={0.01}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label="Speaking speed"
        />
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-fg-subtle">
        <span>🐢 Slow</span>
        <span>Natural</span>
        <span>🐇 Quick</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ main panel */
export function StylePanel({
  value,
  onChange,
  lockStyle,
}: {
  value: StyleValue;
  onChange: (v: StyleValue) => void;
  /** Script editor: the style is fixed by the written script, so hide the style picker. */
  lockStyle?: boolean;
}) {
  const set = <K extends keyof StyleValue>(k: K, v: StyleValue[K]) => onChange({ ...value, [k]: v });
  const presenter = value.presenter || (value.mascot ? "ollie" : "none");
  const music = MUSIC.find((m) => m.id === value.music);
  const explainer = value.style === "explainer";

  return (
    <div className="space-y-4">
      {!lockStyle && (
      <Section
        icon={<Clapperboard className="h-5 w-5" />}
        tone="bg-cyan-400/15 text-cyan-300"
        title="Video style"
        desc="How the lesson is shown on screen."
        aside={<Chip active color={explainer ? "sky" : "brand"}>{explainer ? "Diagram" : "Character"}</Chip>}
      >
        <VideoStylePicker value={value.style ?? "presenter"} onChange={(st) => onChange({ ...value, style: st })} />
      </Section>
      )}

      {explainer ? (
        <section className="panel relative flex items-center gap-4 overflow-hidden p-4 sm:p-5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-xl ring-1 ring-inset ring-white/10">🔬</span>
          <div>
            <h3 className="text-[15px] font-semibold text-fg">No character — the diagram explains the lesson</h3>
            <p className="text-xs text-fg-subtle">Claude draws one object for the topic, cuts it open and animates it step by step with labels and zooms. A friendly teacher voice narrates.</p>
          </div>
        </section>
      ) : (
        <Section
          icon={<UserRound className="h-5 w-5" />}
          tone="bg-pink-500/15 text-pink-300"
          title="Presenter"
          desc="Who hosts the lesson on screen — lip-synced, blinking and waving."
          aside={<Chip active color="rose">{characterById(presenter).short}</Chip>}
        >
          <PresenterPicker value={presenter} onChange={(id) => onChange({ ...value, presenter: id, mascot: id !== "none" })} />
        </Section>
      )}

      <Section icon={<Mic2 className="h-5 w-5" />} tone="bg-cyan-400/15 text-cyan-300" title="Narrator voice" desc="Tap ▶ to hear each voice. The presenter speaks with this voice.">
        <VoicePicker value={value.voice} onChange={(v) => set("voice", v)} />
        <SpeedSlider value={value.speed} onChange={(v) => set("speed", v)} />
      </Section>

      <Section icon={<Music2 className="h-5 w-5" />} tone="bg-violet-500/15 text-violet-300" title="Background sound">
        <Segmented
          value={value.music}
          onChange={(m) => set("music", m)}
          options={MUSIC.map((m) => ({ value: m.id, label: <span className="flex items-center gap-1.5">{m.emoji} {m.name}</span> }))}
        />
        <p className="mt-3 text-xs text-fg-muted">
          {music?.desc}
          {value.music !== "none" && " Music automatically softens whenever the narrator speaks."}
        </p>
        {value.music === "none" && (
          <p className="mt-1 text-[11px] text-fg-subtle">“No music” keeps only the voice and gentle sound effects — a choice many Muslim families prefer.</p>
        )}
      </Section>

      <Section icon={<Wand2 className="h-5 w-5" />} tone="bg-amber-400/15 text-amber-300" title="Extras">
        <div className="grid gap-2.5 sm:grid-cols-2">
          <Toggle emoji="🔔" label="Sound effects" desc="Pops, dings and countdown ticks" checked={value.sfx} onChange={(v) => set("sfx", v)} />
          <Toggle emoji="💬" label="Captions on screen" desc="Great for early readers" checked={value.captions} onChange={(v) => set("captions", v)} />
          <Toggle emoji="🤲" label="Islamic greeting" desc="Assalamu alaikum & Allah Hafiz" checked={value.greeting} onChange={(v) => set("greeting", v)} />
          <Toggle emoji="👍" label="Like & Subscribe outro" desc="Friendly reminder at the end" checked={value.subscribe} onChange={(v) => set("subscribe", v)} />
        </div>
      </Section>

      <Section icon={<Palette className="h-5 w-5" />} tone="bg-emerald-400/15 text-emerald-300" title="Look" desc="Background colours for the scenes and an optional corner label.">
        <div className="flex flex-wrap gap-3">
          {PALETTES.map((p) => {
            const on = value.palette === p.id;
            return (
              <button
                type="button"
                key={p.id}
                onClick={() => set("palette", p.id)}
                aria-pressed={on}
                className="group flex flex-col items-center gap-1.5"
              >
                <span
                  className={cx(
                    "relative grid h-14 w-14 place-items-center rounded-full transition duration-300",
                    on ? "scale-105 ring-2 ring-white ring-offset-4 ring-offset-bg-card" : "ring-1 ring-white/15 group-hover:scale-105 group-hover:ring-white/40",
                  )}
                  style={{ background: `conic-gradient(from 200deg, ${p.colors.join(", ")}, ${p.colors[0]})`, boxShadow: on ? `0 10px 30px -8px ${p.colors[1]}` : undefined }}
                >
                  {on && (
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-black/45 text-white backdrop-blur">
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    </span>
                  )}
                </span>
                <span className={cx("text-[11px] font-semibold", on ? "text-fg" : "text-fg-subtle")}>{p.name}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-5 max-w-md">
          <label className="label" htmlFor="chip">
            Corner label <span className="normal-case tracking-normal text-fg-subtle">(optional)</span>
          </label>
          <input id="chip" className="input" value={value.chip} maxLength={40} placeholder="e.g. Chapter 3 · Doubles" onChange={(e) => set("chip", e.target.value)} />
          <p className="hint">Shows as a small tag in the top-left corner of every scene.</p>
        </div>
      </Section>
    </div>
  );
}

/* ------------------------------------------------------------------ compact summary */
export function StyleSummary({ value }: { value: StyleValue }) {
  const voice = VOICES.find((v) => v.id === value.voice);
  const music = MUSIC.find((m) => m.id === value.music);
  const presenter = characterById(value.presenter || (value.mascot ? "ollie" : "none"));
  const palette = PALETTES.find((p) => p.id === value.palette);
  return (
    <div className="flex flex-wrap gap-1.5">
      {value.style === "explainer" ? (
        <Chip active color="sky">🔬 Diagram explainer</Chip>
      ) : (
        <Chip active color="rose">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {presenter.id !== "none" && <img src={presenter.img} alt="" className="-my-1 -ml-1 h-5 w-5 object-contain" />}
          {presenter.id === "none" ? "No character" : presenter.short}
        </Chip>
      )}
      <Chip active>
        {voice?.emoji} {voice?.name ?? value.voice}
      </Chip>
      <Chip>
        {music?.emoji} {music?.name}
      </Chip>
      <Chip>⏩ {value.speed.toFixed(2)}×</Chip>
      {palette && (
        <Chip>
          <span className="h-3 w-3 rounded-full" style={{ background: `conic-gradient(${palette.colors.join(",")})` }} /> {palette.name}
        </Chip>
      )}
      {value.captions && <Chip>💬 Captions</Chip>}
      {value.greeting && <Chip>🤲 Greeting</Chip>}
      {value.sfx && <Chip>🔔 SFX</Chip>}
    </div>
  );
}

