import { generateObject, gateway, type ModelMessage } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { characterById } from "./constants";
import {
  EXPLAINER_ACTIONS,
  YoutubeSchema,
  type ExplainerAction,
  type ExplainerPart,
  AiOutlineSchema,
  AiScenesSchema,
  AiScriptSchema,
  SceneSchema,
  planShell,
  sanitizePlan,
  suggestedSceneCount,
  targetWords,
  type Scene,
  type VideoPlan,
  type YoutubeMeta,
} from "./plan";
import { TWEMOJI_CREDIT } from "./constants";
import type { VideoRow } from "./db";
import { STAGE_DIMS, sanitizeExplainer, sanitizeStage } from "./explainer";
import { EXPLAINER_EXAMPLE_JSON } from "./explainer-example";

const AGE_GUIDE: Record<string, string> = {
  "4-5": "Ages 4–5: tiny words, 3–7 word sentences, lots of repetition, sing-song rhythm, count slowly, one idea per scene, constant praise.",
  "6-7": "Ages 6–7: very simple words, short sentences (max ~12 words), concrete examples kids can see and count, repeat the key idea 2–3 times, ask them to say answers out loud, lots of praise.",
  "8-9": "Ages 8–9: simple but richer vocabulary, explain 'why', real-world examples, a little challenge, quick checks for understanding.",
  "10-12": "Ages 10–12: clear explanations with reasoning, correct terminology (define it), real-world applications, a thinking question, light critical thinking.",
};

const SCENE_GUIDE = `
SCENE TYPES (use the exact field names; every scene has "beats": [{ "say": "...", "pause"?: seconds }]).
Visual elements may have "at": beat index (0-based, within that scene) when they appear, and optional "word": a word from that beat's text to sync with.
- title: { title, subtitle?, emojis: [1-4 emoji] } — opening. If greeting is allowed, beat 0 says "Assalamu alaikum, ..." .
- concept: { heading, emoji, points: [{ text (≤8 words), at }] (≤4) } — explain an idea; reveal points as they are spoken.
- objects: { heading, groups: [{ emoji, count (1-20), label?, at }] (1-3), operator: "+" | "-" | "×" | "=" | null, equation?: { text: "5 + 5 = 10", at }, count_beats?: { start, step } } — groups of emoji objects to count. For counting aloud, add one beat per number ("One.", "Two.", …) and set count_beats.start to the first counting beat index (step 1 one-by-one, step 2 count in pairs: beats "Two.", "Four.", …).
- equation: { heading, a, op: "+"|"-"|"×"|"÷", b, answer, layout: "vertical"|"horizontal", show_at, answer_at, answer_word?, emoji? } — textbook-style problem; vertical looks like the workbook. emoji shows helper objects when numbers ≤ 10.
- quiz: { question, kind: "choice"|"number", options?: [2-4 short strings], correct: index (choice) or answer string (number), think_seconds: 3 } — EXACTLY 2 beats: [ask the question and invite kids to answer out loud, reveal + praise]. The engine adds a 3-second countdown between them.
- steps: { heading, steps: [{ emoji, text (≤6 words), at }] (2-5) } — sequences, cycles, how-to.
- compare: { heading, left: { title, emoji, items: [{ emoji, text?, at }] }, right: {…} } — sorting / contrasting.
- story: { heading, characters: [{ emoji, name, side: "left"|"right"|"center" }] (≤3), props: [{ emoji, count, at }] (≤3), equation?: { text, at } } — word problems and little stories (use the textbook's names).
- fact: { heading: "Did you know?", emoji, text (≤20 words) } — one surprising true fact.
- islamic: { heading, kind: "ayah"|"hadith"|"seerah"|"dua", translation, reference, emoji? } — gentle Islamic connection. NEVER write Arabic text (leave "arabic" out) unless the teacher pasted the exact Arabic in the details. Only quote ayahs/hadith you are certain of, with an exact reference (e.g. "Surah Al-Baqarah 2:286", "Sahih al-Bukhari 6018"); otherwise prefer a well-known Seerah story told simply with reference "Seerah".
- recap: { heading, points: [{ text, at }] (2-5) } — summary.
- outro: { title ("Great job, stars!"), subtitle? } — goodbye; if subscribe is allowed, kindly ask to like and subscribe; if greeting allowed you may end with "Allah Hafiz!".
Single emoji characters only (e.g. "🍎", not ":apple:"). Headings ≤ 40 characters (Shorts ≤ 28).`;

function presenterLine(id: string | undefined) {
  if (id === "none")
    return `There is NO on-screen character in this video: narrate as a warm, friendly teacher in the first person ("Let's learn…"), never introduce yourself by name and never mention a mascot or presenter.`;
  const c = characterById(id);
  return `The on-screen presenter is ${c.name} (${c.desc.toLowerCase()}). The narrator speaks AS ${c.short}: introduce yourself once in the opening ("I'm ${c.short}!") and stay in character; never mention any other mascot.`;
}

function systemPrompt(presenter?: string) {
  return `You are the head scriptwriter for a family-friendly educational YouTube channel (with Islamic values) that makes animated learning videos for children. Only mention the channel by the CHANNEL name given in the brief, and only where it is natural (e.g. the subscribe line). You write a structured VideoPlan that an animation engine turns into a narrated cartoon (an animated presenter character, emoji visuals, captions).
PRESENTER: ${presenterLine(presenter)}

QUALITY RULES
- Teach like the best primary teacher: hook → explain with concrete visuals → worked examples → practice with "say it out loud!" → recap → warm goodbye.
- Everything must be factually correct and reflect current scientific understanding (no outdated textbook claims — e.g. Pluto is a dwarf planet, the tongue has no separate "taste zones"). Keep it simple but true.
- Maths must be exactly right. Double-check every sum, every equation, every quiz answer, and make the narration say the same numbers that are shown.
- Spoken text is read by a text-to-speech voice: write numbers as words in "say" when they are spoken ("seven plus seven equals fourteen"), avoid symbols, abbreviations, emojis and brackets in "say". Use short natural sentences with exclamation marks for energy.
- Keep each beat to one or two short sentences. Visual elements appear on the beat that mentions them.
- Islamic touches should be natural and respectful (e.g. Bismillah before starting, thanking Allah for His creation, a related Seerah moment), never forced; no music references.
- Never mention that you are an AI. Never include URLs.
- Follow the uploaded textbook page photos closely when provided: same exercises, numbers, names and order, but explained in more detail.

YOUTUBE METADATA
- title: catchy, clear, ≤ 70 characters, includes the topic and age (e.g. "Doubles for Kids | Learn to Add Doubles | Math for Grade 1").
- description: 3 short paragraphs (what kids learn, how to use the video, a call to subscribe) plus a list of key moments. No links.
- tags: 10–15 search tags. hashtags: 3–5 including #Shorts for Shorts.
${SCENE_GUIDE}`;
}

interface GenInput {
  topic: string;
  subject: string;
  age_group: string;
  details: string;
  format: "long" | "short";
  target_seconds: number;
  speed: number;
  greeting: boolean;
  subscribe: boolean;
  channel: string;
  presenter: string;
  image_urls: string[];
  language: "en" | "ur";
}

/** Spoken-word budget: Urdu narration runs at about 2.3 words a second at the default speed. */
function spokenWords(g: Pick<GenInput, "language" | "speed">, seconds: number) {
  return g.language === "ur" ? Math.round(seconds * 2.3 * (g.speed / 0.92)) : targetWords(seconds, g.speed);
}

const URDU_RULES = `
LANGUAGE: URDU (this overrides any English wording rules above)
- The whole video is in URDU, written in Urdu script (Nastaliq-friendly). Never Roman Urdu, never Hindi/Devanagari, no English words except unavoidable names.
- In Urdu: every beat "say" and "caption", every step "title", "highlight", "tag", every label "text", any word drawn in the SVG, and the YouTube title, description, tags and hashtags.
- "highlight" must be exact word(s) copied from that step's Urdu title. Every "word" timing key must be an exact substring of that beat's Urdu "say".
- Step tags: "مرحلہ ۱ از ۴", "مرحلہ ۲ از ۴" … with Urdu digits (۰۱۲۳۴۵۶۷۸۹). Use Urdu digits for any number shown on screen (titles, labels, captions, references). In "say" write numbers as Urdu words (e.g. دو، تین، دس).
- Punctuation: ۔ for full stops, ، for commas, ؟ for questions, ! is fine.
- The Prophet's name: in "say" always write صلی اللہ علیہ وسلم in full; ﷺ may appear only in a "caption".
- References in captions in Urdu: (بخاری) (مسلم) (ترمذی) (الزمر: ۵۳). Only references you are certain of, same accuracy rules as always.
- Greeting (if allowed): "السلام علیکم!" once at the very start. Subscribe line (if allowed): one short Urdu sentence.
- Simple, warm, natural Pakistani Urdu for children: short sentences (6–12 words), everyday words (پانی، دل، گلاس، امی ابو) rather than heavy Persian/Arabic vocabulary; talk to the child ("دیکھیں!"، "کیا آپ جانتے ہیں؟").
- Labels: 1–3 Urdu words (no UPPERCASE in Urdu). Captions are written right-to-left by the engine automatically.
- SVG: still avoid text in the drawing. If a word is essential on an object (a label on a jar), use <text … font-family="Noto Nastaliq Urdu, Fredoka" direction="rtl" text-anchor="middle"> with Urdu text.
- URDU STYLE SAMPLE (beats from a finished video, for tone only):
  {"tag":"مرحلہ ۲ از ۴","title":"پھر گناہ آتے ہیں","highlight":"گناہ","beats":[{"say":"لیکن پھر ہم غلطیاں کرتے ہیں۔ جیسے جھوٹ بولنا،","actions":[{"do":"label","id":"s1","text":"جھوٹ","point":[540,900],"side":"left","len":120,"dy":-40,"word":"جھوٹ"}]},{"say":"نبی صلی اللہ علیہ وسلم نے فرمایا کہ گناہ سے دل پر ایک کالا نشان پڑ جاتا ہے۔","caption":"گناہ سے دل پر کالا نشان پڑ جاتا ہے۔ (ترمذی)","actions":[{"do":"pulse","point":[540,1080],"r":70,"word":"کالا"}]}]}`;


function briefText(g: GenInput, extra = "") {
  const words = targetWords(g.target_seconds, g.speed);
  const scenes = suggestedSceneCount(g.target_seconds, g.format);
  const fmt =
    g.format === "short"
      ? `YouTube SHORT (vertical). Target length ${g.target_seconds} seconds — this is strict. Structure: 1 hook scene (title) that grabs attention in the first 2 seconds, then 2–5 fast teaching scenes, then a quick quiz or recap, then a very short outro. No long greetings.`
      : `LONG video (landscape). Target length about ${Math.round(g.target_seconds / 60)} minutes. Structure: title intro, several teaching scenes with worked examples, a practice section with 3+ quiz scenes, recap, outro.`;
  return `Write the VideoPlan for this video.

TOPIC: ${g.topic}
SUBJECT: ${g.subject}
AUDIENCE: ${AGE_GUIDE[g.age_group] ?? AGE_GUIDE["6-7"]}
FORMAT: ${fmt}
LENGTH TARGET: about ${words} spoken words in total across all beats (±10%), roughly ${scenes} scenes. Quiz countdowns add ~3 s each.
CHANNEL: ${g.channel}. Islamic greeting allowed: ${g.greeting ? "yes" : "no"}. Like & subscribe in outro: ${g.subscribe ? "yes" : "no"}.
${g.details ? `TEACHER'S DETAILS / LEARNING GOALS:\n${g.details}\n` : ""}${g.image_urls.length ? `${g.image_urls.length} textbook page photo(s) are attached — base the lesson on them.\n` : ""}${extra}`;
}

function userMessage(g: GenInput, text: string): ModelMessage[] {
  const content: Array<{ type: "text"; text: string } | { type: "image"; image: URL }> = [{ type: "text", text }];
  for (const u of g.image_urls.slice(0, 8)) {
    try {
      content.push({ type: "image", image: new URL(u) });
    } catch {
      /* skip bad url */
    }
  }
  return [{ role: "user", content }];
}

/**
 * Default: Vercel AI Gateway (OIDC on Vercel, needs a card / credits on the Vercel team).
 * If ANTHROPIC_API_KEY is set, talk to Anthropic directly instead (pay-as-you-go on console.anthropic.com).
 */
function model(id: string) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (key) {
    const direct = id.replace(/^anthropic\//, "").replace(/\./g, "-");
    return createAnthropic({ apiKey: key })(direct);
  }
  return gateway(id);
}

function finishYoutube(y: YoutubeMeta, format: "long" | "short"): YoutubeMeta {
  let hashtags = (y.hashtags ?? []).map((h) => (h.startsWith("#") ? h : `#${h}`).replace(/\s+/g, ""));
  if (format === "short" && !hashtags.some((h) => h.toLowerCase() === "#shorts")) hashtags = ["#Shorts", ...hashtags];
  let description = (y.description ?? "").trim();
  if (!description.includes("Twemoji")) description += `\n\n${TWEMOJI_CREDIT}`;
  return {
    title: (y.title ?? "").slice(0, 100),
    description,
    tags: (y.tags ?? []).map((t) => t.replace(/^#/, "").trim()).filter(Boolean).slice(0, 20),
    hashtags: hashtags.slice(0, 6),
  };
}

export function genInputFromVideo(v: VideoRow): GenInput {
  return {
    topic: v.topic,
    subject: v.subject,
    age_group: v.age_group,
    details: v.details,
    format: v.format,
    target_seconds: v.target_seconds,
    speed: v.settings.speed ?? 0.92,
    greeting: v.settings.greeting ?? true,
    subscribe: v.settings.subscribe ?? true,
    channel: v.settings.channel ?? "AI_LEARNING_VIDEO_GENERATION_BY_HAMAS",
    presenter: v.settings.presenter ?? (v.settings.mascot === false ? "none" : "ollie"),
    image_urls: v.image_urls ?? [],
    language: v.settings.language === "ur" ? "ur" : "en",
  };
}

const TIMEOUT = 280_000;

/** Generate a full script for a video row. */
export async function generateScript(
  v: VideoRow,
  modelId: string,
  onProgress?: (msg: string) => Promise<void>,
): Promise<{ plan: VideoPlan; youtube: YoutubeMeta; warnings: string[] }> {
  // Urdu videos are always made in the diagram style (the character scenes are English-only).
  if (v.settings?.style === "explainer" || v.settings?.language === "ur") return generateExplainer(v, modelId, onProgress);
  const g = genInputFromVideo(v);
  let title: string;
  let scenes: Scene[];
  let youtube: YoutubeMeta;

  if (g.format === "long" && g.target_seconds > 360) {
    await onProgress?.("Planning the lesson outline…");
    const outline = await generateObject({
      model: model(modelId),
      schema: AiOutlineSchema,
      instructions: systemPrompt(g.presenter),
      messages: userMessage(
        g,
        briefText(
          g,
          `\nFIRST produce only an OUTLINE: 3–6 consecutive parts whose seconds add up to ${g.target_seconds}. Part 1 starts with the title scene; the last part ends with recap and outro. Each part's goal must be specific (which examples, numbers, stories).`,
        ),
      ),
      maxOutputTokens: 4000,
      abortSignal: AbortSignal.timeout(90_000),
      maxRetries: 2,
    });
    const parts = outline.object.parts.slice(0, 6);
    await onProgress?.(`Writing ${parts.length} parts in parallel…`);
    const outlineText = parts.map((p, i) => `${i + 1}. ${p.name} (${p.seconds}s): ${p.goal}`).join("\n");
    const results = await Promise.all(
      parts.map((p, i) =>
        generateObject({
          model: model(modelId),
          schema: AiScenesSchema,
          instructions: systemPrompt(g.presenter),
          messages: userMessage(
            g,
            briefText(
              g,
              `\nThe full video outline is:\n${outlineText}\n\nNOW WRITE ONLY PART ${i + 1} ("${p.name}"): ${p.goal}\nThis part must last about ${p.seconds} seconds ≈ ${targetWords(p.seconds, g.speed)} spoken words. Suggested scene types: ${p.scene_types.join(", ")}.${
                i === 0 ? " This is the FIRST part: begin with the title scene." : " Do NOT add a title scene or greeting."
              }${i === parts.length - 1 ? " This is the LAST part: end with a recap scene and an outro scene." : " Do NOT add recap or outro scenes."} Continue naturally from the previous part.`,
            ),
          ),
          maxOutputTokens: 12000,
          abortSignal: AbortSignal.timeout(TIMEOUT - 100_000),
          maxRetries: 1,
        }),
      ),
    );
    title = outline.object.title;
    youtube = outline.object.youtube;
    scenes = results.flatMap((r) => r.object.scenes);
  } else {
    await onProgress?.("Writing the script…");
    const res = await generateObject({
      model: model(modelId),
      schema: AiScriptSchema,
      instructions: systemPrompt(g.presenter),
      messages: userMessage(g, briefText(g)),
      maxOutputTokens: g.format === "short" ? 6000 : 16000,
      abortSignal: AbortSignal.timeout(TIMEOUT),
      maxRetries: 2,
    });
    title = res.object.title;
    youtube = res.object.youtube;
    scenes = res.object.scenes;
  }

  const shell = planShell({
    title,
    format: g.format,
    target_seconds: g.target_seconds,
    age_group: g.age_group,
    settings: v.settings,
    scenes,
  });
  const { plan, warnings } = sanitizePlan(shell, { userText: v.details });
  return { plan, youtube: finishYoutube(youtube, g.format), warnings };
}

/** Rewrite a single scene, keeping the rest of the plan as context. */
export async function regenerateScene(
  v: VideoRow,
  plan: VideoPlan,
  index: number,
  instruction: string,
  modelId: string,
): Promise<Scene> {
  const g = genInputFromVideo(v);
  const ctx = plan.scenes
    .map((s, i) => `${i + 1}. [${s.type}] ${s.beats.map((b) => b.say).join(" ")}`.slice(0, 400))
    .join("\n");
  const cur = plan.scenes[index];
  const res = await generateObject({
    model: model(modelId),
    schema: z.object({ scene: SceneSchema }),
    instructions: systemPrompt(g.presenter),
    messages: userMessage(
      g,
      briefText(
        g,
        `\nThe current script (scene summaries):\n${ctx}\n\nREWRITE ONLY SCENE ${index + 1}. Current scene JSON:\n${JSON.stringify(cur)}\n\nTeacher's request for this scene: ${
          instruction || "Make it clearer, more fun and more visual."
        }\nKeep it about the same length and keep it consistent with the scenes around it. You may change the scene type if the request asks for it.`,
      ),
    ),
    maxOutputTokens: 4000,
    abortSignal: AbortSignal.timeout(120_000),
    maxRetries: 2,
  });
  const { plan: fixed } = sanitizePlan({ ...plan, scenes: [res.object.scene] }, { userText: v.details });
  return fixed.scenes[0];
}

/** Tiny connectivity test for Settings. */
export async function aiPing(modelId: string) {
  const r = await generateObject({
    model: model(modelId),
    schema: z.object({ ok: z.boolean(), joke: z.string() }),
    prompt: "Return ok=true and a one-line kid-friendly maths joke.",
    maxOutputTokens: 200,
    abortSignal: AbortSignal.timeout(60_000),
  });
  return r.object;
}

/* ------------------------------------------------------------------ */
/* Diagram explainer                                                    */
/* ------------------------------------------------------------------ */

/** AI-facing schemas: lenient (everything optional, no unions / open objects); code cleans up afterwards. */
const AiExplainerAction = z.object({
  do: z.enum(EXPLAINER_ACTIONS),
  id: z.string().optional().describe("Part id (show/hide/pop/wipe/move/scale/fill) or label id (label/unlabel, '*' = all labels)"),
  at: z.number().optional().describe("Seconds after this beat's narration starts"),
  word: z.string().optional().describe("Alternative to at: start when this exact word of the beat's 'say' is spoken"),
  dur: z.number().optional(),
  dir: z.enum(["up", "down", "left", "right"]).optional(),
  box: z.array(z.number()).nullable().optional(),
  to: z.array(z.number()).optional().describe("move: [dx, dy]"),
  factor: z.number().optional().describe("scale: size factor"),
  degrees: z.number().optional().describe("rotate: angle in degrees, clockwise"),
  origin: z.array(z.number()).optional(),
  color: z.string().optional(),
  text: z.string().optional(),
  point: z.array(z.number()).optional(),
  side: z.enum(["left", "right"]).optional(),
  len: z.number().optional(),
  dy: z.number().optional(),
  path: z.array(z.array(z.number())).optional(),
  count: z.number().optional(),
  speed: z.number().optional(),
  r: z.number().optional(),
  shape: z.enum(["dot", "steam"]).optional(),
  layer: z.string().optional(),
  sfx: z.string().optional(),
});
const AiExplainerBeat = z.object({
  say: z.string(),
  caption: z.string().optional(),
  pause: z.number().optional(),
  actions: z.array(AiExplainerAction),
});
const AiExplainerStep = z.object({
  tag: z.string().optional().describe('"Step 1 / 3" for teaching steps; leave out for the intro and recap'),
  title: z.string(),
  highlight: z.string().optional(),
  beats: z.array(AiExplainerBeat),
});
const AiExplainerPart = z.object({
  stage: z.string().describe("The complete SVG drawing (draw this FIRST)"),
  hidden: z.array(z.string()),
  camera: z.array(z.number()).nullable().optional(),
  steps: z.array(AiExplainerStep),
});
const AiExplainerTheme = z.object({
  bg: z.string().optional(),
  ink: z.string().optional(),
  label: z.string().optional(),
  accent: z.string().optional(),
});
const AiExplainerShortSchema = z.object({
  title: z.string(),
  youtube: YoutubeSchema,
  theme: AiExplainerTheme.optional(),
  part: AiExplainerPart,
});
const AiExplainerOutlineSchema = z.object({
  title: z.string(),
  youtube: YoutubeSchema,
  theme: AiExplainerTheme.optional(),
  parts: z
    .array(
      z.object({
        name: z.string(),
        object: z.string().describe("The ONE object/diagram drawn in this part, e.g. 'cutaway of the human heart'"),
        goal: z.string().describe("What this part explains, step by step"),
        seconds: z.number(),
      }),
    )
    .describe("2-6 consecutive parts covering the whole video"),
});
const AiExplainerPartOnly = z.object({ part: AiExplainerPart });

type AiPart = z.infer<typeof AiExplainerPart>;

function toExplainerPart(p: AiPart): ExplainerPart {
  return {
    stage: p.stage,
    hidden: p.hidden ?? [],
    camera: p.camera ?? null,
    steps: (p.steps ?? []).map((s) => ({
      ...(s.tag ? { tag: s.tag } : {}),
      title: s.title,
      ...(s.highlight ? { highlight: s.highlight } : {}),
      beats: (s.beats ?? []).map((b) => ({
        say: b.say,
        ...(b.caption ? { caption: b.caption } : {}),
        ...(b.pause != null ? { pause: b.pause } : {}),
        actions: (b.actions ?? []).map((a) => {
          const { factor, degrees, ...rest } = a;
          const out: Record<string, unknown> = { ...rest };
          if (a.do === "scale") out.to = factor ?? a.to?.[0];
          if (a.do === "rotate") out.to = degrees ?? a.to?.[0];
          for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
          return out as ExplainerAction;
        }),
      })),
    })),
  };
}

function explainerSystemPrompt(format: "long" | "short", language: "en" | "ur" = "en") {
  return explainerSystemPromptEn(format) + (language === "ur" ? URDU_RULES : "");
}

function explainerSystemPromptEn(format: "long" | "short") {
  const [W, H] = STAGE_DIMS[format];
  const portrait = format === "short";
  const safe = portrait
    ? "Keep everything important between y≈420 and y≈1600 (the step title covers the top ~22% of the screen and captions the bottom ~20%). Horizontally keep it within x≈60–1020."
    : "Keep everything important between y≈230 and y≈880 (the step title covers the top of the screen and captions the bottom). Horizontally keep it within x≈80–1840.";
  return `You are the head scriptwriter AND illustrator for a family-friendly educational YouTube channel (with Islamic values) that makes animated learning videos for children. Only mention the channel by the CHANNEL name given in the brief, and only where natural.

This video uses the DIAGRAM EXPLAINER style: no cartoon presenter. A warm teacher's voice narrates while ONE illustrated object (per part) stays on screen and changes step by step to show HOW IT WORKS — like a top-quality animated textbook infographic. You produce the SVG drawing AND the timed animation script that an engine renders.

VISUAL STYLE
- Flat, clean, illustrated cross-section / cutaway diagram (e.g. a tooth cut in half, a plant with soil cut away, a heart opened up, a volcano sliced, a bicycle gear system). Show the INSIDE so kids can see how it works.
- Calm muted background (light grey-blue sky like #EEF2F4, soft ground/surroundings), bright but harmonious colours for the object, dark outlines 4–6 px (stroke-linejoin round), simple gradients allowed. No text inside the SVG (the engine draws titles and labels).
- Draw the object LARGE and centred. ${safe}
- Extend background rectangles well beyond the viewBox (e.g. x=-600, width +1200) so camera zooms never reveal empty edges.

SVG RULES (the engine parses it with a strict XML parser)
- Root: <svg viewBox="0 0 ${W} ${H}"> (${portrait ? "portrait 9:16" : "landscape 16:9"}). Well-formed XML: every tag closed, attributes quoted, no HTML entities.
- Only: g, path, rect, circle, ellipse, line, polyline, polygon, linearGradient, radialGradient, stop, defs, clipPath. No text, image, script, filter, foreignObject, CSS classes or <style>. Use presentation attributes (fill="#..." stroke="#..."), hex colours only.
- Every part you will animate or talk about is a <g id="kebab-case-id"> group (e.g. "roots", "root-hairs", "stem-cut", "leaf-left"). Ids are unique. Put "inside" details (tubes, chambers, layers) in their own groups so they can be revealed.
- Paint order = what is in front: later elements cover earlier ones.
- Include an empty <g id="flowlayer"/> where moving particles should appear (usually just above the object parts they move through), and reference it with "layer":"flowlayer" in flow actions.
- Keep the SVG compact (ideally under 12 KB): combine repeated small strokes into one path with many "M…L…" segments; round coordinates to whole numbers.

ANIMATION SCRIPT
parts → steps → beats. Each beat has "say" (narration, 1–2 short sentences) and "actions" that happen while it is spoken.
- Step "title": big header (≤ 30 characters), "highlight": the key word(s) of the title to colour. "tag": "Step 1 / N" for teaching steps; NO tag for the opening question and the final recap.
- Timing: "word": an exact word from that beat's "say" (the action starts when it's spoken), or "at": seconds after the beat starts. "dur": animation seconds (default 0.6).
- "hidden": ids invisible at the start; reveal them later with show / pop / wipe. Hide parts that will be revealed as the explanation goes on (that is what makes it engaging).
- "camera" (part level): starting view [x, y, width] or null for the whole stage.
ACTIONS ("do"):
- show {id}: fade in (slight rise). hide {id}: fade out.
- pop {id, origin:[x,y]}: grow from the origin point with a bounce.
- wipe {id, dir, box:[x,y,w,h]}: reveal the part progressively as if it grows: dir "down" reveals top→bottom (roots growing), "up" bottom→top (a stem, water level rising), "right" left→right, "left" right→left. box = the area the part covers.
- move {id, to:[dx,dy]}: slide the part to an offset from where it was drawn (stays there). Use it for tools, pistons, valves, a moving moon, etc.
- scale {id, factor, origin:[x,y]}: grow/shrink (e.g. a muscle contracting, a balloon inflating).
- rotate {id, degrees, origin:[x,y]}: tilt/turn a part around a point, clockwise; animate back with degrees 0 (e.g. a jug pouring, a lever, a wheel, a door). Combine with move to lift while tilting.
- fill {id, color}: smoothly recolour the part (e.g. blood turning from blue to red, a leaf turning yellow, metal heating up).
- camera {box:[x,y,width]} zooms to that region (height follows the frame shape: height = width × ${portrait ? "1.78" : "0.5625"}), box null = whole stage. The explained part must sit in the MIDDLE of the box (between 22% and 80% of the box height from its top), because the title and captions cover the top and bottom. Zoom in to show detail, zoom out to show the whole. Move the camera at most once per beat; dur 1.2–1.6.
- label {id:"l-name", text, point:[x,y], side:"left"|"right", len, dy}: a small UPPERCASE label (1–3 words) with a leader line from point (stage coordinates, ON the part) to the text; len = line length and dy = vertical offset, both in SCREEN pixels (the screen is ${W} px wide). Make sure the text (~20 px per letter) stays on screen at the current camera. Max 3 labels at once.
- unlabel {id} (or id "*" for all): remove labels — always before the camera moves away from them.
- flow {path:[[x,y],…], count, speed, dur, r, color, shape:"dot"|"steam", layer:"flowlayer"}: particles travel along the polyline path (stage coordinates) — water, blood, air, food, electricity, heat, light. speed = seconds for one particle to travel the whole path; count = particles on the path at once; dur = how long new particles keep coming (use a long dur like 30 for a continuous flow). Paths must follow the drawn channels exactly (through the tube, artery, wire…). "steam" = rising wavy puffs (vapour, smell, heat).
- pulse {point:[x,y], r, color}: rings that draw attention to a spot.
- Optional "sfx" on any action: pop | whoosh | sparkle | ding | plop.
Every coordinate (label points, flow paths, camera boxes, wipe boxes, origins) MUST match where you actually drew things.

TEACHING RULES
- Structure per video: opening question/hook step (no tag) → 2–5 tagged steps that build the explanation in order → a short recap step (no tag) that names the parts again.
- Everything must be factually correct and reflect current scientific understanding (no outdated textbook claims). Simplify for the age, but never say something false.
- "say" is read by a text-to-speech voice: write numbers as words, no symbols, abbreviations, emojis or brackets. Short natural sentences with energy. Talk to the child ("Look!", "Can you see…?").
- Each important new part gets revealed, labelled and/or animated exactly when it is mentioned.
- Islamic touches must be natural and brief (e.g. "SubhanAllah, look how Allah designed…" or one well-known ayah with exact reference in the caption, only if you are certain of it). Never write Arabic script. No music references.
- Never mention that you are an AI. No URLs.
- Follow attached textbook photos closely when provided.

YOUTUBE METADATA
- title: catchy, clear, ≤ 70 characters, includes the topic and age.
- description: 3 short paragraphs + key moments. No links. tags: 10–15. hashtags: 3–5 (${portrait ? "include #Shorts" : "no #Shorts"}).

EXAMPLE (a portrait Short; the drawing is simplified here — yours should be at least as rich, with the same care for matching coordinates):
${EXPLAINER_EXAMPLE_JSON}`;
}

function explainerBrief(g: GenInput, extra = "") {
  const words = spokenWords(g, g.target_seconds);
  const ur = g.language === "ur";
  const fmt =
    g.format === "short"
      ? `YouTube SHORT (vertical ${STAGE_DIMS.short.join("×")}). Target length ${g.target_seconds} seconds — strict. ONE object/diagram, 3–6 steps in total including the opening and recap. Hook in the first 2 seconds.`
      : `LONG video (landscape ${STAGE_DIMS.long.join("×")}). Target length about ${Math.round(g.target_seconds / 60)} minutes, split into parts — each part has its own object/diagram.`;
  return `Write the diagram-explainer video.

TOPIC: ${g.topic}
SUBJECT: ${g.subject}
AUDIENCE: ${AGE_GUIDE[g.age_group] ?? AGE_GUIDE["6-7"]}
FORMAT: ${fmt}
LENGTH TARGET: about ${words} spoken words in total across all beats (±10%).
CHANNEL: ${g.channel}. Islamic greeting allowed: ${g.greeting ? (ur ? "yes (one short 'السلام علیکم!' at the very start)" : "yes (one short 'Assalamu alaikum' at the very start)") : "no"}. Ask to like & subscribe at the end: ${g.subscribe ? (ur ? "yes, one short Urdu sentence" : "yes, one short sentence") : "no"}.
${ur ? "LANGUAGE: URDU — write everything the viewer hears or reads in Urdu script (see the Urdu rules). The topic/details below may be in English; teach them in Urdu.\n" : ""}${g.details ? `TEACHER'S DETAILS / LEARNING GOALS:\n${g.details}\n` : ""}${g.image_urls.length ? `${g.image_urls.length} textbook page photo(s) are attached — base the lesson on them.\n` : ""}${extra}`;
}

/** Generate one part; if the drawing is unusable, try once more with the error (within the same time budget). */
async function explainerPartWithRetry<T extends { part: AiPart }>(
  run: (fix: string, timeoutMs: number) => Promise<T>,
  format: "long" | "short",
  label: string,
  budgetMs: number,
): Promise<T> {
  const t0 = Date.now();
  const first = await run("", budgetMs);
  try {
    sanitizeStage(first.part.stage, format, label);
    return first;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const left = budgetMs - (Date.now() - t0);
    if (left < 70_000) throw e;
    return run(`\nIMPORTANT: a previous attempt produced an unusable drawing (${msg}). Draw a valid, well-formed SVG this time.`, left);
  }
}

/** Write a diagram-explainer script (style === "explainer"). */
export async function generateExplainer(
  v: VideoRow,
  modelId: string,
  onProgress?: (msg: string) => Promise<void>,
): Promise<{ plan: VideoPlan; youtube: YoutubeMeta; warnings: string[] }> {
  const g = genInputFromVideo(v);
  // Every frame of a diagram video is drawn from vector art: keep long ones within the render time limit.
  if (g.target_seconds > 480) g.target_seconds = 480;
  const instructions = explainerSystemPrompt(g.format, g.language);
  let title: string;
  let youtube: YoutubeMeta;
  let theme: z.infer<typeof AiExplainerTheme> | undefined;
  let parts: ExplainerPart[];

  // One reply can hold one diagram plus about a minute of script. Longer videos are split into ~1-minute
  // parts (each its own diagram) that are drawn in parallel, so no reply runs past the output limit.
  const SINGLE_MAX = 75;
  const nParts = Math.max(2, Math.min(8, Math.ceil(g.target_seconds / 60)));
  if (g.target_seconds <= SINGLE_MAX) {
    await onProgress?.("Drawing the diagram and writing the script…");
    const res = await explainerPartWithRetry(
      async (fix, ms) =>
        (
          await generateObject({
            model: model(modelId),
            schema: AiExplainerShortSchema,
            instructions,
            messages: userMessage(g, explainerBrief(g, fix)),
            maxOutputTokens: 20000,
            abortSignal: AbortSignal.timeout(ms),
            maxRetries: 1,
          })
        ).object,
      g.format,
      "The drawing",
      TIMEOUT,
    );
    title = res.title;
    youtube = res.youtube;
    theme = res.theme;
    parts = [toExplainerPart(res.part)];
  } else {
    await onProgress?.("Planning the diagrams…");
    const outline = await generateObject({
      model: model(modelId),
      schema: AiExplainerOutlineSchema,
      instructions,
      messages: userMessage(
        g,
        explainerBrief(
          g,
          `\nFIRST produce only an OUTLINE: exactly ${nParts} consecutive parts (about ${Math.round(g.target_seconds / nParts)} seconds each) whose seconds add up to ${g.target_seconds}. Each part explains one thing with ONE object/diagram (a different drawing per part, or the same object at a different zoom/state). Part 1 opens with the hook; the last part ends with the recap.${
            g.format === "short"
              ? " This is still ONE vertical Short: the parts play back to back as one continuous video, so keep the pace fast and the hand-over between parts smooth (ignore the 'ONE object' rule for Shorts — use one object per part)."
              : ""
          }`,
        ),
      ),
      maxOutputTokens: 3000,
      abortSignal: AbortSignal.timeout(90_000),
      maxRetries: 2,
    });
    const plan = outline.object.parts.slice(0, 8);
    if (!plan.length) throw new Error("The AI didn't plan any parts — please press Retry.");
    title = outline.object.title;
    youtube = outline.object.youtube;
    theme = outline.object.theme;
    await onProgress?.(`Drawing ${plan.length} diagrams in parallel…`);
    const outlineText = plan.map((p, i) => `${i + 1}. ${p.name} (${Math.round(p.seconds)}s) — object: ${p.object}. ${p.goal}`).join("\n");
    const results = await Promise.all(
      plan.map((p, i) =>
        explainerPartWithRetry(
          async (fix, ms) =>
            (
              await generateObject({
                model: model(modelId),
                schema: AiExplainerPartOnly,
                instructions,
                messages: userMessage(
                  g,
                  explainerBrief(
                    g,
                    `\nThe full video outline is:\n${outlineText}\n\nNOW DRAW AND WRITE ONLY PART ${i + 1} ("${p.name}") — object: ${p.object}. ${p.goal}\nThis part lasts about ${Math.round(p.seconds)} seconds ≈ ${spokenWords(g, p.seconds)} spoken words. Number its tagged steps within this part (${g.language === "ur" ? '"مرحلہ ۱ از N" with Urdu digits' : '"Step 1 / N"'}).${
                      i === 0 ? " This is the FIRST part: start with the hook/opening step (no tag)." : " Do NOT add a greeting or a video intro; start with a short step that introduces this part's object."
                    }${i === plan.length - 1 ? " This is the LAST part: end with a recap step (no tag) covering the whole video." : " Do NOT add a final recap or goodbye."}${fix}`,
                  ),
                ),
                maxOutputTokens: 20000,
                abortSignal: AbortSignal.timeout(ms),
                maxRetries: 1,
              })
            ).object,
          g.format,
          `Diagram ${i + 1}`,
          TIMEOUT - 100_000,
        ),
      ),
    );
    parts = results.map((r) => toExplainerPart(r.part));
  }

  const { explainer, warnings } = sanitizeExplainer({ ...(theme ? { theme } : {}), parts }, g.format, { lang: g.language });
  const plan = planShell({
    title,
    format: g.format,
    target_seconds: g.target_seconds,
    age_group: g.age_group,
    settings: v.settings,
    scenes: [],
    explainer,
  });
  return { plan, youtube: finishYoutube(youtube, g.format), warnings };
}
