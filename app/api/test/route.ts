import { NextResponse } from "next/server";
import { put, del } from "@vercel/blob";
import { getAppSettings, q1 } from "@/lib/db";
import { handle, jsonError } from "@/lib/http";
import { aiPing } from "@/lib/ai";
import { friendlyAiError } from "@/lib/videos";

export const maxDuration = 90;

export const POST = handle(async (req: Request) => {
  const { kind } = (await req.json().catch(() => ({}))) as { kind?: string };
  if (kind === "db") {
    const r = await q1<{ n: number; now: string }>(`SELECT count(*)::int AS n, now()::text AS now FROM videos`);
    return NextResponse.json({ ok: true, message: `Database connected ✓ (${r?.n ?? 0} videos)` });
  }
  if (kind === "blob") {
    const b = await put(`tests/ping-${Date.now()}.txt`, "hello from the studio", { access: "public", addRandomSuffix: true });
    await del(b.url);
    return NextResponse.json({ ok: true, message: "Blob storage works ✓" });
  }
  if (kind === "ai") {
    const s = await getAppSettings();
    try {
      const r = await aiPing(s.model);
      return NextResponse.json({ ok: true, message: `AI connected ✓ — ${r.joke}` });
    } catch (e) {
      return jsonError(friendlyAiError(e instanceof Error ? e.message : String(e)), 502);
    }
  }
  return jsonError("Unknown test");
});
