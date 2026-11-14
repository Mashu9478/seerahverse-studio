import { NextResponse } from "next/server";
import { getEngineState, q1 } from "@/lib/db";
import { handle, jsonError } from "@/lib/http";
import { engineVersion, pollEngineBuild, startEngineBuild } from "@/lib/sandbox";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** GET: engine status (also advances an in-progress build). */
export const GET = handle(async () => {
  const state = await pollEngineBuild();
  const version = await engineVersion();
  const waiting = await q1<{ n: number }>(`SELECT count(*)::int AS n FROM videos WHERE status='queued'`);
  return NextResponse.json({
    engine: state,
    deployed_version: version,
    outdated: state.status === "ready" && state.engine_version !== version,
    queued: waiting?.n ?? 0,
  });
});

/** POST: start building (or rebuilding) the render engine snapshot. */
export const POST = handle(async () => {
  const st = await getEngineState();
  if (st.status === "building" || st.status === "snapshotting") return jsonError("A build is already running.");
  const state = await startEngineBuild();
  return NextResponse.json({ engine: state });
});
