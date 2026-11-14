-- SeerahVerse Video Studio schema (idempotent; the app also runs this automatically on first use)

CREATE TABLE IF NOT EXISTS batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS videos (
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
  finished_at timestamptz NULL
);

ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS videos_status_idx ON videos (status, created_at);
CREATE INDEX IF NOT EXISTS videos_created_idx ON videos (created_at DESC);
CREATE INDEX IF NOT EXISTS videos_batch_idx ON videos (batch_id);

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
