import { NextResponse, after } from "next/server";
import { getVideo, updateVideo } from "@/lib/db";
import { baseUrl, handle, jsonError } from "@/lib/http";
import { runGeneration } from "@/lib/videos";

export const maxDuration = 300;
export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Starts (re)writing the script. Responds immediately; the work continues in `after()`. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const v = await getVideo(id);
  if (!v) return jsonError("Video not found", 404);
  if (["rendering", "uploading"].includes(v.status)) return jsonError("This video is rendering right now.");
  const body = (await req.json().catch(() => ({}))) as { review?: boolean };
  const patch: Record<string, unknown> = { status: "scripting", stage: "script", progress: 3, message: "Starting the script writer…", error: null };
  if (typeof body.review === "boolean") patch.auto_render = !body.review;
  await updateVideo(id, patch);
  const base = await baseUrl(req);
  after(() => runGeneration(id, base));
  return NextResponse.json({ ok: true });
});
