import { NextResponse, after } from "next/server";
import { getVideo, updateVideo } from "@/lib/db";
import { baseUrl, handle, jsonError } from "@/lib/http";
import { stopSandbox } from "@/lib/sandbox";
import { tick } from "@/lib/queue";

type Ctx = { params: Promise<{ id: string }> };

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const v = await getVideo(id);
  if (!v) return jsonError("Video not found", 404);
  if (["done", "canceled"].includes(v.status)) return NextResponse.json({ ok: true });
  await updateVideo(id, { status: "canceled", message: "Canceled", job_token: null });
  await stopSandbox(v.sandbox_id);
  const base = await baseUrl(req);
  after(() => tick(base));
  return NextResponse.json({ ok: true });
});
