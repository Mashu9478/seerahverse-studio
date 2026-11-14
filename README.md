# SeerahVerse Video Studio

Make narrated, animated kids' learning videos (YouTube Shorts and long videos) from a topic or textbook photos — one at a time or in batches.

- `app/`, `components/`, `lib/` — Next.js website (dashboard, create wizard, batch, queue, script editor, library, settings)
- `engine/` — Python render engine that runs inside Vercel Sandbox (Kokoro voice, animated scenes, captions, thumbnail)
- `db/schema.sql` — Neon Postgres schema (created automatically on first use)
- See `README-SETUP.md` for environment variables.
