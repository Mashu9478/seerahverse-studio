import { getAppSettings, getVideo, q, q1, updateVideo, type VideoRow } from "./db";
import { startRender, stopSandbox } from "./sandbox";
import { internalKey } from "./auth";

let ticking = false;
let again = false;

/**
 * Advance the pipeline: fail stale jobs, then start queued renders up to the parallel limit.
 * Safe to call often (from polling, after events). Uses an atomic claim so two calls never start the same job.
 */
export async function tick(base: string): Promise<void> {
  if (ticking) {
    // another tick is running in this instance — make sure it runs once more when done
    again = true;
    return;
  }
  ticking = true;
  again = false;
  try {
    // 1) stale renders: no progress for 5 minutes
    const stale = await q<VideoRow>(
      `SELECT * FROM videos WHERE status IN ('rendering','uploading') AND updated_at < now() - interval '5 minutes'`,
    );
    for (const v of stale) {
      await updateVideo(v.id, {
        status: "failed",
        error: "The render machine stopped responding (no progress for 5 minutes). Press Retry.",
        message: "Stopped responding",
        job_token: null,
      });
      await stopSandbox(v.sandbox_id);
    }
    // stuck scripting (> 8 min)
    await q(
      `UPDATE videos SET status='failed', error='Script writing took too long. Press Retry.', message='Timed out', updated_at=now()
       WHERE status='scripting' AND updated_at < now() - interval '8 minutes'`,
    );

    // 2) start queued renders (works with or without a pre-built engine snapshot)
    const settings = await getAppSettings();
    const max = Math.max(1, Math.min(10, settings.max_parallel || 4));
    const active = await q1<{ n: number }>(`SELECT count(*)::int AS n FROM videos WHERE status IN ('rendering','uploading')`);
    const free = max - (active?.n ?? 0);
    if (free <= 0) {
      await q(
        `UPDATE videos SET message='In line — ' || $1 || ' videos are rendering right now', updated_at=updated_at WHERE status='queued'`,
        [String(active?.n ?? 0)],
      );
      return;
    }
    const claimed = await q<VideoRow>(
      `UPDATE videos SET status='rendering', stage='starting', progress=1, message='Starting…', updated_at=now()
       WHERE id IN (SELECT id FROM videos WHERE status='queued' ORDER BY created_at LIMIT $1 FOR UPDATE SKIP LOCKED)
       RETURNING *`,
      [free],
    );
    await Promise.all(
      claimed.map(async (v) => {
        try {
          await startRender(v, base);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          await updateVideo(v.id, { status: "failed", error: msg, message: "Couldn't start rendering", job_token: null });
          const fresh = await getVideo(v.id);
          await stopSandbox(fresh?.sandbox_id);
        }
      }),
    );
  } finally {
    ticking = false;
  }
  if (again) {
    again = false;
    await tick(base);
  }
}

/** Ask our own API to generate scripts — each video in its own function invocation (parallel, 300 s each). */
export async function kickGeneration(base: string, ids: string[]) {
  const key = await internalKey();
  await Promise.all(
    ids.map((id) =>
      fetch(`${base}/api/videos/${id}/generate`, {
        method: "POST",
        headers: { "x-internal-key": key, "content-type": "application/json" },
        body: "{}",
      }).catch((e) => console.error("kickGeneration", id, e)),
    ),
  );
}
