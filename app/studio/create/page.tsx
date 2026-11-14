"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Rocket } from "lucide-react";
import { toast } from "sonner";
import { AGE_GROUPS, SUBJECTS } from "@/lib/constants";
import { api } from "@/lib/client";
import { fmtDuration } from "@/lib/plan";
import { Button, Card, Chip, PageHeader, Toggle, cx } from "@/components/ui";
import { FormatPicker, durationLabel, type FormatValue } from "@/components/FormatPicker";
import { StylePanel, StyleSummary, type StyleValue } from "@/components/StylePanel";
import { ImageUploader } from "@/components/ImageUploader";
import { styleFromSettings, useAppSettings } from "@/components/useAppSettings";

const STEPS = [
  { label: "Topic", emoji: "💡" },
  { label: "Format", emoji: "📐" },
  { label: "Style", emoji: "🎨" },
  { label: "Generate", emoji: "🚀" },
];

const IDEAS = [
  { topic: "Doubles: adding the same number twice", subject: "Math", age: "6-7" },
  { topic: "The water cycle", subject: "Science", age: "8-9" },
  { topic: "Why we say Bismillah", subject: "Islamic Studies", age: "4-5" },
  { topic: "The story of the Hijrah", subject: "Seerah", age: "10-12" },
  { topic: "Nouns and verbs", subject: "English", age: "6-7" },
  { topic: "Parts of a plant", subject: "Science", age: "6-7" },
];

export default function CreatePage() {
  const router = useRouter();
  const settings = useAppSettings();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [topic, setTopic] = useState("");
  const [subject, setSubject] = useState<string>("Math");
  const [age, setAge] = useState("6-7");
  const [details, setDetails] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [fmt, setFmt] = useState<FormatValue>({ format: "long", target_seconds: 300 });
  const [style, setStyle] = useState<StyleValue | null>(null);
  const [review, setReview] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!settings || style) return;
    setStyle(styleFromSettings(settings));
    setAge(settings.age_group);
    setFmt(settings.format === "short" ? { format: "short", target_seconds: settings.short_seconds } : { format: "long", target_seconds: settings.long_minutes * 60 });
  }, [settings, style]);

  const canNext = step !== 0 || topic.trim().length >= 2 || images.length > 0;

  function go(n: number) {
    if (n > step && !canNext) {
      toast.error("Please type a topic (or upload a textbook page) first.");
      return;
    }
    setDir(n > step ? 1 : -1);
    setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
  }

  async function generate() {
    if (!style) return;
    setBusy(true);
    try {
      const t = topic.trim() || "Lesson from the attached textbook pages";
      await api<{ ids: string[] }>("/api/videos", {
        body: {
          videos: [
            {
              topic: t,
              subject,
              age_group: age,
              details,
              image_urls: images,
              format: fmt.format,
              target_seconds: fmt.target_seconds,
              review,
              settings: style,
            },
          ],
        },
      });
      toast.success("✍️ Claude is writing your script!", { description: review ? "You'll get a 👀 when it's ready to review." : "It will render automatically." });
      router.push("/studio/queue");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start");
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader emoji="✨" title="Create a video" subtitle="Four quick steps. Claude writes the lesson, the studio animates and narrates it." />

      {/* stepper */}
      <div className="mb-6 flex items-center gap-2 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s.label} className="flex flex-1 items-center gap-2">
            <button
              onClick={() => go(i)}
              className={cx(
                "flex shrink-0 items-center gap-2 rounded-full px-4 py-2 font-display font-semibold transition",
                i === step ? "bg-brand-500 text-white shadow-pop" : i < step ? "bg-leaf-soft text-green-800" : "bg-white text-slate-500 ring-1 ring-brand-100",
              )}
            >
              <span className="text-lg">{i < step ? <Check className="h-4 w-4" strokeWidth={3} /> : s.emoji}</span>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className={cx("h-1 min-w-4 flex-1 rounded-full", i < step ? "bg-leaf" : "bg-brand-100")} />}
          </div>
        ))}
      </div>

      <Card className="relative overflow-hidden p-5 sm:p-8">
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ x: dir * 40, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -dir * 40, opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            {step === 0 && (
              <div className="space-y-6">
                <div>
                  <label className="label" htmlFor="topic">
                    What&apos;s the lesson about?
                  </label>
                  <input
                    id="topic"
                    autoFocus
                    className="input text-lg"
                    placeholder="e.g. Doubles — adding the same number twice"
                    value={topic}
                    maxLength={200}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && go(1)}
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="py-1.5 text-xs font-bold text-slate-400">Need an idea?</span>
                    {IDEAS.map((i) => (
                      <button
                        key={i.topic}
                        type="button"
                        onClick={() => {
                          setTopic(i.topic);
                          setSubject(i.subject);
                          setAge(i.age);
                        }}
                        className="rounded-full bg-sun-soft px-3 py-1 text-xs font-bold text-amber-900 transition hover:bg-sun"
                      >
                        {i.topic}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="label">Subject</span>
                  <div className="flex flex-wrap gap-2">
                    {SUBJECTS.map((s) => (
                      <Chip key={s.id} active={subject === s.id} onClick={() => setSubject(s.id)}>
                        {s.emoji} {s.id}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <span className="label">Children&apos;s age</span>
                  <div className="flex flex-wrap gap-2">
                    {AGE_GROUPS.map((a) => (
                      <Chip key={a.id} color="orange" active={age === a.id} onClick={() => setAge(a.id)}>
                        {a.emoji} {a.label}
                      </Chip>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="details">
                    Learning goals & extra details <span className="font-normal text-slate-400">(optional)</span>
                  </label>
                  <textarea
                    id="details"
                    className="input min-h-[120px]"
                    placeholder={"e.g. Cover exercises 5–16 from the pages. Include doubles plus one (3+3+1). Use the fish tank example. Mention a Seerah story about sharing equally."}
                    value={details}
                    maxLength={6000}
                    onChange={(e) => setDetails(e.target.value)}
                  />
                  <p className="hint">Tip: paste any exact Arabic ayah or dua here if you want it shown on screen — the studio never invents Arabic text.</p>
                </div>
                <div>
                  <span className="label">Textbook pages (optional)</span>
                  <ImageUploader value={images} onChange={setImages} />
                </div>
              </div>
            )}

            {step === 1 && <FormatPicker value={fmt} onChange={setFmt} speed={style?.speed} />}

            {step === 2 && style && <StylePanel value={style} onChange={setStyle} />}

            {step === 3 && style && (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-3xl bg-brand-50 p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-brand-600">Lesson</div>
                    <div className="mt-1 font-display text-2xl font-semibold">{topic || "From textbook pages"}</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Chip active>{SUBJECTS.find((s) => s.id === subject)?.emoji} {subject}</Chip>
                      <Chip color="orange" active>
                        {AGE_GROUPS.find((a) => a.id === age)?.emoji} {age} yrs
                      </Chip>
                      {images.length > 0 && <Chip>🖼️ {images.length} page(s)</Chip>}
                    </div>
                    {details && <p className="mt-3 line-clamp-4 text-sm text-slate-600">{details}</p>}
                  </div>
                  <div className="rounded-3xl bg-orange-soft p-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-orange-700">Format & style</div>
                    <div className="mt-1 font-display text-2xl font-semibold">
                      {fmt.format === "short" ? "📱" : "🖥️"} {durationLabel(fmt)}
                    </div>
                    <div className="text-sm text-slate-600">≈ {fmtDuration(fmt.target_seconds)} · {fmt.format === "short" ? "1080×1920" : "1920×1080"}</div>
                    <div className="mt-3">
                      <StyleSummary value={style} />
                    </div>
                  </div>
                </div>
                <Toggle
                  emoji="👀"
                  label="Let me review the script before rendering"
                  desc="Recommended — check facts, edit scenes, then press Approve & render."
                  checked={review}
                  onChange={setReview}
                />
                <div className="rounded-3xl border-2 border-dashed border-brand-200 p-5 text-center">
                  <p className="text-slate-600">
                    Script: ~{fmt.format === "short" ? "20–40 s" : fmt.target_seconds > 360 ? "1–3 min" : "40–90 s"} · Rendering: about{" "}
                    {fmt.format === "short" ? "1–3" : Math.max(3, Math.round(fmt.target_seconds / 60))} min on a render machine.
                  </p>
                  <Button size="lg" variant="success" className="mt-4" loading={busy} icon={<Rocket className="h-5 w-5" />} onClick={generate}>
                    Generate my video!
                  </Button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between border-t border-brand-100 pt-5">
          <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => go(step - 1)} disabled={step === 0}>
            Back
          </Button>
          {step < STEPS.length - 1 && (
            <Button onClick={() => go(step + 1)} disabled={!canNext}>
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
