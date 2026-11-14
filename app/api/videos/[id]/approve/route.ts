import { NextResponse, after } from "next/server";
import { getVideo, updateVideo } from "@/lib/db";
import { baseUrl, handle, jsonError } from "@/lib/http";
import { PlanSchema, YoutubeSchema, describeIssues, sanitizePlan } from "@/lib/plan";
import { tick } from "@/lib/queue";

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

/** Validate the (edited) script and put the video in the render queue. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const v = await getVideo(id);
  if (!v) return jsonError("Video not found", 404);
  if (["rendering", "uploading", "queued"].includes(v.status)) return jsonError("This video is already in the render queue.");
  const body = (await req.json().catch(() => ({}))) as { plan?: unknown; youtube?: unknown };
  const parsed = PlanSchema.safeParse(body.plan ?? v.plan);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please fix these first:", issues: describeIssues(parsed.error) }, { status: 400 });
  }
  const { plan, warnings } = sanitizePlan(parsed.data, { userText: v.details });
  const patch: Record<string, unknown> = {
    plan,
    warnings,
    status: "queued",
    stage: "queued",
    progress: 0,
    message: "Waiting for a render machine…",
    error: null,
    video_url: null,
    thumb_url: null,
    srt_url: null,
    finished_at: null,
  };
  if (body.youtube) {
    const y = YoutubeSchema.safeParse(body.youtube);
    if (y.success) patch.youtube = y.data;
  }
  await updateVideo(id, patch);
  const base = await baseUrl(req);
  after(() => tick(base));
  return NextResponse.json({ ok: true, warnings });
});
