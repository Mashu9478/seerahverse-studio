import { PRESENTER_IDS, type PresenterId } from "./constants";
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* VideoPlan schema — mirrors CONTRACT.md §1–2                          */
/* ------------------------------------------------------------------ */

export const BeatSchema = z.object({
  say: z.string().describe("Spoken text, plain simple English"),
  caption: z.string().optional().describe("Optional different on-screen caption"),
  pause: z.number().optional().describe("Extra silence after, seconds"),
});

const at = z.number().int().optional().describe("Beat index (0-based) when this appears");
const word = z.string().optional().describe("Optional word from that beat's text to sync to");

const beats = z.array(BeatSchema).describe("Narration beats for this scene");
const bg = z.string().optional();

export const TitleScene = z.object({
  type: z.literal("title"),
  title: z.string(),
  subtitle: z.string().optional(),
  emojis: z.array(z.string()).describe("1-4 single emoji characters"),
  beats,
  bg,
});

export const PointSchema = z.object({ text: z.string(), at, word });

export const ConceptScene = z.object({
  type: z.literal("concept"),
  heading: z.string(),
  emoji: z.string(),
  points: z.array(PointSchema),
  beats,
  bg,
});

export const ObjectsScene = z.object({
  type: z.literal("objects"),
  heading: z.string(),
  groups: z.array(
    z.object({ emoji: z.string(), count: z.number().int(), label: z.string().optional(), at, word }),
  ),
  operator: z.enum(["+", "-", "×", "="]).nullable().optional(),
  equation: z.object({ text: z.string(), at, word }).optional(),
  count_beats: z.object({ start: z.number().int(), step: z.number().int() }).optional(),
  beats,
  bg,
});

export const EquationScene = z.object({
  type: z.literal("equation"),
  heading: z.string(),
  a: z.number(),
  op: z.enum(["+", "-", "×", "÷"]),
  b: z.number(),
  answer: z.number(),
  layout: z.enum(["vertical", "horizontal"]),
  show_at: z.number().int().optional(),
  answer_at: z.number().int().optional(),
  answer_word: z.string().optional(),
  emoji: z.string().optional(),
  beats,
  bg,
});

export const QuizScene = z.object({
  type: z.literal("quiz"),
  question: z.string(),
  kind: z.enum(["choice", "number"]),
  options: z.array(z.string()).optional(),
  correct: z.union([z.number(), z.string()]),
  think_seconds: z.number().optional(),
  beats: z.array(BeatSchema).describe("Exactly 2 beats: [ask, reveal]"),
  bg,
});

export const StepsScene = z.object({
  type: z.literal("steps"),
  heading: z.string(),
  steps: z.array(z.object({ emoji: z.string(), text: z.string(), at, word })),
  beats,
  bg,
});

const CompareSide = z.object({
  title: z.string(),
  emoji: z.string(),
  items: z.array(z.object({ emoji: z.string(), text: z.string().optional(), at })),
});

export const CompareScene = z.object({
  type: z.literal("compare"),
  heading: z.string(),
  left: CompareSide,
  right: CompareSide,
  beats,
  bg,
});

export const StoryScene = z.object({
  type: z.literal("story"),
  heading: z.string(),
  characters: z.array(z.object({ emoji: z.string(), name: z.string(), side: z.enum(["left", "right", "center"]) })),
  props: z.array(z.object({ emoji: z.string(), count: z.number().int(), at, word })),
  equation: z.object({ text: z.string(), at }).optional(),
  beats,
  bg,
});

export const FactScene = z.object({
  type: z.literal("fact"),
  heading: z.string(),
  emoji: z.string(),
  text: z.string(),
  beats,
  bg,
});

export const IslamicScene = z.object({
  type: z.literal("islamic"),
  heading: z.string(),
  kind: z.enum(["ayah", "hadith", "seerah", "dua"]),
  arabic: z.string().optional().describe("ONLY if the user supplied it verbatim; otherwise omit"),
  translation: z.string(),
  reference: z.string(),
  emoji: z.string().optional(),
  beats,
  bg,
});

export const RecapScene = z.object({
  type: z.literal("recap"),
  heading: z.string(),
  points: z.array(PointSchema),
  beats,
  bg,
});

export const OutroScene = z.object({
  type: z.literal("outro"),
  title: z.string(),
  subtitle: z.string().optional(),
  beats,
  bg,
});

export const SceneSchema = z.discriminatedUnion("type", [
  TitleScene,
  ConceptScene,
  ObjectsScene,
  EquationScene,
  QuizScene,
  StepsScene,
  CompareScene,
  StoryScene,
  FactScene,
  IslamicScene,
  RecapScene,
  OutroScene,
]);

export type Scene = z.infer<typeof SceneSchema>;
export type Beat = z.infer<typeof BeatSchema>;

export const BrandSchema = z.object({
  channel: z.string(),
  tagline: z.string(),
  chip: z.string().optional(),
  greeting: z.boolean(),
  subscribe: z.boolean(),
});

export const PlanSchema = z.object({
  version: z.literal(1),
  title: z.string().min(1, "Give the video a title"),
  format: z.enum(["long", "short"]),
  target_seconds: z.number().int().min(10).max(1500),
  strict_length: z.boolean(),
  voice: z.string(),
  speed: z.number().min(0.8).max(1.15),
  music: z.enum(["none", "cheerful", "calm"]),
  sfx: z.boolean(),
  mascot: z.boolean(),
  presenter: z.enum(PRESENTER_IDS).optional(),
  captions: z.boolean(),
  age_group: z.string(),
  brand: BrandSchema,
  palette: z.enum(["bright", "pastel", "ocean", "sunset", "forest", "candy"]),
  scenes: z.array(SceneSchema).min(1, "Add at least one scene"),
});

export type VideoPlan = z.infer<typeof PlanSchema>;

export const YoutubeSchema = z.object({
  title: z.string(),
  description: z.string(),
  tags: z.array(z.string()),
  hashtags: z.array(z.string()),
});
export type YoutubeMeta = z.infer<typeof YoutubeSchema>;

/** What the AI produces (settings are filled in by code). */
export const AiScriptSchema = z.object({
  title: z.string().describe("Short catchy on-screen title"),
  scenes: z.array(SceneSchema),
  youtube: YoutubeSchema,
});

export const AiScenesSchema = z.object({ scenes: z.array(SceneSchema) });

export const AiOutlineSchema = z.object({
  title: z.string(),
  youtube: YoutubeSchema,
  parts: z
    .array(
      z.object({
        name: z.string(),
        goal: z.string().describe("What this part teaches and how"),
        scene_types: z.array(z.string()),
        seconds: z.number().int(),
      }),
    )
    .describe("3-6 consecutive parts covering the whole video"),
});

/* ------------------------------------------------------------------ */
/* Settings → plan                                                      */
/* ------------------------------------------------------------------ */

export interface VideoSettings {
  voice: string;
  speed: number;
  music: "none" | "cheerful" | "calm";
  sfx: boolean;
  mascot: boolean;
  presenter: PresenterId;
  captions: boolean;
  palette: VideoPlan["palette"];
  chip: string;
  greeting: boolean;
  subscribe: boolean;
  channel: string;
  tagline: string;
}

export function planShell(input: {
  title: string;
  format: "long" | "short";
  target_seconds: number;
  age_group: string;
  settings: VideoSettings;
  scenes: Scene[];
}): VideoPlan {
  const s = input.settings;
  return {
    version: 1,
    title: input.title,
    format: input.format,
    target_seconds: input.target_seconds,
    strict_length: input.format === "short",
    voice: s.voice,
    speed: clamp(s.speed, 0.8, 1.15),
    music: s.music,
    sfx: s.sfx,
    mascot: s.presenter !== "none",
    presenter: s.presenter,
    captions: s.captions,
    age_group: input.age_group,
    brand: {
      channel: s.channel,
      tagline: s.tagline,
      chip: s.chip || undefined,
      greeting: s.greeting,
      subscribe: s.subscribe,
    },
    palette: s.palette,
    scenes: input.scenes,
  };
}

/* ------------------------------------------------------------------ */
/* Estimation                                                           */
/* ------------------------------------------------------------------ */

export function wordCount(s: string) {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

export function sceneSeconds(scene: Scene, speed = 0.92): number {
  const wps = 2.55 * speed;
  let t = 0.7 + 0.9; // lead + tail
  for (const b of scene.beats ?? []) {
    t += wordCount(b.say) / wps + 0.35 + (b.pause ?? 0);
  }
  if (scene.type === "quiz") t += scene.think_seconds ?? 3;
  return t;
}

export function planSeconds(plan: Pick<VideoPlan, "scenes" | "speed">): number {
  return plan.scenes.reduce((a, s) => a + sceneSeconds(s, plan.speed), 0);
}

export function planWords(plan: Pick<VideoPlan, "scenes">): number {
  return plan.scenes.reduce((a, s) => a + (s.beats ?? []).reduce((x, b) => x + wordCount(b.say), 0), 0);
}

/** Target number of spoken words for a duration. */
export function targetWords(seconds: number, speed: number) {
  return Math.round(seconds * 2.1 * speed);
}

export function suggestedSceneCount(seconds: number, format: "long" | "short") {
  if (format === "short") return Math.max(3, Math.min(7, Math.round(seconds / 18) + 2));
  return Math.max(5, Math.round(seconds / 25));
}

export function fmtDuration(sec: number) {
  if (!isFinite(sec) || sec <= 0) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* Sanitising + math checks                                             */
/* ------------------------------------------------------------------ */

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

const seg = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter("en", { granularity: "grapheme" }) : null;

export function firstEmoji(s: string | undefined, fallback = "⭐"): string {
  if (!s) return fallback;
  const t = s.trim();
  if (!t) return fallback;
  if (seg) {
    for (const g of seg.segment(t)) {
      if (/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(g.segment)) return g.segment;
    }
    return fallback;
  }
  return Array.from(t)[0] ?? fallback;
}

function trimText(s: string | undefined, max: number): string {
  const t = (s ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[,;:\-–]$/, "") + "…";
}

const ARABIC = /[؀-ۿ]/;

export function evalOp(a: number, op: string, b: number): number | null {
  switch (op) {
    case "+":
      return a + b;
    case "-":
    case "−":
      return a - b;
    case "×":
    case "x":
    case "*":
      return a * b;
    case "÷":
    case "/":
      return b === 0 ? null : Math.round((a / b) * 1000) / 1000;
    default:
      return null;
  }
}

const EQ_RE = /^\s*(-?\d+(?:\.\d+)?)\s*([+\-−×x*÷/])\s*(-?\d+(?:\.\d+)?)\s*=\s*(-?\d+(?:\.\d+)?|\?)\s*$/;

/** Fix "a op b = c" strings. Returns [fixedText, changed]. */
export function fixEquationText(text: string): [string, boolean] {
  const m = text.match(EQ_RE);
  if (!m) return [text, false];
  const r = evalOp(parseFloat(m[1]), m[2], parseFloat(m[3]));
  if (r === null || m[4] === "?") return [text, false];
  if (parseFloat(m[4]) === r) return [text, false];
  return [`${m[1]} ${m[2]} ${m[3]} = ${r}`, true];
}

/**
 * Normalise an AI or user plan so the engine always gets valid input.
 * Returns warnings for things a human should double-check.
 */
export function sanitizePlan(plan: VideoPlan, opts: { userText?: string } = {}): { plan: VideoPlan; warnings: string[] } {
  const warnings: string[] = [];
  const short = plan.format === "short";
  const H = short ? 28 : 40;
  const userText = opts.userText ?? "";
  const scenes: Scene[] = [];

  plan.scenes.forEach((raw, i) => {
    const sc = structuredClone(raw) as Scene;
    const n = i + 1;
    sc.beats = (sc.beats ?? [])
      .filter((b) => b && typeof b.say === "string" && b.say.trim())
      .map((b) => ({
        say: b.say.replace(/\s+/g, " ").trim(),
        ...(b.caption && b.caption.trim() && b.caption.trim() !== b.say.trim() ? { caption: b.caption.trim() } : {}),
        ...(b.pause ? { pause: clamp(Number(b.pause) || 0, 0, 4) } : {}),
      }));
    if (sc.beats.length === 0) sc.beats = [{ say: "Let's learn!" }];
    const last = sc.beats.length - 1;
    const fixAt = (v: number | undefined) => (v === undefined || v === null ? undefined : clamp(Math.round(v), 0, last));

    switch (sc.type) {
      case "title":
        sc.title = trimText(sc.title, short ? 32 : 48);
        sc.subtitle = sc.subtitle ? trimText(sc.subtitle, 60) : undefined;
        sc.emojis = (sc.emojis ?? []).map((e) => firstEmoji(e)).slice(0, 4);
        if (sc.emojis.length === 0) sc.emojis = ["⭐"];
        break;
      case "concept":
      case "recap":
        sc.heading = trimText(sc.heading, H);
        if (sc.type === "concept") sc.emoji = firstEmoji(sc.emoji, "💡");
        sc.points = (sc.points ?? []).slice(0, sc.type === "concept" ? 4 : 5).map((p) => ({
          text: trimText(p.text, 48),
          ...(fixAt(p.at) !== undefined ? { at: fixAt(p.at) } : {}),
          ...(p.word ? { word: p.word } : {}),
        }));
        break;
      case "objects": {
        sc.heading = trimText(sc.heading, H);
        sc.groups = (sc.groups ?? []).slice(0, 3).map((g) => ({
          ...g,
          emoji: firstEmoji(g.emoji, "🍎"),
          count: clamp(Math.round(g.count || 1), 1, 20),
          at: fixAt(g.at),
        }));
        if (sc.groups.length === 0) sc.groups = [{ emoji: "🍎", count: 3 }];
        if (sc.equation) {
          const [fixed, changed] = fixEquationText(sc.equation.text);
          if (changed) warnings.push(`Scene ${n}: equation "${sc.equation.text}" was corrected to "${fixed}". Check the narration matches.`);
          sc.equation = { ...sc.equation, text: fixed, at: fixAt(sc.equation.at) };
        }
        if (sc.count_beats) {
          const step = sc.count_beats.step === 2 ? 2 : 1;
          const start = clamp(Math.round(sc.count_beats.start), 0, last);
          sc.count_beats = { start, step };
        }
        if (sc.operator === undefined) sc.operator = sc.groups.length > 1 ? "+" : null;
        break;
      }
      case "equation": {
        sc.heading = trimText(sc.heading, H);
        const r = evalOp(sc.a, sc.op, sc.b);
        if (r !== null && r !== sc.answer) {
          warnings.push(`Scene ${n}: ${sc.a} ${sc.op} ${sc.b} had answer ${sc.answer}; corrected to ${r}. Check the narration.`);
          sc.answer = r;
        }
        sc.show_at = fixAt(sc.show_at);
        sc.answer_at = fixAt(sc.answer_at);
        if (sc.emoji) sc.emoji = firstEmoji(sc.emoji);
        break;
      }
      case "quiz": {
        sc.question = trimText(sc.question, short ? 60 : 80);
        if (sc.kind === "choice") {
          sc.options = (sc.options ?? []).map((o) => trimText(String(o), 28)).slice(0, 4);
          if (sc.options.length < 2) {
            sc.kind = "number";
            sc.options = undefined;
          } else {
            let idx = typeof sc.correct === "number" ? sc.correct : parseInt(String(sc.correct), 10);
            if (isNaN(idx)) idx = Math.max(0, sc.options.findIndex((o) => o === String(sc.correct)));
            sc.correct = clamp(idx, 0, sc.options.length - 1);
          }
        }
        if (sc.kind === "number") {
          sc.correct = String(sc.correct);
          const m = sc.question.match(/(-?\d+)\s*([+\-−×x*÷/])\s*(-?\d+)/);
          if (m) {
            const r = evalOp(parseFloat(m[1]), m[2], parseFloat(m[3]));
            if (r !== null && String(r) !== sc.correct && !isNaN(parseFloat(sc.correct))) {
              warnings.push(`Scene ${n}: quiz answer ${sc.correct} corrected to ${r}. Check the reveal narration.`);
              sc.correct = String(r);
            }
          }
        }
        sc.think_seconds = clamp(sc.think_seconds ?? 3, 2, 6);
        if (sc.beats.length === 1) {
          const ans = sc.kind === "choice" ? sc.options![Number(sc.correct)] : sc.correct;
          sc.beats.push({ say: `The answer is ${ans}!` });
        } else if (sc.beats.length > 2) {
          const rest = sc.beats.slice(1).map((b) => b.say).join(" ");
          sc.beats = [sc.beats[0], { say: rest }];
        }
        break;
      }
      case "steps":
        sc.heading = trimText(sc.heading, H);
        sc.steps = (sc.steps ?? []).slice(0, 5).map((s) => ({ ...s, emoji: firstEmoji(s.emoji), text: trimText(s.text, 40), at: fixAt(s.at) }));
        break;
      case "compare":
        sc.heading = trimText(sc.heading, H);
        for (const side of [sc.left, sc.right]) {
          side.title = trimText(side.title, 20);
          side.emoji = firstEmoji(side.emoji);
          side.items = (side.items ?? []).slice(0, 5).map((it) => ({
            emoji: firstEmoji(it.emoji),
            ...(it.text ? { text: trimText(it.text, 16) } : {}),
            ...(fixAt(it.at) !== undefined ? { at: fixAt(it.at) } : {}),
          }));
        }
        break;
      case "story":
        sc.heading = trimText(sc.heading, H);
        sc.characters = (sc.characters ?? []).slice(0, 3).map((c) => ({ ...c, emoji: firstEmoji(c.emoji, "🧒"), name: trimText(c.name, 14) }));
        sc.props = (sc.props ?? []).slice(0, 3).map((p) => ({ ...p, emoji: firstEmoji(p.emoji), count: clamp(Math.round(p.count || 1), 1, 20), at: fixAt(p.at) }));
        if (sc.equation) {
          const [fixed, changed] = fixEquationText(sc.equation.text);
          if (changed) warnings.push(`Scene ${n}: story equation corrected to "${fixed}". Check the narration.`);
          sc.equation = { text: fixed, at: fixAt(sc.equation.at) };
        }
        break;
      case "fact":
        sc.heading = trimText(sc.heading, H);
        sc.emoji = firstEmoji(sc.emoji, "✨");
        sc.text = trimText(sc.text, 140);
        break;
      case "islamic": {
        sc.heading = trimText(sc.heading, H);
        if (sc.emoji) sc.emoji = firstEmoji(sc.emoji, "🕌");
        if (sc.arabic && ARABIC.test(sc.arabic)) {
          const norm = (x: string) => x.replace(/[\sً-ْٰ]/g, "");
          if (!norm(userText).includes(norm(sc.arabic))) {
            warnings.push(`Scene ${n}: Arabic text was removed because it wasn't supplied by you. Paste the exact Arabic in the details if you want it shown.`);
            sc.arabic = undefined;
          }
        } else sc.arabic = undefined;
        warnings.push(`Scene ${n}: please verify the ${sc.kind} reference "${sc.reference}" and its translation before publishing.`);
        break;
      }
      case "outro":
        sc.title = trimText(sc.title, short ? 28 : 40);
        break;
    }
    // numbers spoken vs shown: check a+b=c phrases in narration
    for (const b of sc.beats) {
      const m = b.say.match(/(\d+)\s*(?:plus|\+)\s*(\d+)\s*(?:equals|is|=|makes)\s*(\d+)/i);
      if (m && parseInt(m[1]) + parseInt(m[2]) !== parseInt(m[3])) {
        warnings.push(`Scene ${n}: narration says "${m[0]}" — that maths looks wrong.`);
      }
    }
    scenes.push(sc);
  });

  return { plan: { ...plan, scenes }, warnings };
}

/** Friendly zod error text. */
export function describeIssues(err: z.ZodError): string[] {
  return err.issues.slice(0, 8).map((i) => {
    const p = i.path;
    let where = "";
    if (p[0] === "scenes" && typeof p[1] === "number") where = `Scene ${p[1] + 1}: `;
    const field = p.slice(p[0] === "scenes" ? 2 : 0).join(" › ");
    return `${where}${field ? field + " — " : ""}${i.message}`;
  });
}

/** A minimal starter scene for the editor's "Add scene". */
export function blankScene(type: Scene["type"]): Scene {
  const beats = [{ say: "Write what the narrator says here." }];
  switch (type) {
    case "title":
      return { type, title: "New Title", subtitle: "", emojis: ["⭐"], beats };
    case "concept":
      return { type, heading: "Big idea", emoji: "💡", points: [{ text: "First point", at: 0 }], beats };
    case "objects":
      return { type, heading: "Let's count", groups: [{ emoji: "🍎", count: 3, at: 0 }], operator: null, beats };
    case "equation":
      return { type, heading: "Let's solve", a: 2, op: "+", b: 2, answer: 4, layout: "vertical", show_at: 0, answer_at: 0, beats };
    case "quiz":
      return { type, question: "What is 2 + 2?", kind: "number", correct: "4", think_seconds: 3, beats: [{ say: "What is two plus two?" }, { say: "Four! Great job!" }] };
    case "steps":
      return { type, heading: "Step by step", steps: [{ emoji: "1️⃣", text: "First", at: 0 }, { emoji: "2️⃣", text: "Next", at: 0 }], beats };
    case "compare":
      return { type, heading: "Sort them!", left: { title: "Group A", emoji: "🅰️", items: [] }, right: { title: "Group B", emoji: "🅱️", items: [] }, beats };
    case "story":
      return { type, heading: "Story time", characters: [{ emoji: "👧", name: "Amna", side: "left" }], props: [], beats };
    case "fact":
      return { type, heading: "Did you know?", emoji: "✨", text: "An amazing fact.", beats };
    case "islamic":
      return { type, heading: "From the Seerah", kind: "seerah", translation: "", reference: "", emoji: "🕌", beats };
    case "recap":
      return { type, heading: "What we learned", points: [{ text: "Point one", at: 0 }], beats };
    case "outro":
      return { type, title: "Great job, stars!", subtitle: "", beats: [{ say: "Great job! See you next time." }] };
  }
}
