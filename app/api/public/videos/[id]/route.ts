import { NextResponse } from "next/server";
import { handle, jsonError } from "@/lib/http";
import { getPublicVideo } from "@/lib/public";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export const GET = handle(async (_req: Request, ctx: Ctx) => {
  const { id } = await ctx.params;
  const video = await getPublicVideo(id);
  if (!video) return jsonError("Video not found", 404);
  return NextResponse.json({ video });
});
