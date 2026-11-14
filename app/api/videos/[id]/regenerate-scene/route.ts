import { NextResponse } from "next/server";
import { z } from "zod";
import { getAppSettings, getVideo } from "@/lib/db";
import { handle, jsonError } from "@/lib/http";
import { regenerateScene } from "@/lib/ai";
import { PlanSchema } from "@/lib/plan";
import { friendlyAiError } from "@/lib/videos";

export const maxDuration = 300;
type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ index: z.number().int().min(0), instruction: z.string().max(1000).default(""), plan: z.unknown() });

export const POST = handle(async (req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const v = await getVideo(id);
  if (!v) return jsonError("Video not found", 404);
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return jsonError("Bad request");
  const plan = PlanSchema.safeParse(body.data.plan);
  if (!plan.success) return jsonError("Fix the highlighted problems in the script first, then try again.");
  if (body.data.index >= plan.data.scenes.length) return jsonError("That scene doesn't exist.");
  const app = await getAppSettings();
  try {
    const scene = await regenerateScene(v, plan.data, body.data.index, body.data.instruction, app.model);
    return NextResponse.json({ scene });
  } catch (e) {
    return jsonError(friendlyAiError(e instanceof Error ? e.message : String(e)), 502);
  }
});
