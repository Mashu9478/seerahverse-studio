import { z } from "zod";
import { getAppSettings, getVideo, q, updateVideo } from "./db";
import { generateScript } from "./ai";
import { tick } from "./queue";
import type { VideoSettings } from "./plan";
import type { AppSettings } from "./constants";

export const SettingsInput = z
  .object({
    voice: z.string(),
    speed: z.number().min(0.8).max(1.15),
    music: z.enum(["none", "cheerful", "calm"]),
    sfx: z.boolean(),
    mascot: z.boolean(),
    captions: z.boolean(),
    palette: z.enum(["bright", "pastel", "ocean", "sunset", "forest", "candy"]),
    chip: z.string().max(40),
    greeting: z.boolean(),
    subscribe: z.boolean(),
  })
  .partial();

export const CreateVideoInput = z.object({
  topic: z.string().trim().min(2, "Please enter a topic").max(200),
  subject: z.string().max(40).default("General Knowledge"),
  age_group: z.string().max(10).default("6-7"),
  details: z.string().max(6000).default(""),
  image_urls: z.array(z.string().url()).max(8).default([]),
  format: z.enum(["long", "short"]),
  target_seconds: z.number().int().min(15).max(1200),
  review: z.boolean().default(true),
  settings: SettingsInput.default({}),
});
export type CreateVideoInput = z.infer<typeof CreateVideoInput>;

export function videoSettingsFrom(app: AppSettings, s: z.infer<typeof SettingsInput>): VideoSettings {
  return {
    voice: s.voice ?? app.voice,
    speed: s.speed ?? app.speed,
    music: (s.music ?? app.music) as VideoSettings["music"],
    sfx: s.sfx ?? app.sfx,
    mascot: s.mascot ?? app.mascot,
    captions: s.captions ?? app.captions,
    palette: (s.palette ?? app.palette) as VideoSettings["palette"],
    chip: s.chip ?? app.chip,
    greeting: s.greeting ?? app.greeting,
    subscribe: s.subscribe ?? app.subscribe,
    channel: app.channel,
    tagline: app.tagline,
  };
}

export async function createVideos(inputs: CreateVideoInput[], batchName?: string): Promise<string[]> {
  const app = await getAppSettings();
  let batchId: string | null = null;
  if (inputs.length > 1) {
    const b = await q<{ id: string }>(`INSERT INTO batches (name) VALUES ($1) RETURNING id`, [
      batchName || `Batch of ${inputs.length} — ${new Date().toLocaleDateString("en-GB")}`,
    ]);
    batchId = b[0].id;
  }
  const ids: string[] = [];
  for (const v of inputs) {
    const settings = videoSettingsFrom(app, v.settings);
    const target = v.format === "short" ? Math.min(180, v.target_seconds) : Math.max(60, v.target_seconds);
    const rows = await q<{ id: string }>(
      `INSERT INTO videos (batch_id, status, stage, progress, message, topic, subject, age_group, details, image_urls, format,
        target_seconds, settings, auto_render)
       VALUES ($1, 'scripting', 'script', 0, 'Waiting for the script writer…', $2, $3, $4, $5, $6::jsonb, $7, $8, $9::jsonb, $10)
       RETURNING id`,
      [
        batchId,
        v.topic,
        v.subject,
        v.age_group,
        v.details,
        JSON.stringify(v.image_urls),
        v.format,
        target,
        JSON.stringify(settings),
        !v.review,
      ],
    );
    ids.push(rows[0].id);
  }
  return ids;
}

/** Write the script for one video (runs inside its own function invocation). */
export async function runGeneration(id: string, base: string) {
  const v = await getVideo(id);
  if (!v) return;
  const app = await getAppSettings();
  await updateVideo(id, { status: "scripting", stage: "script", progress: 5, message: "Claude is reading the topic…", error: null });
  try {
    let pct = 10;
    const { plan, youtube, warnings } = await generateScript(v, app.model, async (msg) => {
      pct = Math.min(80, pct + 15);
      await updateVideo(id, { message: msg, progress: pct });
    });
    const fresh = await getVideo(id);
    if (!fresh || fresh.status === "canceled") return;
    if (v.auto_render) {
      await updateVideo(id, {
        plan,
        youtube,
        warnings,
        status: "queued",
        stage: "queued",
        progress: 0,
        message: "Script ready — waiting for a render machine…",
      });
      await tick(base);
    } else {
      await updateVideo(id, {
        plan,
        youtube,
        warnings,
        status: "review",
        stage: "review",
        progress: 100,
        message: "Script ready — please review it 👀",
      });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("generation failed", id, e);
    await updateVideo(id, {
      status: "failed",
      error: friendlyAiError(msg),
      message: "Script writing failed",
    });
  }
}

export function friendlyAiError(msg: string) {
  if (/credit|quota|payment|billing|insufficient/i.test(msg))
    return /credit card/i.test(msg)
      ? "Script writing needs AI access: add a payment card in Vercel → AI Gateway (you still get the free monthly credit), or add an ANTHROPIC_API_KEY in Vercel → Settings → Environment Variables. Then press Retry."
      : "The AI has no credits left. Top up in Vercel → AI Gateway (or your Anthropic account if you use ANTHROPIC_API_KEY), then press Retry. (" + msg.slice(0, 160) + ")";
  if (/unauthorized|401|oidc|api key/i.test(msg))
    return "The AI Gateway couldn't authenticate. On Vercel this works automatically; locally set AI_GATEWAY_API_KEY. (" + msg.slice(0, 160) + ")";
  if (/timeout|aborted/i.test(msg)) return "The script took too long to write. Try a shorter video or press Retry.";
  return msg.slice(0, 500);
}
