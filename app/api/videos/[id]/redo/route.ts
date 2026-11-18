import { NextResponse, after } from "next/server";
import { getAppSettings, getVideo, updateVideo } from "@/lib/db";
import { baseUrl, handle, jsonError } from "@/lib/http";
import { kickGeneration } from "@/lib/queue";
import { CreateVideoInput, videoSettingsFrom } from "@/lib/videos";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Edit & retry: change a video's options (topic, details, format, length, style, language, voice…)
 * and write its script again from scratch — same video, no need to create a new one.
 * Body: the same shape as creating a video.
 */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const v = await getVideo(id);
  if (!v) return jsonError("Video not found", 404);
  if (["rendering", "uploading", "scripting", "queued"].includes(v.status))
    return jsonError("This video is still working — cancel it first, then edit its options.");
  const parsed = CreateVideoInput.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Please check the options.");
  const input = parsed.data;
  const app = await getAppSettings();
  const settings = videoSettingsFrom(app, input.settings);
  const target = input.format === "short" ? Math.min(180, input.target_seconds) : Math.max(60, input.target_seconds);
  await updateVideo(id, {
    topic: input.topic,
    subject: input.subject,
    age_group: input.age_group,
    details: input.details,
    image_urls: input.image_urls,
    format: input.format,
    target_seconds: target,
    settings,
    auto_render: !input.review,
    plan: null,
    youtube: null,
    warnings: [],
    video_url: null,
    thumb_url: null,
    srt_url: null,
    duration_sec: null,
    sandbox_id: null,
    error: null,
    status: "scripting",
    stage: "script",
    progress: 2,
    message: "Writing the script again with your new options…",
    finished_at: null,
  });
  const base = await baseUrl(req);
  after(() => kickGeneration(base, [id]));
  return NextResponse.json({ ok: true, id });
});
