import { generateObject, gateway, type ModelMessage } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { z } from "zod";
import { characterById } from "./constants";
import {
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
  return `You are the head scriptwriter for "SeerahVerse Academia", an Islamic homeschooling channel that makes animated educational YouTube videos for children. You write a structured VideoPlan that an animation engine turns into a narrated cartoon (an animated presenter character, emoji visuals, captions).
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
}

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
    channel: v.settings.channel ?? "SeerahVerse Academia",
    presenter: v.settings.presenter ?? (v.settings.mascot === false ? "none" : "ollie"),
    image_urls: v.image_urls ?? [],
  };
}

const TIMEOUT = 280_000;

/** Generate a full script for a video row. */
export async function generateScript(
  v: VideoRow,
  modelId: string,
  onProgress?: (msg: string) => Promise<void>,
): Promise<{ plan: VideoPlan; youtube: YoutubeMeta; warnings: string[] }> {
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
