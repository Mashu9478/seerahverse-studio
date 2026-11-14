import { NextResponse, after } from "next/server";
import { getVideo, updateVideo } from "@/lib/db";
import { baseUrl, handle, jsonError } from "@/lib/http";
import { kickGeneration, tick } from "@/lib/queue";

type Ctx = { params: Promise<{ id: string }> };

/** Retry: if the script exists, re-queue the render; otherwise write the script again. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const v = await getVideo(id);
  if (!v) return jsonError("Video not found", 404);
  if (["rendering", "uploading", "scripting"].includes(v.status)) return jsonError("This video is still working.");
  const base = await baseUrl(req);
  if (!v.plan) {
    await updateVideo(id, { status: "scripting", stage: "script", progress: 2, message: "Trying again…", error: null });
    after(() => kickGeneration(base, [id]));
  } else {
    await updateVideo(id, {
      status: "queued",
      stage: "queued",
      progress: 0,
      message: "Waiting for a render machine…",
      error: null,
      sandbox_id: null,
    });
    after(() => tick(base));
  }
  return NextResponse.json({ ok: true });
});
