import { NextResponse, after } from "next/server";
import { getVideo, updateVideo } from "@/lib/db";
import { baseUrl, handle, jsonError } from "@/lib/http";
import { finishRender, stopSandbox, type DonePayload } from "@/lib/sandbox";
import { tick } from "@/lib/queue";

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

/** Called by the engine when it finishes. Uploads results to Blob in the background. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const token = new URL(req.url).searchParams.get("token");
  const v = await getVideo(id);
  if (!v || !token || v.job_token !== token) return jsonError("Not allowed", 403);
  const payload = (await req.json().catch(() => ({ ok: false, error: "Engine sent an unreadable result." }))) as DonePayload;
  const base = await baseUrl(req);
  if (!payload.ok) {
    await updateVideo(id, {
      status: "failed",
      error: (payload.error || "The engine reported an error.").slice(0, 2000),
      message: "Rendering failed",
      job_token: null,
    });
    after(async () => {
      await stopSandbox(v.sandbox_id);
      await tick(base);
    });
    return NextResponse.json({ ok: true });
  }
  await updateVideo(id, { status: "uploading", stage: "upload", progress: 96, message: "Uploading your video ☁️" });
  after(async () => {
    try {
      await finishRender(v, payload);
    } catch (e) {
      await updateVideo(id, {
        status: "failed",
        error: "Upload failed: " + (e instanceof Error ? e.message : String(e)),
        message: "Upload failed",
        job_token: null,
      });
      await stopSandbox(v.sandbox_id);
    }
    await tick(base);
  });
  return NextResponse.json({ ok: true });
});
