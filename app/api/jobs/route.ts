import { NextResponse, after } from "next/server";
import { LIST_COLS, q } from "@/lib/db";
import { baseUrl, handle } from "@/lib/http";
import { tick } from "@/lib/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Live jobs for the queue page. Polling this also advances the render queue. */
export const GET = handle(async (req: Request) => {
  const rows = await q(
    `SELECT ${LIST_COLS} FROM videos
     WHERE status IN ('scripting','review','queued','rendering','uploading')
        OR (status IN ('done','failed','canceled') AND updated_at > now() - interval '24 hours')
     ORDER BY CASE WHEN status IN ('scripting','queued','rendering','uploading') THEN 0 WHEN status='review' THEN 1 ELSE 2 END,
              updated_at DESC
     LIMIT 100`,
  );
  const base = await baseUrl(req);
  after(() => tick(base));
  return NextResponse.json({ jobs: rows, now: new Date().toISOString() });
});
