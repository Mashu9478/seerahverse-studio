import { q, q1, getAppSettings } from "./db";

/** What visitors may see about a finished video (no scripts, tokens or internal state). */
export interface PublicVideo {
  id: string;
  title: string;
  topic: string;
  subject: string;
  age_group: string;
  format: "long" | "short";
  duration_sec: number | null;
  thumb_url: string | null;
  video_url: string | null;
  srt_url: string | null;
  description: string;
  hashtags: string[];
  presenter: string | null;
  finished_at: string | null;
}

const COLS = `id, COALESCE(youtube->>'title', plan->>'title', topic) AS title, topic, subject, age_group, format,
  duration_sec, thumb_url, video_url, srt_url, COALESCE(youtube->>'description', '') AS description,
  COALESCE(youtube->'hashtags', '[]'::jsonb) AS hashtags, plan->>'presenter' AS presenter, finished_at`;
const VISIBLE = `status = 'done' AND is_public = true AND video_url IS NOT NULL`;

export async function listPublicVideos(opts: { format?: string; subject?: string; q?: string; limit?: number } = {}) {
  const where = [VISIBLE];
  const params: unknown[] = [];
  if (opts.format === "long" || opts.format === "short") {
    params.push(opts.format);
    where.push(`format = $${params.length}`);
  }
  if (opts.subject) {
    params.push(opts.subject);
    where.push(`subject = $${params.length}`);
  }
  if (opts.q) {
    params.push(`%${opts.q}%`);
    where.push(`(topic ILIKE $${params.length} OR youtube->>'title' ILIKE $${params.length} OR plan->>'title' ILIKE $${params.length})`);
  }
  params.push(Math.min(200, opts.limit ?? 60));
  return q<PublicVideo>(
    `SELECT ${COLS} FROM videos WHERE ${where.join(" AND ")} ORDER BY finished_at DESC NULLS LAST LIMIT $${params.length}`,
    params,
  );
}

export async function getPublicVideo(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  return q1<PublicVideo>(`SELECT ${COLS} FROM videos WHERE id = $1 AND ${VISIBLE}`, [id]);
}

export async function publicInfo() {
  const s = await getAppSettings();
  const stats = await q1<{ videos: number; seconds: number; shorts: number; longs: number }>(
    `SELECT count(*)::int AS videos, COALESCE(sum(duration_sec), 0)::float AS seconds,
       count(*) FILTER (WHERE format = 'short')::int AS shorts, count(*) FILTER (WHERE format = 'long')::int AS longs
     FROM videos WHERE ${VISIBLE}`,
  );
  const subjects = await q<{ subject: string; n: number }>(
    `SELECT subject, count(*)::int AS n FROM videos WHERE ${VISIBLE} GROUP BY subject ORDER BY n DESC`,
  );
  return {
    channel: s.channel,
    tagline: s.tagline,
    stats: stats ?? { videos: 0, seconds: 0, shorts: 0, longs: 0 },
    subjects,
  };
}
