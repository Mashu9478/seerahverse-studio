import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "./constants";
import type { VideoPlan, YoutubeMeta, VideoSettings } from "./plan";

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS batches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL DEFAULT '',
    created_at timestamptz NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS videos (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id uuid NULL REFERENCES batches(id) ON DELETE SET NULL,
    status text NOT NULL DEFAULT 'draft',
    stage text NULL,
    progress int NOT NULL DEFAULT 0,
    message text NULL,
    topic text NOT NULL DEFAULT '',
    subject text NOT NULL DEFAULT 'General Knowledge',
    age_group text NOT NULL DEFAULT '6-7',
    details text NOT NULL DEFAULT '',
    image_urls jsonb NOT NULL DEFAULT '[]'::jsonb,
    format text NOT NULL DEFAULT 'long',
    target_seconds int NOT NULL DEFAULT 300,
    settings jsonb NOT NULL DEFAULT '{}'::jsonb,
    plan jsonb NULL,
    youtube jsonb NULL,
    warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
    video_url text NULL,
    thumb_url text NULL,
    srt_url text NULL,
    duration_sec real NULL,
    sandbox_id text NULL,
    job_token text NULL,
    error text NULL,
    auto_render boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    started_at timestamptz NULL,
    finished_at timestamptz NULL)`,
  `CREATE INDEX IF NOT EXISTS videos_status_idx ON videos (status, created_at)`,
  `CREATE INDEX IF NOT EXISTS videos_created_idx ON videos (created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS videos_batch_idx ON videos (batch_id)`,
  `CREATE TABLE IF NOT EXISTS settings (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now())`,
];

let _sql: NeonQueryFunction<false, false> | null = null;
let _ready: Promise<void> | null = null;

function raw() {
  if (!_sql) {
    const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (!url) throw new Error("DATABASE_URL is not set. Connect a Neon database in Vercel → Storage.");
    _sql = neon(url);
  }
  return _sql;
}

/** Run the idempotent schema once per server instance. */
export async function ensureSchema() {
  if (!_ready) {
    _ready = (async () => {
      const sql = raw();
      for (const stmt of SCHEMA) await sql.query(stmt);
    })().catch((e) => {
      _ready = null;
      throw e;
    });
  }
  return _ready;
}

/** Parameterised query helper: q("SELECT * FROM videos WHERE id = $1", [id]) */
export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  await ensureSchema();
  const rows = await raw().query(text, params as never[]);
  return rows as unknown as T[];
}

export async function q1<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(text, params);
  return rows[0] ?? null;
}

/* ------------------------------------------------------------------ */

export type VideoStatus =
  | "draft"
  | "scripting"
  | "review"
  | "queued"
  | "rendering"
  | "uploading"
  | "done"
  | "failed"
  | "canceled";

export interface VideoRow {
  id: string;
  batch_id: string | null;
  status: VideoStatus;
  stage: string | null;
  progress: number;
  message: string | null;
  topic: string;
  subject: string;
  age_group: string;
  details: string;
  image_urls: string[];
  format: "long" | "short";
  target_seconds: number;
  settings: VideoSettings;
  plan: VideoPlan | null;
  youtube: YoutubeMeta | null;
  warnings: string[];
  video_url: string | null;
  thumb_url: string | null;
  srt_url: string | null;
  duration_sec: number | null;
  sandbox_id: string | null;
  job_token: string | null;
  error: string | null;
  auto_render: boolean;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  finished_at: string | null;
}

/** Columns safe to send to the browser (no job token). */
export const PUBLIC_COLS = `id, batch_id, status, stage, progress, message, topic, subject, age_group, details, image_urls,
  format, target_seconds, settings, plan, youtube, warnings, video_url, thumb_url, srt_url, duration_sec, sandbox_id,
  error, auto_render, created_at, updated_at, started_at, finished_at`;

export const LIST_COLS = `id, batch_id, status, stage, progress, message, topic, subject, age_group, format, target_seconds,
  youtube, video_url, thumb_url, srt_url, duration_sec, error, auto_render, created_at, updated_at, started_at, finished_at,
  (plan->>'title') AS title, COALESCE(jsonb_array_length(warnings), 0) AS warning_count`;

export async function getVideo(id: string): Promise<VideoRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return q1<VideoRow>(`SELECT * FROM videos WHERE id = $1`, [id]);
}

export async function updateVideo(id: string, patch: Partial<Record<keyof VideoRow, unknown>>) {
  const keys = Object.keys(patch);
  if (keys.length === 0) return;
  const sets = keys.map((k, i) => {
    const v = (patch as Record<string, unknown>)[k];
    const jsonCols = ["image_urls", "settings", "plan", "youtube", "warnings"];
    return jsonCols.includes(k) ? `${k} = $${i + 2}::jsonb` : `${k} = $${i + 2}`;
  });
  const vals = keys.map((k) => {
    const v = (patch as Record<string, unknown>)[k];
    const jsonCols = ["image_urls", "settings", "plan", "youtube", "warnings"];
    return jsonCols.includes(k) ? (v === null ? null : JSON.stringify(v)) : v;
  });
  await q(`UPDATE videos SET ${sets.join(", ")}, updated_at = now() WHERE id = $1`, [id, ...vals]);
}

/* ------------------------------------------------------------------ */
/* Settings                                                             */
/* ------------------------------------------------------------------ */

export async function getSetting<T>(key: string, fallback: T): Promise<T> {
  const row = await q1<{ value: T }>(`SELECT value FROM settings WHERE key = $1`, [key]);
  return row ? row.value : fallback;
}

export async function setSetting(key: string, value: unknown) {
  await q(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}

export async function getAppSettings(): Promise<AppSettings> {
  const s = await getSetting<Partial<AppSettings>>("app", {});
  return { ...DEFAULT_APP_SETTINGS, ...s };
}

export interface EngineState {
  status: "none" | "building" | "snapshotting" | "ready" | "failed";
  snapshot_id?: string;
  engine_version?: string;
  build_version?: string;
  sandbox_name?: string;
  cmd_id?: string;
  log?: string;
  error?: string;
  started_at?: string;
  finished_at?: string;
}

export async function getEngineState(): Promise<EngineState> {
  return getSetting<EngineState>("engine", { status: "none" });
}

export async function setEngineState(patch: Partial<EngineState>) {
  const cur = await getEngineState();
  await setSetting("engine", { ...cur, ...patch });
}
