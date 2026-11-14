import { promises as fs } from "fs";
import path from "path";
import type { Readable } from "stream";
import { Sandbox, Snapshot } from "@vercel/sandbox";
import { put } from "@vercel/blob";
import { getEngineState, setEngineState, updateVideo, type EngineState, type VideoRow } from "./db";
import { randomToken } from "./http";

export const SANDBOX_ROOT = "/vercel/sandbox";
const RENDER_VCPUS = 4;
const RENDER_TIMEOUT_MS = 44 * 60 * 1000; // Hobby cap is 45 min
const BUILD_TIMEOUT_MS = 30 * 60 * 1000;

/* ------------------------------------------------------------------ */

function credentials() {
  // On Vercel the SDK authenticates with the deployment's OIDC token automatically.
  // For local development you can set VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID.
  const { VERCEL_TOKEN, VERCEL_TEAM_ID, VERCEL_PROJECT_ID } = process.env;
  if (VERCEL_TOKEN && VERCEL_TEAM_ID && VERCEL_PROJECT_ID) {
    return { token: VERCEL_TOKEN, teamId: VERCEL_TEAM_ID, projectId: VERCEL_PROJECT_ID };
  }
  return {};
}

function engineDir() {
  return path.join(process.cwd(), "engine");
}

export async function engineVersion(): Promise<string> {
  try {
    return (await fs.readFile(path.join(engineDir(), "ENGINE_VERSION"), "utf8")).trim() || "dev";
  } catch {
    return "missing";
  }
}

async function walk(dir: string, base = dir): Promise<string[]> {
  const out: string[] = [];
  for (const ent of await fs.readdir(dir, { withFileTypes: true })) {
    if (["__pycache__", "out", "cache", "node_modules"].includes(ent.name) || ent.name.startsWith(".")) continue;
    if (/\.(pyc|mp4|wav|mp3|webm|mov)$/i.test(ent.name)) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...(await walk(p, base)));
    else out.push(p);
  }
  return out;
}

/** All engine files, ready for sandbox.writeFiles. */
export async function engineFiles(): Promise<{ path: string; content: Uint8Array; mode?: number }[]> {
  const dir = engineDir();
  let files: string[];
  try {
    files = await walk(dir);
  } catch {
    throw new Error("The render engine files are missing from this deployment (engine/ folder).");
  }
  return Promise.all(
    files.map(async (f) => {
      const rel = path.relative(dir, f).split(path.sep).join("/");
      const content = new Uint8Array(await fs.readFile(f));
      return { path: `${SANDBOX_ROOT}/engine/${rel}`, content, ...(rel.endsWith(".sh") ? { mode: 0o755 } : {}) };
    }),
  );
}

async function writeInChunks(sb: Sandbox, files: { path: string; content: Uint8Array; mode?: number }[]) {
  // make sure every parent directory exists (the default image has no /vercel/sandbox yet)
  const dirs = Array.from(new Set(files.map((f) => f.path.slice(0, f.path.lastIndexOf("/"))))).filter(Boolean);
  const mk = await sb.runCommand({ cmd: "mkdir", args: ["-p", ...dirs, `${SANDBOX_ROOT}/job/out`] });
  if (mk.exitCode !== 0) {
    await sb.runCommand({ cmd: "bash", args: ["-lc", `sudo mkdir -p ${SANDBOX_ROOT} && sudo chown -R $(id -u):$(id -g) ${SANDBOX_ROOT}`] });
    await sb.runCommand({ cmd: "mkdir", args: ["-p", ...dirs, `${SANDBOX_ROOT}/job/out`] });
  }
  // keep each request modest in size
  let batch: typeof files = [];
  let size = 0;
  for (const f of files) {
    if (size + f.content.byteLength > 8 * 1024 * 1024 && batch.length) {
      await sb.writeFiles(batch);
      batch = [];
      size = 0;
    }
    batch.push(f);
    size += f.content.byteLength;
  }
  if (batch.length) await sb.writeFiles(batch);
}

export async function getSandbox(name: string) {
  return Sandbox.get({ name, ...credentials() });
}

export async function stopSandbox(name: string | null | undefined) {
  if (!name) return;
  try {
    const sb = await getSandbox(name);
    await sb.stop();
  } catch (e) {
    console.warn("stopSandbox", name, e instanceof Error ? e.message : e);
  }
}

/* ------------------------------------------------------------------ */
/* Engine snapshot build                                                */
/* ------------------------------------------------------------------ */

export async function startEngineBuild(): Promise<EngineState> {
  const version = await engineVersion();
  const files = await engineFiles();
  const sb = await Sandbox.create({
    resources: { vcpus: 4 },
    timeout: BUILD_TIMEOUT_MS,
    persistent: false,
    tags: { app: "svstudio", role: "engine-build" },
    ...credentials(),
  });
  await writeInChunks(sb, files);
  const cmd = await sb.runCommand({
    cmd: "bash",
    args: [
      "-lc",
      `rm -f ${SANDBOX_ROOT}/build.exit; bash ${SANDBOX_ROOT}/engine/setup.sh > ${SANDBOX_ROOT}/build.log 2>&1; echo $? > ${SANDBOX_ROOT}/build.exit`,
    ],
    detached: true,
    timeoutMs: BUILD_TIMEOUT_MS - 60_000,
  });
  const state: Partial<EngineState> = {
    status: "building",
    build_version: version,
    sandbox_name: sb.name,
    cmd_id: cmd.cmdId,
    log: "Starting build machine…",
    error: undefined,
    started_at: new Date().toISOString(),
    finished_at: undefined,
  };
  await setEngineState(state);
  return getEngineState();
}

async function readText(sb: Sandbox, p: string): Promise<string | null> {
  try {
    const buf = await sb.readFileToBuffer({ path: p });
    return buf ? buf.toString("utf8") : null;
  } catch {
    return null;
  }
}

/** Poll an in-progress build; snapshot when finished. */
export async function pollEngineBuild(): Promise<EngineState> {
  const st = await getEngineState();
  if (st.status !== "building" || !st.sandbox_name) return st;
  let sb: Sandbox;
  try {
    sb = await getSandbox(st.sandbox_name);
  } catch (e) {
    await setEngineState({ status: "failed", error: "Build machine disappeared: " + (e instanceof Error ? e.message : e) });
    return getEngineState();
  }
  if (["stopped", "failed", "aborted"].includes(sb.status)) {
    await setEngineState({ status: "failed", error: `Build machine ${sb.status} before finishing (time limit?).`, finished_at: new Date().toISOString() });
    return getEngineState();
  }
  const log = ((await readText(sb, `${SANDBOX_ROOT}/build.log`)) ?? "").slice(-6000);
  const exit = await readText(sb, `${SANDBOX_ROOT}/build.exit`);
  if (exit === null) {
    await setEngineState({ log });
    return getEngineState();
  }
  if (exit.trim() !== "0") {
    await setEngineState({ status: "failed", log, error: `Setup failed (exit ${exit.trim()}). See the log.`, finished_at: new Date().toISOString() });
    await stopSandbox(st.sandbox_name);
    return getEngineState();
  }
  await setEngineState({ status: "snapshotting", log: log + "\n\n📸 Saving a ready-to-go copy of the engine…" });
  try {
    const snap = await sb.snapshot({ expiration: 0 });
    const old = st.snapshot_id;
    await setEngineState({
      status: "ready",
      snapshot_id: snap.snapshotId,
      engine_version: st.build_version,
      finished_at: new Date().toISOString(),
      log: log + "\n\n✅ Engine ready!",
    });
    if (old && old !== snap.snapshotId) {
      try {
        const o = await Snapshot.get({ snapshotId: old, ...credentials() });
        await o.delete();
      } catch {
        /* old snapshot already gone */
      }
    }
  } catch (e) {
    await setEngineState({ status: "failed", error: "Snapshot failed: " + (e instanceof Error ? e.message : e) });
  }
  return getEngineState();
}

/* ------------------------------------------------------------------ */
/* Render jobs                                                          */
/* ------------------------------------------------------------------ */

export async function startRender(v: VideoRow, base: string): Promise<void> {
  if (!v.plan) throw new Error("This video has no script yet.");
  const engine = await getEngineState();
  const token = randomToken();
  await updateVideo(v.id, {
    job_token: token,
    stage: "starting",
    progress: 1,
    message: "Starting a render machine…",
    started_at: new Date().toISOString(),
    error: null,
  });
  // Diagram explainers draw every frame from vector art: ask for more cores (falls back to the default if refused).
  const wantVcpus = v.plan.style === "explainer" ? 8 : RENDER_VCPUS;
  const common = {
    resources: { vcpus: wantVcpus },
    timeout: RENDER_TIMEOUT_MS,
    persistent: false,
    tags: { app: "svstudio", role: "render", video: v.id.slice(0, 32) },
    ...credentials(),
  };
  // Prefer the pre-built engine snapshot (instant start); fall back to a fresh machine + setup (~30 s extra).
  let sb: Sandbox | null = null;
  let fromSnapshot = false;
  if (engine.status === "ready" && engine.snapshot_id) {
    try {
      sb = await Sandbox.create({ ...common, source: { type: "snapshot", snapshotId: engine.snapshot_id } });
      fromSnapshot = true;
    } catch (e) {
      console.warn("snapshot start failed, using a fresh machine", e instanceof Error ? e.message : e);
    }
  }
  if (!sb) {
    try {
      sb = await Sandbox.create(common);
    } catch (e) {
      if (wantVcpus === RENDER_VCPUS) throw e;
      console.warn("bigger render machine refused, using the default size", e instanceof Error ? e.message : e);
      sb = await Sandbox.create({ ...common, resources: { vcpus: RENDER_VCPUS } });
    }
  }
  await updateVideo(v.id, { sandbox_id: sb.name, message: fromSnapshot ? "Loading the animation engine…" : "Setting up the animation engine…", progress: 2 });
  const files = await engineFiles();
  files.push({
    path: `${SANDBOX_ROOT}/job/plan.json`,
    content: new TextEncoder().encode(JSON.stringify(v.plan, null, 1)),
  });
  // Launcher: on a fresh machine run setup first; report a setup failure to DONE_URL so the job fails fast.
  const launcher = [
    "#!/usr/bin/env bash",
    `ROOT=${SANDBOX_ROOT}`,
    fromSnapshot ? "" : `if ! bash "$ROOT/engine/setup.sh" > "$ROOT/setup.log" 2>&1; then
  python3 - "$ROOT/setup.log" <<'PY' > "$ROOT/setup_err.json" || echo '{"ok":false,"error":"Engine setup failed."}' > "$ROOT/setup_err.json"
import json, sys
tail = open(sys.argv[1], errors="replace").read()[-600:]
print(json.dumps({"ok": False, "error": "Engine setup failed: " + tail}))
PY
  curl -s -m 30 -X POST -H 'content-type: application/json' --data @"$ROOT/setup_err.json" "$DONE_URL" || true
  exit 1
fi`,
    `exec bash "$ROOT/engine/run.sh"`,
    "",
  ].join("\n");
  files.push({ path: `${SANDBOX_ROOT}/job/start.sh`, content: new TextEncoder().encode(launcher), mode: 0o755 });
  await writeInChunks(sb, files);
  const qs = `token=${token}`;
  await sb.runCommand({
    cmd: "bash",
    args: [`${SANDBOX_ROOT}/job/start.sh`],
    env: {
      PROGRESS_URL: `${base}/api/jobs/${v.id}/progress?${qs}`,
      DONE_URL: `${base}/api/jobs/${v.id}/done?${qs}`,
      VIDEO_ID: v.id,
    },
    detached: true,
    timeoutMs: RENDER_TIMEOUT_MS - 60_000,
  });
  await updateVideo(v.id, { message: fromSnapshot ? "Recording the narration…" : "Installing the voice and animation tools…", stage: "voice", progress: 3 });
}

export interface DonePayload {
  ok: boolean;
  error?: string;
  duration?: number;
  files?: { video?: string; thumb?: string; srt?: string };
}

async function uploadFromSandbox(sb: Sandbox, src: string, dest: string, contentType: string, multipart = false) {
  const stream = await sb.readFile({ path: src });
  if (!stream) return null;
  const blob = await put(dest, stream as unknown as Readable, {
    access: "public",
    addRandomSuffix: true,
    contentType,
    multipart,
  });
  return blob.url;
}

/** Copy finished files from the sandbox to Blob and mark the video done. */
export async function finishRender(v: VideoRow, payload: DonePayload) {
  if (!v.sandbox_id) throw new Error("No render machine recorded for this video.");
  const sb = await getSandbox(v.sandbox_id);
  const f = payload.files ?? {};
  await updateVideo(v.id, { status: "uploading", stage: "upload", progress: 96, message: "Uploading your video…" });
  const videoUrl = await uploadFromSandbox(sb, f.video ?? `${SANDBOX_ROOT}/job/out/video.mp4`, `videos/${v.id}/video.mp4`, "video/mp4", true);
  if (!videoUrl) throw new Error("The engine finished but no video file was found.");
  const [thumbUrl, srtUrl] = await Promise.all([
    uploadFromSandbox(sb, f.thumb ?? `${SANDBOX_ROOT}/job/out/thumb.jpg`, `videos/${v.id}/thumb.jpg`, "image/jpeg").catch(() => null),
    uploadFromSandbox(sb, f.srt ?? `${SANDBOX_ROOT}/job/out/captions.srt`, `videos/${v.id}/captions.srt`, "text/plain").catch(() => null),
  ]);
  await updateVideo(v.id, {
    status: "done",
    stage: "done",
    progress: 100,
    message: "Your video is ready! 🎉",
    video_url: videoUrl,
    thumb_url: thumbUrl,
    srt_url: srtUrl,
    duration_sec: payload.duration ?? null,
    finished_at: new Date().toISOString(),
    job_token: null,
  });
  await stopSandbox(v.sandbox_id);
}
