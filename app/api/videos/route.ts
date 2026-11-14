import { NextResponse, after } from "next/server";
import { z } from "zod";
import { LIST_COLS, q } from "@/lib/db";
import { baseUrl, handle, jsonError } from "@/lib/http";
import { CreateVideoInput, createVideos } from "@/lib/videos";
import { kickGeneration } from "@/lib/queue";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const u = new URL(req.url);
  const where: string[] = [];
  const params: unknown[] = [];
  const status = u.searchParams.get("status");
  const format = u.searchParams.get("format");
  const subject = u.searchParams.get("subject");
  const search = u.searchParams.get("q");
  if (status) {
    params.push(status.split(","));
    where.push(`status = ANY($${params.length})`);
  }
  if (format) {
    params.push(format);
    where.push(`format = $${params.length}`);
  }
  if (subject) {
    params.push(subject);
    where.push(`subject = $${params.length}`);
  }
  if (search) {
    params.push(`%${search}%`);
    where.push(`(topic ILIKE $${params.length} OR plan->>'title' ILIKE $${params.length} OR youtube->>'title' ILIKE $${params.length})`);
  }
  const limit = Math.min(200, parseInt(u.searchParams.get("limit") || "60", 10) || 60);
  params.push(limit);
  const rows = await q(
    `SELECT ${LIST_COLS} FROM videos ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY created_at DESC LIMIT $${params.length}`,
    params,
  );
  return NextResponse.json({ videos: rows });
});

const Body = z.object({
  videos: z.array(CreateVideoInput).min(1).max(30),
  batch_name: z.string().max(120).optional(),
});

export const POST = handle(async (req: Request) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    const row = typeof i.path[1] === "number" ? `Row ${i.path[1] + 1}: ` : "";
    return jsonError(`${row}${i.message}`);
  }
  const ids = await createVideos(parsed.data.videos, parsed.data.batch_name);
  const base = await baseUrl(req);
  after(() => kickGeneration(base, ids));
  return NextResponse.json({ ids });
});
