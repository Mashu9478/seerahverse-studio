#!/bin/bash
# One-time sandbox setup (baked into a snapshot).
# Works on the Vercel Sandbox universal image (Ubuntu, HOME=/vercel) and the older Amazon Linux images.
# ROOT is the folder that contains engine/ (normally /vercel/sandbox).
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
echo "== root: $ROOT"
echo "== system libs (libraqm for Arabic text shaping; optional)"
if command -v apt-get >/dev/null 2>&1; then
  (sudo -n apt-get install -y -q libraqm0 >/dev/null 2>&1 || \
   (sudo -n apt-get update -q >/dev/null 2>&1 && sudo -n apt-get install -y -q libraqm0 >/dev/null 2>&1)) || echo "libraqm not installed (fallback shaping will be used)"
elif command -v dnf >/dev/null 2>&1; then
  sudo -n dnf install -y -q libraqm >/dev/null 2>&1 || echo "libraqm not installed (fallback shaping will be used)"
fi
echo "== python venv (3.13)"
if command -v uv >/dev/null 2>&1; then
  uv venv --quiet --python 3.13 "$ROOT/venv" || uv venv --quiet "$ROOT/venv"
  PIP="uv pip install --quiet --python $ROOT/venv/bin/python"
else
  python3 -m venv "$ROOT/venv"
  "$ROOT/venv/bin/python" -m pip install --quiet --upgrade pip
  PIP="$ROOT/venv/bin/python -m pip install --quiet --no-cache-dir"
fi
"$ROOT/venv/bin/python" --version
echo "== python packages"
$PIP "kokoro-onnx>=0.4" soundfile pillow numpy scipy imageio-ffmpeg resvg-py arabic-reshaper python-bidi
echo "== voice model"
mkdir -p "$ROOT/models" "$ROOT/assets/twemoji"
BASE=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
[ -s "$ROOT/models/kokoro-v1.0.onnx" ] || curl -fsSL --retry 3 -o "$ROOT/models/kokoro-v1.0.onnx" "$BASE/kokoro-v1.0.onnx"
[ -s "$ROOT/models/voices-v1.0.bin" ] || curl -fsSL --retry 3 -o "$ROOT/models/voices-v1.0.bin" "$BASE/voices-v1.0.bin"
echo "== emoji (Twemoji, CC-BY 4.0)"
curl -fsSL --retry 3 https://registry.npmjs.org/@twemoji/svg/-/svg-15.0.0.tgz | tar xz -C "$ROOT/assets/twemoji" --strip-components=1
ls "$ROOT/assets/twemoji" | wc -l
echo "== self test"
cd "$ROOT/engine"
MODEL_DIR="$ROOT/models" EMOJI_DIR="$ROOT/assets/twemoji" "$ROOT/venv/bin/python" - <<'PY'
import imageio_ffmpeg, subprocess
exe = imageio_ffmpeg.get_ffmpeg_exe()
print("ffmpeg:", exe)
out = subprocess.run([exe, "-hide_banner", "-encoders"], capture_output=True, text=True).stdout
assert "libx264" in out, "ffmpeg has no libx264"
from tts import Voice
a = Voice().say("Assalamu alaikum! Setup is complete.")
print("tts samples:", len(a))
from core import emoji
print("emoji:", emoji("🍎", 64).size)
from core import HAS_RAQM
print("raqm:", HAS_RAQM)
PY
echo "SETUP_OK"
