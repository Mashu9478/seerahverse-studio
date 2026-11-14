import { NextResponse } from "next/server";
import { LIST_COLS, q, q1 } from "@/lib/db";
import { handle } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const s = await q1<Record<string, number>>(
    `SELECT
       count(*) FILTER (WHERE status='done')::int AS done,
       COALESCE(sum(duration_sec) FILTER (WHERE status='done'), 0)::float AS seconds,
       count(*) FILTER (WHERE status IN ('scripting','queued','rendering','uploading'))::int AS working,
       count(*) FILTER (WHERE status='review')::int AS review,
       count(*) FILTER (WHERE status='failed')::int AS failed,
       count(*) FILTER (WHERE status='done' AND format='short')::int AS shorts,
       count(*) FILTER (WHERE status='done' AND format='long')::int AS longs
     FROM videos`,
  );
  const recent = await q(`SELECT ${LIST_COLS} FROM videos ORDER BY created_at DESC LIMIT 8`);
  return NextResponse.json({ stats: s, recent });
});
