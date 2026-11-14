import { NextResponse } from "next/server";
import { handle } from "@/lib/http";
import { listPublicVideos } from "@/lib/public";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const u = new URL(req.url);
  const videos = await listPublicVideos({
    format: u.searchParams.get("format") ?? undefined,
    subject: u.searchParams.get("subject") ?? undefined,
    q: u.searchParams.get("q") ?? undefined,
    limit: parseInt(u.searchParams.get("limit") || "60", 10) || 60,
  });
  return NextResponse.json({ videos });
});
