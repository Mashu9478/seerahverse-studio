"""Engine entry: python run.py plan.json out_dir

Builds narration with Kokoro, renders every scene in parallel, mixes audio, writes
video.mp4, thumb.jpg, captions.srt and reports progress to PROGRESS_URL / DONE_URL.
"""
import json, math, os, subprocess, sys, threading, time, traceback, urllib.request
from multiprocessing import Pool, Value

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly
from PIL import Image, ImageDraw
from core import *
from scenes import SCENE_TYPES
import audio as AU

try:
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FFMPEG = "ffmpeg"

SPF24 = 800      # 24 kHz samples per frame
SPF48 = 1600     # 48 kHz samples per frame
FADE_IN, FADE_OUT = 0.3, 0.25


# ------------------------------------------------------------------ progress
class Reporter:
    def __init__(self):
        self.url = os.environ.get("PROGRESS_URL")
        self.done_url = os.environ.get("DONE_URL")
        self.state = {"stage": "voice", "pct": 0, "message": "Starting"}
        self.dirty = True
        self.stop = False
        if self.url:
            threading.Thread(target=self.loop, daemon=True).start()

    def set(self, stage, pct, message):
        self.state = {"stage": stage, "pct": int(max(0, min(100, pct))), "message": message}
        self.dirty = True
        print(f"[{stage} {self.state['pct']:3d}%] {message}", flush=True)

    def _post(self, url, payload):
        try:
            req = urllib.request.Request(url, data=json.dumps(payload).encode(), method="POST",
                                         headers={"content-type": "application/json"})
            urllib.request.urlopen(req, timeout=20).read()
            return True
        except Exception as e:
            print("post failed", url[:60], e, flush=True)
            return False

    def loop(self):
        while not self.stop:
            if self.dirty:
                self.dirty = False
                self._post(self.url, self.state)
            time.sleep(3)

    def done(self, payload):
        self.stop = True
        flag = os.environ.get("REPORT_FLAG")
        if flag:
            try:
                open(flag, "w").write("1")
            except Exception:
                pass
        if self.done_url:
            for _ in range(5):
                if self._post(self.done_url, payload):
                    break
                time.sleep(3)


# ------------------------------------------------------------------ plan helpers
def ctx_for(plan):
    portrait = plan.get("format") == "short"
    W, H = (1080, 1920) if portrait else (1920, 1080)
    pal = PALETTES.get(plan.get("palette", "bright"), PALETTES["bright"])
    brand = dict(plan.get("brand") or {})
    presenter = plan.get("presenter") or ("ollie" if plan.get("mascot", True) else "none")
    if presenter not in ("ollie", "maryam", "yusuf", "robo", "sheru", "none"):
        presenter = "ollie"
    return dict(W=W, H=H, portrait=portrait, palette=pal, brand=brand, plan=plan, sfx=plan.get("sfx", True),
                presenter=presenter, mascot=presenter != "none", captions=plan.get("captions", True))


def scene_bg(ctx, si, spec):
    pal = ctx["palette"]
    return pal[si % len(pal)]


def is_count_beat(b):
    return len(b.get("say", "").split()) <= 2


def build_timeline(plan, beat_audio):
    """beat_audio[si][bi] -> np.array (24k). Returns per-scene timed beats + frames."""
    out = []
    tight = bool(plan.get("_tight"))
    for si, sc in enumerate(plan["scenes"]):
        t = (0.5 if si == 0 else 0.35) if tight else (0.7 if si == 0 else 0.55)
        beats = []
        for bi, b in enumerate(sc.get("beats") or []):
            a = beat_audio[si][bi]
            dur = len(a) / 24000
            beats.append(dict(say=b.get("say", ""), caption=b.get("caption") or b.get("say", ""), start=round(t, 3),
                              end=round(t + dur, 3)))
            pause = float(b.get("pause") or 0)
            if tight:
                pause = min(pause, 0.15)
            if sc.get("type") == "quiz" and bi == 0:
                if tight:
                    sc["think_seconds"] = min(float(sc.get("think_seconds") or 3), 2)
                pause = max(pause, float(sc.get("think_seconds") or 3) + (0.3 if tight else 0.5))
            gap = 0.15 if is_count_beat(b) and sc.get("type") == "objects" else (0.22 if tight else 0.35)
            t += dur + pause + gap
        tail = (1.2 if tight else 1.6) if sc.get("type") == "outro" else (0.5 if tight else 0.8)
        total = max(t + tail, 2.5)
        out.append(dict(beats=beats, frames=int(round(total * FPS))))
    return out


def normalize_plan(plan):
    plan.setdefault("scenes", [])
    scenes = []
    for sc in plan["scenes"]:
        if sc.get("type") not in SCENE_TYPES:
            sc["type"] = "concept"
        beats = [b for b in (sc.get("beats") or []) if isinstance(b, dict) and (b.get("say") or "").strip()]
        if not beats:
            beats = [{"say": strip_emoji(sc.get("heading") or sc.get("title") or "Let's learn!")}]
        if sc["type"] == "quiz" and len(beats) < 2:
            beats.append({"say": f"The answer is {sc.get('correct', '')}!"})
        sc["beats"] = beats
        scenes.append(sc)
    plan["scenes"] = scenes
    return plan


# ------------------------------------------------------------------ narration
def make_voice(plan, rep):
    from tts import Voice
    v = Voice()
    voice = plan.get("voice", "af_heart")
    speed = float(plan.get("speed", 0.92))

    cache_dir = os.environ.get("TTS_CACHE")
    import hashlib

    def say_cached(text, spd):
        if not cache_dir:
            return v.say(text, voice, spd)
        os.makedirs(cache_dir, exist_ok=True)
        key = hashlib.sha1(f"{voice}|{spd:.3f}|{text}".encode()).hexdigest()
        p = os.path.join(cache_dir, key + ".npy")
        if os.path.exists(p):
            return np.load(p)
        a = v.say(text, voice, spd)
        np.save(p, a)
        return a

    def synth(spd):
        allb = [(si, bi, b) for si, sc in enumerate(plan["scenes"]) for bi, b in enumerate(sc["beats"])]
        res = [[None] * len(sc["beats"]) for sc in plan["scenes"]]
        for n, (si, bi, b) in enumerate(allb):
            res[si][bi] = say_cached(b["say"], spd)
            if n % 3 == 0:
                rep.set("voice", 5 + 25 * n / max(1, len(allb)), f"Recording narration {n + 1}/{len(allb)}")
        return res

    audio = synth(speed)
    target = float(plan.get("target_seconds") or 0)
    if target > 0:
        tl = build_timeline(plan, audio)
        total = sum(s["frames"] for s in tl) / FPS
        speech = sum(len(a) for sc in audio for a in sc) / 24000
        limit = target + (4 if plan.get("strict_length") else target * 0.2)
        if total > limit and speech > 0:
            nonspeech = total - speech
            factor = speech / max(1.0, (target + (2 if plan.get("strict_length") else target * 0.1)) - nonspeech)
            new_speed = min(1.15, speed * factor)
            if plan.get("strict_length"):
                plan["_tight"] = True
            if new_speed > speed + 0.02:
                rep.set("voice", 30, f"Tightening narration to fit {int(target)}s (speed {new_speed:.2f})")
                audio = synth(new_speed)
    return audio


def envelope(nar24, frames):
    a = nar24[: frames * SPF24]
    if len(a) < frames * SPF24:
        a = np.pad(a, (0, frames * SPF24 - len(a)))
    rms = np.sqrt((a.reshape(-1, SPF24) ** 2).mean(axis=1))
    v = rms[rms > 0.005]
    p = np.percentile(v, 90) if len(v) else 1.0
    env = rms / max(p, 1e-6)
    sm = np.copy(env)
    for i in range(1, len(sm)):
        sm[i] = max(env[i], sm[i - 1] * 0.5)
    return sm


# ------------------------------------------------------------------ frame composition
def caption_draw(d, scene, t, ctx):
    beats = scene.beats
    cur = None
    for k, b in enumerate(beats):
        if b["start"] - 0.05 <= t:
            nxt = beats[k + 1]["start"] - 0.05 if k + 1 < len(beats) else scene.dur
            if t < nxt:
                cur = b
    if not cur:
        return
    text = strip_emoji(cur["caption"])
    if not text:
        return
    if ctx["portrait"]:
        cx, bottom, maxw, size = 540, 1560, 900, 44
    else:
        owl_on = ctx["mascot"] and scene.owl_corner
        cx, bottom, maxw, size = (850, 1050, 1300, 40) if owl_on else (960, 1050, 1600, 40)
    f = font(size, 500)
    lines = wrap(text, f, maxw)[:3]
    lh = size * 1.25
    h = size * 1.55 + lh * (len(lines) - 1)
    wmax = max(f.getlength(l) for l in lines)
    d.rounded_rectangle((cx - wmax / 2 - 40, bottom - h, cx + wmax / 2 + 40, bottom), radius=28, fill=(255, 255, 255),
                        outline=col("#E3DAFF"), width=3)
    for i, l in enumerate(lines):
        d.text((cx, bottom - h + size * 0.78 + i * lh), l, font=f, fill=col(INK), anchor="mm")


def chip_draw(d, ctx, scene):
    chip = strip_emoji(ctx["brand"].get("chip") or "")
    if not chip or isinstance(scene, (SCENE_TYPES["title"], SCENE_TYPES["outro"])):
        return
    f = font(28, 600)
    tw = f.getlength(chip)
    x0, y0 = (30, 24) if not ctx["portrait"] else (40, 70)
    d.rounded_rectangle((x0, y0, x0 + tw + 44, y0 + 50), radius=25, fill=(255, 255, 255), outline=col("#7B5CD6"),
                        width=3)
    d.text((x0 + 22 + tw / 2, y0 + 26), chip, font=f, fill=col("#5B3FB3"), anchor="mm")


def compose(scene, i, env, ctx):
    t = i / FPS
    fr = scene.bgimg.copy()
    scene.draw_decor(fr, t)
    d = ImageDraw.Draw(fr)
    chip_draw(d, ctx, scene)
    scene.draw(fr, d, t)
    st = scene.owl_state(t) if ctx["mascot"] else None
    if st:
        v = env[min(i, len(env) - 1)]
        mouth = 0 if v < 0.18 else (1 if v < 0.6 else 2)
        eyes = "closed" if (t % 3.7) < 0.13 else "open"
        bob = 7 * math.sin(2 * math.pi * t / 2.2)
        put(fr, character(ctx["presenter"], eyes, mouth, st.get("wave", False), st["scale"]), st["pos"][0],
            st["pos"][1] + bob)
    if ctx["captions"]:
        caption_draw(d, scene, t, ctx)
    W, H = ctx["W"], ctx["H"]
    if t < FADE_IN:
        fr = Image.blend(Image.new("RGB", (W, H), (255, 255, 255)), fr, ease_io(t / FADE_IN))
    elif t > scene.dur - FADE_OUT:
        fr = Image.blend(fr, Image.new("RGB", (W, H), (255, 255, 255)), ease_io((t - (scene.dur - FADE_OUT)) / FADE_OUT))
    return fr


# ------------------------------------------------------------------ parallel scene rendering
_counter = None


def _init(c):
    global _counter
    _counter = c


def render_scene(args):
    plan, si, tl, env, out = args
    ctx = ctx_for(plan)
    spec = plan["scenes"][si]
    cls = SCENE_TYPES[spec["type"]]
    sc = cls(ctx, spec, tl["beats"], si, tl["frames"], scene_bg(ctx, si, spec))
    W, H = ctx["W"], ctx["H"]
    tmp = out.replace(".mp4", ".tmp.mp4")
    cmd = [FFMPEG, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
           "-i", "-", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", str(FPS),
           "-threads", "2", tmp]
    p = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for i in range(sc.frames):
        p.stdin.write(compose(sc, i, env, ctx).tobytes())
        if i % 15 == 0 and _counter is not None:
            with _counter.get_lock():
                _counter.value += 15
    p.stdin.close()
    if p.wait() != 0:
        raise RuntimeError(f"ffmpeg failed on scene {si}")
    os.replace(tmp, out)
    return si


# ------------------------------------------------------------------ thumbnail
def make_thumb(plan, ctx, path):
    portrait = ctx["portrait"]
    W, H = (1080, 1920) if portrait else (1280, 720)
    img = gradient(W, H, "#FFF3B0", "#FFC9DE")
    d = ImageDraw.Draw(img)
    rnd = random.Random(2)
    for _ in range(14):
        put(img, bubble(rnd.choice([50, 80, 110]), rnd.choice(["circle", "star"])), rnd.uniform(0, W), rnd.uniform(0, H))
    title = strip_emoji(plan.get("thumb_text") or plan.get("title") or "")
    emojis = []
    for sc in plan["scenes"]:
        for key in ("emojis",):
            emojis += sc.get(key) or []
        if sc.get("emoji"):
            emojis.append(sc["emoji"])
        if len(emojis) >= 3:
            break
    emojis = emojis[:3] or ["⭐"]
    if portrait:
        lines, size = fit_lines(title, 960, 150, 4, 700)
        y0 = 420 - size * 1.1 * (len(lines) - 1) / 2
        tbox_cx = 540
    else:
        lines, size = fit_lines(title, 760, 110, 3, 700)
        y0 = 330 - size * 1.1 * (len(lines) - 1) / 2
        tbox_cx = 440
    wi = 0
    for li, l in enumerate(lines):
        f = font(size, 700)
        ws = l.split()
        widths = [f.getlength(w) for w in ws]
        sp = f.getlength(" ")
        x = tbox_cx - (sum(widths) + sp * (len(ws) - 1)) / 2
        for w, wd in zip(ws, widths):
            c = ACCENTS[(wi * 3 + 1) % len(ACCENTS)]
            y = y0 + li * size * 1.1
            d.text((x + wd / 2 + 6, y + 8), w, font=f, fill=col("#5B3FB3"), anchor="mm", stroke_width=12,
                   stroke_fill=col("#5B3FB3"))
            d.text((x + wd / 2, y), w, font=f, fill=col(c), anchor="mm", stroke_width=10, stroke_fill=(255, 255, 255))
            x += wd + sp
            wi += 1
    if portrait:
        for k, e in enumerate(emojis):
            put(img, emoji(e, 230), 540 + (k - (len(emojis) - 1) / 2) * 280, 1000)
        if ctx["mascot"]:
            put(img, character(ctx["presenter"], "open", 0, True, 1.1), 540, 1450)
    else:
        spots = [(990, 150, 190), (1185, 215, 150)]
        for (x, y, sz), e in zip(spots, emojis[:2]):
            put(img, emoji(e, sz), x, y)
        if ctx["mascot"]:
            put(img, character(ctx["presenter"], "open", 0, True, 0.95), 1100, 530)
        else:
            put(img, emoji(emojis[-1], 230), 1090, 520)
    ch = ctx["brand"].get("channel")
    if ch:
        pill(d, ch, W / 2 if portrait else 440, H - 70 if not portrait else 1780, 32, "#7B5CD6", maxw=W - 120)
    img.save(path, quality=92)


# ------------------------------------------------------------------ srt
def fmt_ts(s):
    ms = int(round(s * 1000))
    h, ms = divmod(ms, 3600000)
    m, ms = divmod(ms, 60000)
    sec, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{sec:02d},{ms:03d}"


def write_srt(plan, tl, path):
    out, n, off = [], 1, 0.0
    for si, s in enumerate(tl):
        for b in s["beats"]:
            text = strip_emoji(b["caption"])
            if text:
                out.append(f"{n}\n{fmt_ts(off + b['start'])} --> {fmt_ts(off + b['end'] + 0.2)}\n{text}\n")
                n += 1
        off += s["frames"] / FPS
    open(path, "w", encoding="utf-8").write("\n".join(out))


# ------------------------------------------------------------------ main
def main(plan_path, out_dir):
    rep = Reporter()
    t_start = time.time()
    try:
        os.makedirs(out_dir, exist_ok=True)
        parts = os.path.join(out_dir, "parts")
        os.makedirs(parts, exist_ok=True)
        raw = json.load(open(plan_path))
        if raw.get("style") == "explainer" or raw.get("explainer"):
            import explainer
            explainer.FFMPEG = FFMPEG
            res = explainer.run_job(raw, out_dir, rep)
            rep.set("encode", 100, f"Done in {time.time() - t_start:.0f}s")
            rep.done({"ok": True, "duration": res["duration"], "render_seconds": round(time.time() - t_start, 1),
                      "files": {"video": res["video"], "thumb": res["thumb"], "srt": res["srt"]}})
            return
        plan = normalize_plan(raw)
        ctx = ctx_for(plan)
        rep.set("voice", 2, "Warming up the voice")
        audio = make_voice(plan, rep)
        tl = build_timeline(plan, audio)
        total_frames = sum(s["frames"] for s in tl)

        # per-scene narration (24k) for lip-sync envelope
        envs = []
        nar24 = []
        for si, s in enumerate(tl):
            a = np.zeros(s["frames"] * SPF24, np.float32)
            for b, w in zip(s["beats"], audio[si]):
                st = int(b["start"] * 24000)
                w = w[: max(0, len(a) - st)]
                a[st: st + len(w)] += w
            nar24.append(a)
            envs.append(envelope(a, s["frames"]))

        rep.set("render", 32, f"Animating {len(tl)} scenes ({total_frames / FPS:.0f}s)")
        counter = Value("i", 0)
        ncpu = max(1, (os.cpu_count() or 2))
        workers = max(1, min(len(tl), ncpu))
        jobs = [(plan, si, tl[si], envs[si], os.path.join(parts, f"s{si:03d}.mp4")) for si in range(len(tl))]
        # longest scenes first for better packing
        jobs.sort(key=lambda j: -j[2]["frames"])
        with Pool(workers, initializer=_init, initargs=(counter,)) as pool:
            res = pool.map_async(render_scene, jobs, chunksize=1)
            while not res.ready():
                res.wait(3)
                done = counter.value
                rep.set("render", 32 + 55 * done / max(1, total_frames),
                        f"Animating frames {min(done, total_frames)}/{total_frames}")
            res.get()

        rep.set("audio", 88, "Mixing voice, sound effects and music")
        sr = AU.SR
        total = total_frames * SPF48
        voice = np.zeros(total, np.float32)
        fx = np.zeros(total, np.float32)
        off = 0
        for si, s in enumerate(tl):
            v48 = resample_poly(nar24[si], 2, 1).astype(np.float32)
            AU.mix_at(voice, v48, off)
            spec = plan["scenes"][si]
            sc = SCENE_TYPES[spec["type"]](ctx, spec, s["beats"], si, s["frames"], scene_bg(ctx, si, spec))
            if si > 0 and plan.get("sfx", True):
                AU.mix_at(fx, AU.sfx("whoosh", 0.8), off - int(0.15 * sr))
            for (t, kind, p) in sc.sfx_list:
                AU.mix_at(fx, AU.sfx(kind, p), off + int(t * sr))
            off += s["frames"] * SPF48
        mix = voice + fx * 0.9
        style = plan.get("music", "none")
        if style in ("cheerful", "calm"):
            m = AU.music(total, style)
            hop = 480
            e = np.sqrt(np.convolve(voice ** 2, np.ones(hop) / hop, "same")[::hop])
            act = (e > 0.01).astype(np.float32)
            sm = np.zeros_like(act)
            for i in range(len(act)):
                prev = sm[i - 1] if i else 0
                sm[i] = prev + (act[i] - prev) * (0.35 if act[i] > prev else 0.04)
            g = 0.30 - 0.18 * np.repeat(sm, hop)[:total]
            if len(g) < total:
                g = np.pad(g, (0, total - len(g)), constant_values=g[-1] if len(g) else 0.3)
            fade = np.ones(total, np.float32)
            fn = min(total, int(2.5 * sr))
            fade[-fn:] = np.linspace(1, 0, fn)
            fi = min(total, int(0.8 * sr))
            fade[:fi] = np.linspace(0, 1, fi)
            mix = mix + m * g * fade * (0.8 if style == "calm" else 1.0)
        mix /= max(1e-6, float(np.abs(mix).max())) / 0.9
        wav = os.path.join(out_dir, "mix.wav")
        sf.write(wav, mix, sr)

        rep.set("encode", 93, "Joining scenes and adding sound")
        lst = os.path.join(out_dir, "list.txt")
        with open(lst, "w") as f:
            for si in range(len(tl)):
                f.write(f"file '{os.path.join(parts, f's{si:03d}.mp4')}'\n")
        vonly = os.path.join(out_dir, "video_only.mp4")
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy",
                        vonly], check=True)
        final = os.path.join(out_dir, "video.mp4")
        tmp = final.replace(".mp4", ".tmp.mp4")
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", vonly, "-i", wav, "-map", "0:v", "-map", "1:a",
                        "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                        "-ar", "48000", "-shortest", "-movflags", "+faststart", tmp], check=True)
        os.replace(tmp, final)
        thumb = os.path.join(out_dir, "thumb.jpg")
        make_thumb(plan, ctx, thumb)
        srt = os.path.join(out_dir, "captions.srt")
        write_srt(plan, tl, srt)
        dur = total_frames / FPS
        timings = []
        off = 0.0
        for si, s in enumerate(tl):
            timings.append({"scene": si, "start": round(off, 2), "duration": round(s["frames"] / FPS, 2)})
            off += s["frames"] / FPS
        json.dump({"duration": dur, "scenes": timings, "render_seconds": round(time.time() - t_start, 1)},
                  open(os.path.join(out_dir, "meta.json"), "w"))
        rep.set("encode", 100, f"Done in {time.time() - t_start:.0f}s")
        rep.done({"ok": True, "duration": round(dur, 2), "render_seconds": round(time.time() - t_start, 1),
                  "files": {"video": final, "thumb": thumb, "srt": srt}})
    except Exception as e:
        tb = traceback.format_exc()
        print(tb, flush=True)
        rep.done({"ok": False, "error": f"{type(e).__name__}: {e}", "trace": tb[-1500:]})
        sys.exit(1)


def stills(plan_path, out_dir):
    """Debug: render a few frames per scene + thumbnail without encoding."""
    os.makedirs(out_dir, exist_ok=True)
    plan = normalize_plan(json.load(open(plan_path)))
    ctx = ctx_for(plan)
    audio = make_voice(plan, Reporter())
    tl = build_timeline(plan, audio)
    for si, s in enumerate(tl):
        spec = plan["scenes"][si]
        sc = SCENE_TYPES[spec["type"]](ctx, spec, s["beats"], si, s["frames"], scene_bg(ctx, si, spec))
        env = np.zeros(s["frames"])
        for frac in (0.55, 0.97):
            i = int((s["frames"] - 1) * frac)
            compose(sc, i, env, ctx).save(os.path.join(out_dir, f"s{si:02d}_{spec['type']}_{int(frac*100)}.jpg"),
                                          quality=85)
    make_thumb(plan, ctx, os.path.join(out_dir, "thumb.jpg"))
    print("total seconds", sum(s["frames"] for s in tl) / FPS)


if __name__ == "__main__":
    if sys.argv[1] == "--stills":
        stills(sys.argv[2], sys.argv[3])
    else:
        main(sys.argv[1], sys.argv[2])
