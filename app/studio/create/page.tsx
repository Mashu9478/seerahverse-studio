"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowLeft, ArrowRight, BookOpen, Languages, Lightbulb, Loader2, Palette, Ratio, RefreshCw, Rocket, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { AGE_GROUPS, LANGUAGES, MUSIC, SUBJECTS, VOICES, characterById } from "@/lib/constants";
import { api, type VideoFull } from "@/lib/client";
import { fmtDuration } from "@/lib/plan";
import { Button, Chip, PageHeader, Switch, cx } from "@/components/ui";
import { FormatPicker, durationLabel, type FormatValue } from "@/components/FormatPicker";
import { StylePanel, StyleSummary, type StyleValue } from "@/components/StylePanel";
import { ImageUploader } from "@/components/ImageUploader";
import { styleFromVideo, styleToSettings, styleFromSettings, useAppSettings } from "@/components/useAppSettings";
import { LanguageChip, URDU_FONT } from "@/components/LanguagePicker";
import { Stepper, type StepDef } from "@/components/create/Stepper";
import { LiveSummary } from "@/components/create/LiveSummary";

const STEPS: StepDef[] = [
  { label: "Topic", hint: "What to teach", icon: Lightbulb },
  { label: "Format", hint: "Short or long", icon: Ratio },
  { label: "Style", hint: "Presenter & voice", icon: Palette },
  { label: "Generate", hint: "Review & go", icon: Rocket },
];

const IDEAS = [
  { topic: "Doubles: adding the same number twice", subject: "Math", age: "6-7" },
  { topic: "The water cycle", subject: "Science", age: "8-9" },
  { topic: "Why we say Bismillah", subject: "Islamic Studies", age: "4-5" },
  { topic: "The story of the Hijrah", subject: "Seerah", age: "10-12" },
  { topic: "Nouns and verbs", subject: "English", age: "6-7" },
  { topic: "Parts of a plant", subject: "Science", age: "6-7" },
];

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export default function CreatePage() {
  return (
    <Suspense fallback={null}>
      <CreateWizard />
    </Suspense>
  );
}

function CreateWizard() {
  const router = useRouter();
  const editId = useSearchParams().get("edit");
  const [editVideo, setEditVideo] = useState<VideoFull | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
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
  const [error, setError] = useState<string | null>(null);

  // Edit & try again: load the existing video's options
  useEffect(() => {
    if (!editId) return;
    let off = false;
    api<{ video: VideoFull }>(`/api/videos/${editId}`)
      .then((r) => !off && setEditVideo(r.video))
      .catch((e) => !off && setEditError(e instanceof Error ? e.message : "Couldn't load this video"));
    return () => {
      off = true;
    };
  }, [editId]);

  useEffect(() => {
    if (!settings || style) return;
    if (editId) {
      if (!editVideo) return;
      const v = editVideo;
      setTopic(v.topic ?? "");
      setSubject(v.subject || "Math");
      setAge(v.age_group || settings.age_group);
      setDetails(v.details ?? "");
      setImages(v.image_urls ?? []);
      setFmt({ format: v.format, target_seconds: v.target_seconds });
      setReview(!v.auto_render);
      setStyle(styleFromVideo(v.settings, styleFromSettings(settings)));
      return;
    }
    setStyle(styleFromSettings(settings));
    setAge(settings.age_group);
    setFmt(settings.format === "short" ? { format: "short", target_seconds: settings.short_seconds } : { format: "long", target_seconds: settings.long_minutes * 60 });
  }, [settings, style, editId, editVideo]);

  const topicOk = topic.trim().length >= 2 || images.length > 0;

  const go = useCallback(
    (n: number) => {
      if (n > step && step === 0 && !topicOk) {
        setError("Type a topic (at least 2 letters) or upload a textbook page to continue.");
        return;
      }
      if (n > 0 && !topicOk) {
        setError("Type a topic (at least 2 letters) or upload a textbook page to continue.");
        setDir(-1);
        setStep(0);
        return;
      }
      setError(null);
      setDir(n > step ? 1 : -1);
      setStep(Math.max(0, Math.min(STEPS.length - 1, n)));
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [step, topicOk],
  );

  const generate = useCallback(async () => {
    if (!style || busy) return;
    if (!topicOk) {
      go(0);
      return;
    }
    setBusy(true);
    try {
      const t = topic.trim() || "Lesson from the attached textbook pages";
      if (editId) {
        await api(`/api/videos/${editId}/redo`, {
          body: {
            topic: t,
            subject,
            age_group: age,
            details,
            image_urls: images,
            format: fmt.format,
            target_seconds: fmt.target_seconds,
            review,
            settings: styleToSettings(style),
          },
        });
        toast.success("Saved — writing the script again", {
          description: review ? "You'll be notified when the new script is ready to review." : "It will render automatically when the script is done.",
        });
        router.push("/studio/queue");
        return;
      }
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
              settings: styleToSettings(style),
            },
          ],
        },
      });
      toast.success("Claude is writing your script", { description: review ? "You'll be notified when it's ready to review." : "It will render automatically when the script is done." });
      router.push("/studio/queue");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start");
      setBusy(false);
    }
  }, [style, busy, topicOk, topic, subject, age, details, images, fmt, review, router, go, editId]);

  // Ctrl/⌘ + Enter → next step / generate
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (step < STEPS.length - 1) go(step + 1);
        else generate();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, go, generate]);

  const presenter = characterById(style?.presenter || (style?.mascot === false ? "none" : "ollie"));
  const voice = VOICES.find((v) => v.id === style?.voice);
  const music = MUSIC.find((m) => m.id === style?.music);
  const urdu = style?.language === "ur";
  const lang = LANGUAGES.find((l) => l.id === (urdu ? "ur" : "en"));
  const editTitle = editVideo?.plan?.title || editVideo?.youtube?.title || editVideo?.topic;

  if (editId && (editError || !editVideo || !style)) {
    return (
      <div>
        <PageHeader emoji="🛠️" title="Edit & try again" subtitle="Loading this video's options…" />
        <div className="card grid min-h-[240px] place-items-center p-8 text-center">
          {editError ? (
            <div>
              <p className="text-sm text-red-300">{editError}</p>
              <Button className="mt-4" variant="secondary" onClick={() => router.push("/studio/queue")}>
                Back to queue
              </Button>
            </div>
          ) : (
            <Loader2 className="h-6 w-6 animate-spin text-fg-subtle" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {editId ? (
        <PageHeader
          emoji="🛠️"
          title="Edit & try again"
          subtitle={`Change any option for “${editTitle ?? "this video"}” — the same video gets a fresh script and render. Nothing new is created.`}
        />
      ) : (
        <PageHeader emoji="✨" title="Create a video" subtitle="Four quick steps. Claude writes the lesson, your presenter teaches it, and the studio animates and narrates everything." />
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <Stepper steps={STEPS} current={step} onGo={go} />

          <div className="card relative overflow-hidden">
            <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-brand-500/15 blur-3xl" />
            <div className="relative p-5 sm:p-8">
              <AnimatePresence mode="wait" custom={dir} initial={false}>
                <motion.div
                  key={step}
                  custom={dir}
                  initial={{ x: dir * 48, opacity: 0, filter: "blur(4px)" }}
                  animate={{ x: 0, opacity: 1, filter: "blur(0px)" }}
                  exit={{ x: -dir * 48, opacity: 0, filter: "blur(4px)" }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* ---------------------------------------------------- STEP 1: TOPIC */}
                  {step === 0 && (
                    <div className="space-y-7">
                      <div>
                        <label className="label" htmlFor="topic">
                          What&apos;s the lesson about?
                        </label>
                        <div
                          className={cx(
                            "group relative rounded-2xl p-px transition",
                            error ? "bg-red-500/60" : "bg-gradient-to-r from-white/10 via-white/10 to-white/10 focus-within:from-brand-400 focus-within:via-fuchsia-500 focus-within:to-cyan-400",
                          )}
                        >
                          <div className="flex items-center gap-3 rounded-[15px] bg-bg-elev px-4">
                            <BookOpen className="h-5 w-5 shrink-0 text-fg-subtle group-focus-within:text-brand-300" />
                            <input
                              id="topic"
                              autoFocus
                              dir="auto"
                              className="h-16 w-full bg-transparent font-display text-lg text-fg outline-none placeholder:text-fg-subtle sm:text-xl"
                              style={/[\u0600-\u06FF]/.test(topic) ? { fontFamily: URDU_FONT } : undefined}
                              placeholder="e.g. Doubles — or type it in Urdu: گناہ اور معافی"
                              value={topic}
                              maxLength={200}
                              onChange={(e) => {
                                setTopic(e.target.value);
                                if (error) setError(null);
                              }}
                              onKeyDown={(e) => e.key === "Enter" && !e.ctrlKey && !e.metaKey && go(1)}
                            />
                            <span className="hidden shrink-0 text-[11px] tabular-nums text-fg-subtle sm:block">{topic.length}/200</span>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
                          <span>Type the topic in English or Urdu.</span>
                          <button
                            type="button"
                            onClick={() => go(2)}
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 font-semibold text-fg-muted transition hover:border-white/25 hover:text-fg"
                          >
                            <Languages className="h-3.5 w-3.5" /> Language: <LanguageChip value={style?.language} className="-my-0.5" />
                            <span className="text-fg-subtle">— change in Style</span>
                          </button>
                        </div>
                        <AnimatePresence>
                          {error && (
                            <motion.p
                              initial={{ opacity: 0, y: -4, x: 0 }}
                              animate={{ opacity: 1, y: 0, x: [0, -6, 6, -4, 4, 0] }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.35 }}
                              className="mt-2 flex items-center gap-1.5 text-sm text-red-700"
                            >
                              <AlertCircle className="h-4 w-4" /> {error}
                            </motion.p>
                          )}
                        </AnimatePresence>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <span className="flex items-center gap-1 text-xs font-semibold text-fg-subtle">
                            <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Ideas
                          </span>
                          {IDEAS.map((i) => (
                            <button
                              key={i.topic}
                              type="button"
                              onClick={() => {
                                setTopic(i.topic);
                                setSubject(i.subject);
                                setAge(i.age);
                                setError(null);
                              }}
                              className="rounded-full border border-amber-400/20 bg-amber-400/[0.08] px-3 py-1 text-xs font-semibold text-amber-200 transition hover:-translate-y-0.5 hover:border-amber-300/50 hover:bg-amber-400/15"
                            >
                              {i.topic}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-6 lg:grid-cols-2">
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
                      </div>

                      <div>
                        <label className="label" htmlFor="details">
                          Learning goals &amp; extra details <span className="normal-case tracking-normal text-fg-subtle">(optional)</span>
                        </label>
                        <textarea
                          id="details"
                          className="input min-h-[130px] resize-y leading-relaxed"
                          placeholder={"e.g. Cover exercises 5–16 from the pages. Include doubles plus one (3+3+1). Use the fish tank example. Mention a Seerah story about sharing equally."}
                          value={details}
                          maxLength={6000}
                          onChange={(e) => setDetails(e.target.value)}
                        />
                        <div className="mt-1 flex justify-between gap-4">
                          <p className="hint">Paste any exact Arabic ayah or dua here if you want it on screen — the studio never invents Arabic text.</p>
                          <span className="hint shrink-0 tabular-nums">{details.length}/6000</span>
                        </div>
                      </div>

                      <div>
                        <span className="label">
                          Textbook pages <span className="normal-case tracking-normal text-fg-subtle">(optional)</span>
                        </span>
                        <ImageUploader
                          value={images}
                          onChange={(v) => {
                            setImages(v);
                            if (v.length) setError(null);
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* ---------------------------------------------------- STEP 2: FORMAT */}
                  {step === 1 && <FormatPicker value={fmt} onChange={setFmt} speed={style?.speed} />}

                  {/* ---------------------------------------------------- STEP 3: STYLE */}
                  {step === 2 && style && <StylePanel value={style} onChange={setStyle} />}

                  {/* ---------------------------------------------------- STEP 4: GENERATE */}
                  {step === 3 && style && (
                    <div className="space-y-5">
                      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-brand-500/20 via-fuchsia-500/10 to-cyan-400/10 p-6">
                        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full blur-3xl" style={{ background: `${presenter.color}44` }} />
                        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
                          {style.style === "explainer" ? (
                            <div className="grid h-32 w-32 shrink-0 place-items-center rounded-3xl border border-cyan-300/30 bg-cyan-400/10 text-5xl">🔬</div>
                          ) : presenter.id !== "none" ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={presenter.img} alt={presenter.name} className="h-32 w-32 shrink-0 animate-floaty object-contain drop-shadow-[0_18px_30px_rgba(0,0,0,0.6)]" />
                          ) : (
                            <div className="grid h-32 w-32 shrink-0 place-items-center rounded-3xl border border-white/10 bg-white/[0.04] text-5xl">🎙️</div>
                          )}
                          <div className="min-w-0">
                            <div className="eyebrow">{editId ? "Ready to try again" : "Ready to create"}</div>
                            <h2
                              dir="auto"
                              className="mt-3 font-display text-2xl font-semibold leading-tight text-fg sm:text-3xl"
                              style={/[\u0600-\u06FF]/.test(topic) ? { fontFamily: URDU_FONT, lineHeight: 1.9 } : undefined}
                            >
                              {topic.trim() || "Lesson from your textbook pages"}
                            </h2>
                            <p className="mt-2 text-sm text-fg-muted">
                              {style.style === "explainer" ? "Diagram explainer narrated by" : presenter.id === "none" ? "Narrated by" : `${presenter.short} presents with`} the <b className="text-fg">{voice?.name}</b> voice ·{" "}
                              {music?.name.toLowerCase()} · {fmt.format === "short" ? "vertical Short" : "landscape video"} · in <b className="text-fg">{lang?.name}</b>
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-5">
                        {[
                          { k: "Language", v: urdu ? "🌐 Urdu · اردو" : "🌐 English" },
                          { k: "Subject", v: `${SUBJECTS.find((s) => s.id === subject)?.emoji ?? ""} ${subject}` },
                          { k: "Age", v: AGE_GROUPS.find((a) => a.id === age)?.label ?? age },
                          { k: "Format", v: fmt.format === "short" ? "📱 Short" : "🖥️ Long" },
                          { k: "Length", v: `${durationLabel(fmt).replace(" video", "")} · ${fmtDuration(fmt.target_seconds)}` },
                        ].map((x) => (
                          <div key={x.k} className="panel p-4">
                            <div className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">{x.k}</div>
                            <div className="mt-1 truncate font-display text-[15px] font-semibold text-fg">{x.v}</div>
                          </div>
                        ))}
                      </div>

                      <div className="panel p-4">
                        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">Style</div>
                        <StyleSummary value={style} />
                        {images.length > 0 && <p className="mt-3 text-xs text-fg-muted">🖼️ {images.length} textbook page{images.length === 1 ? "" : "s"} attached — Claude will follow them.</p>}
                      </div>

                      <button
                        type="button"
                        onClick={() => setReview(!review)}
                        role="switch"
                        aria-checked={review}
                        className={cx(
                          "flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition",
                          review ? "border-brand-400/40 bg-brand-500/[0.1]" : "border-white/[0.08] bg-white/[0.03] hover:border-white/20",
                        )}
                      >
                        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[0.06] text-xl">👀</span>
                        <span className="flex-1">
                          <span className="block text-sm font-semibold text-fg">Review the script before rendering</span>
                          <span className="block text-xs text-fg-subtle">
                            {review ? "Recommended — check facts and edit scenes, then press Approve & render." : "Fully automatic — the video renders as soon as the script is written."}
                          </span>
                        </span>
                        <Switch checked={review} />
                      </button>

                      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-black/25 p-6 text-center">
                        <div className="pointer-events-none absolute inset-x-0 -bottom-24 mx-auto h-48 w-2/3 rounded-full bg-fuchsia-500/25 blur-3xl" />
                        <p className="relative text-sm text-fg-muted">
                          Script ≈ {fmt.format === "short" ? "20–40 s" : fmt.target_seconds > 360 ? "1–3 min" : "40–90 s"} · Rendering ≈{" "}
                          {fmt.format === "short" ? "1–3" : Math.max(3, Math.round(fmt.target_seconds / 60))} min on a render machine
                        </p>
                        <Button
                          size="lg"
                          className="relative mt-5 min-w-[260px] text-lg"
                          loading={busy}
                          icon={editId ? <RefreshCw className="h-5 w-5" /> : <Wand2 className="h-5 w-5" />}
                          onClick={generate}
                        >
                          {busy ? (editId ? "Saving…" : "Starting…") : editId ? "Save changes & try again" : "Generate my video"}
                        </Button>
                        {editId && (
                          <p className="relative mt-2 text-[11px] text-fg-subtle">The old script and video files of this video are replaced.</p>
                        )}
                        <p className="relative mt-3 text-[11px] text-fg-subtle">
                          or press <kbd className="rounded-md border border-white/15 bg-white/[0.06] px-1.5 py-0.5 font-sans">{isMac ? "⌘" : "Ctrl"}</kbd> +{" "}
                          <kbd className="rounded-md border border-white/15 bg-white/[0.06] px-1.5 py-0.5 font-sans">Enter</kbd>
                        </p>
                      </div>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="relative flex items-center justify-between gap-3 border-t border-white/[0.07] bg-black/20 px-5 py-4 sm:px-8">
              <Button variant="ghost" icon={<ArrowLeft className="h-4 w-4" />} onClick={() => go(step - 1)} disabled={step === 0}>
                Back
              </Button>
              <span className="hidden text-xs text-fg-subtle sm:block">
                Step {step + 1} of {STEPS.length} · <kbd className="rounded border border-white/10 px-1">{isMac ? "⌘" : "Ctrl"}</kbd>+
                <kbd className="rounded border border-white/10 px-1">Enter</kbd> to continue
              </span>
              {step < STEPS.length - 1 ? (
                <Button onClick={() => go(step + 1)}>
                  {step === 2 ? "Review" : "Continue"} <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button variant="secondary" loading={busy} icon={editId ? <RefreshCw className="h-4 w-4" /> : <Rocket className="h-4 w-4" />} onClick={generate}>
                  {editId ? "Save & try again" : "Generate"}
                </Button>
              )}
            </div>
          </div>
        </div>

        <aside className="hidden xl:block">
          <div className="sticky top-8">
            <LiveSummary topic={topic} subject={subject} age={age} images={images.length} fmt={fmt} style={style} />
          </div>
        </aside>
      </div>
    </div>
  );
}
