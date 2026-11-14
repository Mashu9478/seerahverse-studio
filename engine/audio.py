"""Sound effects, procedural background music and final mix."""
import numpy as np
from scipy.signal import butter, lfilter

SR = 48000
rng = np.random.default_rng(7)


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def tone(freq, dur, tau, partials=((1, 1.0),), attack=0.004):
    n = int(dur * SR)
    t = np.arange(n) / SR
    y = sum(a * np.sin(2 * np.pi * freq * m * t) for m, a in partials)
    e = env_exp(n, tau)
    at = int(attack * SR)
    e[:at] *= np.linspace(0, 1, at)
    return (y * e).astype(np.float32)


def sweep(f0, f1, dur, tau):
    n = int(dur * SR)
    f = np.geomspace(f0, f1, n)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * env_exp(n, tau) * np.minimum(1, np.arange(n) / 80)).astype(np.float32)


def mix_at(dst, src, i):
    if i < 0:
        src, i = src[-i:], 0
    m = min(len(src), len(dst) - i)
    if m > 0:
        dst[i:i + m] += src[:m]


def sfx(kind, p=1.0):
    if kind == "pop":
        return 0.35 * p * sweep(500, 1100, 0.09, 0.03)
    if kind == "blip":
        return 0.22 * tone(660 * p, 0.16, 0.05, ((1, 1), (2, 0.25)))
    if kind == "ding":
        a = tone(1046.5, 1.2, 0.35, ((1, 1), (2.0, 0.3), (3.0, 0.12)))
        b = tone(1318.5, 1.4, 0.4, ((1, 1), (2.0, 0.3), (3.0, 0.12)))
        out = np.zeros(int(1.6 * SR), np.float32)
        mix_at(out, a, 0)
        mix_at(out, b, int(0.11 * SR))
        return 0.22 * out
    if kind == "sparkle":
        out = np.zeros(int(1.2 * SR), np.float32)
        for k, f in enumerate([1568, 1760, 2093, 2349, 2637, 3136]):
            mix_at(out, tone(f, 0.5, 0.12, ((1, 1), (2, 0.2))), int(k * 0.045 * SR))
        return 0.11 * out
    if kind == "tick":
        n = int(0.05 * SR)
        y = tone(1900, 0.05, 0.008) + 0.3 * rng.standard_normal(n).astype(np.float32) * env_exp(n, 0.004)
        return 0.25 * y
    if kind == "whoosh":
        n = int(0.5 * SR)
        x = rng.standard_normal(n).astype(np.float32)
        b, a = butter(2, [400 / (SR / 2), 3000 / (SR / 2)], "band")
        x = lfilter(b, a, x).astype(np.float32)
        e = np.sin(np.linspace(0, np.pi, n)) ** 2
        return 0.12 * p * x * e
    if kind == "plop":
        return 0.3 * sweep(280 * p, 850 * p, 0.11, 0.04)
    if kind == "buzz":
        out = np.zeros(int(0.5 * SR), np.float32)
        for k, f in enumerate([392, 330]):
            y = tone(f, 0.22, 0.12, ((1, 1), (3, 0.25), (5, 0.1)), attack=0.01)
            mix_at(out, y, int(k * 0.16 * SR))
        return 0.14 * out
    if kind == "fanfare":
        out = np.zeros(int(1.6 * SR), np.float32)
        notes = [(523.3, 0.0, 0.25), (659.3, 0.12, 0.25), (784.0, 0.24, 0.25), (1046.5, 0.36, 0.7)]
        for f, st, du in notes:
            y = tone(f, du + 0.5, du * 0.8, ((1, 1), (2, 0.5), (3, 0.3), (4, 0.15)), attack=0.012)
            mix_at(out, y, int(st * SR))
        return 0.13 * out
    raise ValueError(kind)


def pluck(freq, dur, decay=0.996):
    n = int(dur * SR)
    p = int(SR / freq)
    buf = rng.uniform(-1, 1, p).astype(np.float32)
    out = np.empty(n, np.float32)
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = decay * 0.5 * (buf[i % p] + buf[(i + 1) % p])
    return out


def music(total_n, style="cheerful"):
    calm = style == "calm"
    bpm = 72 if calm else 100
    beat = 60 / bpm
    chords = [[261.6, 329.6, 392.0, 523.3], [220.0, 261.6, 329.6, 440.0],
              [174.6, 220.0, 261.6, 349.2], [196.0, 246.9, 293.7, 392.0]]
    bars = len(chords)
    loop_n = int(bars * 4 * beat * SR)
    loop = np.zeros(loop_n + SR, np.float32)
    cache = {}

    def pl(f, d):
        k = (round(f, 1), d)
        if k not in cache:
            cache[k] = pluck(f, d)
        return cache[k]
    pattern = [0, 1, 2, 3, 2, 1, 2, 3]
    if calm:
        chords = [[261.6, 329.6, 392.0, 493.9], [220.0, 261.6, 329.6, 392.0],
                  [174.6, 220.0, 261.6, 329.6], [196.0, 246.9, 293.7, 349.2]]
    for b, ch in enumerate(chords):
        for e in range(0, 8, 2 if calm else 1):
            st = int((b * 4 + e * 0.5) * beat * SR)
            mix_at(loop, 0.22 * pl(ch[pattern[e]], 0.6), st)
        for q in (0, 2):
            st = int((b * 4 + q) * beat * SR)
            mix_at(loop, 0.28 * tone(ch[0] / 2, 1.2, 0.35, ((1, 1), (2, 0.3)), attack=0.01), st)
    head = loop[:loop_n].copy()
    head[: SR // 1] += 0  # seamless enough; tail carried over below
    head[: len(loop) - loop_n] += loop[loop_n:]
    reps = total_n // loop_n + 2
    out = np.tile(head, reps)[:total_n]
    b, a = butter(2, 4500 / (SR / 2))
    return lfilter(b, a, out).astype(np.float32)


