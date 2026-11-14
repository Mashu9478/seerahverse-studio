#!/bin/bash
# Render one job. Expects <ROOT>/job/plan.json and env PROGRESS_URL / DONE_URL.
# ROOT is the folder that contains engine/ (normally /vercel/sandbox).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/engine"
mkdir -p "$ROOT/job/out"
rm -f "$ROOT/job/.reported"
export MODEL_DIR="$ROOT/models" EMOJI_DIR="$ROOT/assets/twemoji" TTS_CACHE="$ROOT/job/tts" REPORT_FLAG="$ROOT/job/.reported"
"$ROOT/venv/bin/python" run.py "$ROOT/job/plan.json" "$ROOT/job/out" > "$ROOT/job/log.txt" 2>&1
code=$?
if [ ! -f "$ROOT/job/.reported" ] && [ -n "${DONE_URL:-}" ]; then
  # run.py normally reports its own failure; this covers hard crashes (e.g. out of memory)
  tail_txt=$(tail -c 800 "$ROOT/job/log.txt" | tr '"\\\n' "'/ ")
  curl -s -X POST -H 'content-type: application/json' \
    -d "{\"ok\":false,\"error\":\"engine exited with code $code\",\"trace\":\"$tail_txt\"}" "$DONE_URL" || true
fi
exit $code
