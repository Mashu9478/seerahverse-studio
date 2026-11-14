import { NextResponse } from "next/server";
import { getVideo, updateVideo } from "@/lib/db";
import { handle, jsonError } from "@/lib/http";

type Ctx = { params: Promise<{ id: string }> };

const STAGE_MSG: Record<string, string> = {
  voice: "Recording the narration 🎙️",
  render: "Drawing the animation 🎨",
  audio: "Mixing voice and sounds 🔊",
  encode: "Packing the video 📦",
};

/** Called by the engine inside the sandbox: {stage, pct, message}. Token-protected. */
export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const token = new URL(req.url).searchParams.get("token");
  const v = await getVideo(id);
  if (!v || !token || v.job_token !== token) return jsonError("Not allowed", 403);
  if (v.status !== "rendering") return NextResponse.json({ ok: true, ignored: true, status: v.status });
  const b = (await req.json().catch(() => ({}))) as { stage?: string; pct?: number; message?: string };
  const pct = Math.max(3, Math.min(95, Math.round(Number(b.pct) || 0)));
  await updateVideo(id, {
    stage: typeof b.stage === "string" ? b.stage.slice(0, 20) : v.stage,
    progress: Math.max(v.progress, pct),
    message: (typeof b.message === "string" && b.message.slice(0, 200)) || STAGE_MSG[b.stage ?? ""] || v.message,
  });
  return NextResponse.json({ ok: true, cancel: false });
});
