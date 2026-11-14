import { NextResponse } from "next/server";
import { del } from "@vercel/blob";
import { PUBLIC_COLS, getVideo, q, q1, updateVideo } from "@/lib/db";
import { handle, jsonError } from "@/lib/http";
import { stopSandbox } from "@/lib/sandbox";
import { ExplainerSchema, YoutubeSchema, describeIssues } from "@/lib/plan";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return jsonError("Video not found", 404);
  const v = await q1(`SELECT ${PUBLIC_COLS} FROM videos WHERE id = $1`, [id]);
  if (!v) return jsonError("Video not found", 404);
  return NextResponse.json({ video: v });
});

export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const v = await getVideo(id);
  if (!v) return jsonError("Video not found", 404);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (body.plan !== undefined) {
    const pl = body.plan as { scenes?: unknown; style?: unknown; explainer?: unknown } | null;
    if (!pl || typeof pl !== "object" || !Array.isArray(pl.scenes))
      return jsonError("The script is not valid JSON with a scenes list.");
    if (pl.style === "explainer" || pl.explainer !== undefined) {
      const ex = ExplainerSchema.safeParse(pl.explainer);
      if (!ex.success) return jsonError("The diagram script is not valid: " + (describeIssues(ex.error)[0] ?? "check the JSON"));
    }
    if (["rendering", "uploading", "queued"].includes(v.status)) return jsonError("This video is rendering — wait or cancel it first.");
    patch.plan = body.plan;
  }
  if (body.youtube !== undefined) {
    const y = YoutubeSchema.safeParse(body.youtube);
    if (!y.success) return jsonError("YouTube details are incomplete.");
    patch.youtube = y.data;
  }
  if (typeof body.topic === "string") patch.topic = body.topic.slice(0, 200);
  if (typeof body.is_public === "boolean") patch.is_public = body.is_public;
  if (Array.isArray(body.warnings)) patch.warnings = body.warnings.filter((w) => typeof w === "string");
  await updateVideo(id, patch);
  return NextResponse.json({ ok: true });
});

export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const v = await getVideo(id);
  if (!v) return jsonError("Video not found", 404);
  await stopSandbox(v.sandbox_id);
  const urls = [v.video_url, v.thumb_url, v.srt_url].filter(Boolean) as string[];
  if (urls.length) await del(urls).catch((e) => console.warn("blob delete", e));
  await q(`DELETE FROM videos WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
});
