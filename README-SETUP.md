# SeerahVerse Video Studio — setup

Next.js 15 app (App Router) deployed on Vercel. The Python render engine lives in `engine/` and is copied into a
Vercel Sandbox for every render. Scripts are written by Claude through Vercel AI Gateway.

## Environment variables

| Variable | Required | What it does |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon Postgres connection string. Tables are created automatically on first use (`db/schema.sql` is the same SQL). |
| `APP_PASSWORD` | ✅ | The single password for the studio login page. |
| `AUTH_SECRET` | ✅ | Random string (32+ chars) used to sign the login cookie and internal self-calls. Changing it logs everyone out. |
| `BLOB_READ_WRITE_TOKEN` | ✅ | Vercel Blob store token (public store). Holds uploaded textbook pages, finished videos, thumbnails, captions. Added automatically when a Blob store is connected to the project. |
| `AI_GATEWAY_API_KEY` | local only | On Vercel, AI Gateway authenticates with the deployment's OIDC token. Set this only for `next dev`. |
| `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID` | local only | Lets `@vercel/sandbox` create render machines from your laptop. Not needed on Vercel (OIDC). |
| `APP_BASE_URL` | optional | Force the public URL used for sandbox callbacks (default: production domain, else the request host). |

Deployment Protection must not block the production URL: render machines call
`/api/jobs/<id>/progress` and `/api/jobs/<id>/done` (token-protected) from outside.

## How the pipeline works

1. **Create / Batch** → rows inserted with status `scripting`; each video's script is written in its own function
   call (`/api/videos/<id>/generate`, 300 s max) so a batch is written in parallel. Long videos over 6 minutes are
   outlined first, then written part-by-part in parallel.
2. **Review** (optional) → the script editor; **Approve & render** validates the plan and sets status `queued`.
3. **Queue tick** (runs whenever the app is open — every page polls `/api/jobs`) starts up to *max parallel* renders.
   Each render: new Sandbox (from the engine snapshot if built, else a fresh machine running `engine/setup.sh` first),
   copy `engine/` + `job/plan.json`, run `engine/run.sh` detached.
4. The engine reports progress and finally calls `done`; the app copies `video.mp4`, `thumb.jpg`, `captions.srt`
   to Blob, marks the video `done`, and stops the sandbox. No progress for 5 minutes ⇒ `failed` (Retry available).

## Settings → Render engine
"Build fast-start engine" runs `engine/setup.sh` once and saves a Sandbox snapshot (no expiry). Renders work without
it; the snapshot just skips setup (~30 s per video). Rebuild after changing `engine/ENGINE_VERSION`.

## Local development
```bash
npm install
cp .env.example .env.local   # fill in the variables above
npm run dev
```
