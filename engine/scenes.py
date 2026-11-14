"""Scene types for the general video engine (landscape 1920x1080 and portrait 1080x1920)."""
import math, random
from PIL import Image, ImageDraw, ImageFilter
from core import *


class Scene:
    owl_corner = True
    decor = "circle"

    def __init__(self, ctx, spec, beats, si, frames, bg):
        self.ctx, self.spec, self.beats, self.si = ctx, spec, beats, si
        self.W, self.H, self.P = ctx["W"], ctx["H"], ctx["portrait"]
        self.frames = frames
        self.dur = frames / FPS
        self.bgpair = bg
        self.shadow = shade(bg[1], 0.86)[:3]
        self.sfx_list = []
        rnd = random.Random(si * 7 + 1)
        self.decor_items = [(rnd.uniform(0, self.W), rnd.uniform(0, self.H), rnd.choice([44, 60, 80, 100]),
                             rnd.uniform(0, 6.28), rnd.choice(["circle", "star"]) if self.decor == "mix" else self.decor)
                            for _ in range(11)]
        self.bgimg = self.make_bg()
        self.setup()

    # ---------------------------------------------------------- layout
    @property
    def cx(self):
        return self.W / 2

    @property
    def head_y(self):
        return 235 if self.P else 120

    @property
    def top(self):
        return 360 if self.P else 230

    @property
    def bottom(self):
        return 1250 if self.P else 880

    @property
    def maxw(self):
        return 960 if self.P else 1500

    # ---------------------------------------------------------- timing
    def bt(self, i):
        if not self.beats:
            return 0.5
        i = max(0, min(int(i), len(self.beats) - 1))
        return self.beats[i]["start"]

    def be(self, i):
        i = max(0, min(int(i), len(self.beats) - 1))
        return self.beats[i]["end"]

    def at(self, el, default=None):
        if isinstance(el, dict) and el.get("at") is not None:
            i = max(0, min(int(el["at"]), len(self.beats) - 1))
            b = self.beats[i]
            wd = el.get("word")
            if wd:
                k = b["say"].lower().find(str(wd).lower())
                if k >= 0:
                    return b["start"] + (b["end"] - b["start"]) * k / max(1, len(b["say"]))
            return b["start"] + 0.1
        return default if default is not None else 0.45

    def sfx(self, t, kind, p=1.0):
        if self.ctx.get("sfx", True):
            self.sfx_list.append((t, kind, p))

    def setup(self):
        pass

    # ---------------------------------------------------------- drawing
    def make_bg(self):
        img = gradient(self.W, self.H, *self.bgpair).convert("RGBA")
        lay = Image.new("RGBA", (self.W, self.H), (0, 0, 0, 0))
        dd = ImageDraw.Draw(lay)
        rnd = random.Random(self.si)
        for _ in range(4):
            x, y, r = rnd.uniform(0, self.W), rnd.uniform(0, self.H), rnd.uniform(200, 380)
            dd.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, 50))
        lay = lay.filter(ImageFilter.GaussianBlur(40))
        img.alpha_composite(lay)
        self.bg_extra(img)
        return img.convert("RGB")

    def bg_extra(self, img):
        pass

    def draw_decor(self, fr, t):
        for (x, y, sz, ph, kind) in self.decor_items:
            yy = (y - t * 18) % (self.H + 120) - 60
            xx = x + 25 * math.sin(t * 0.6 + ph)
            put(fr, bubble(sz, kind), xx, yy)

    def heading(self, d, text, t, t0=0.2, color=INK, size=None):
        size = size or (74 if self.P else 84)
        TB(d, strip_emoji(text), self.cx, self.head_y, self.maxw, size, color, 700, stroke=8,
           max_lines=2, scale=pop(t, t0))

    def owl_state(self, t):
        if not self.owl_corner:
            return None
        if self.P:
            return dict(pos=(150, 1330), scale=0.62, wave=False)
        return dict(pos=(1765, 905), scale=0.8, wave=False)

    def draw(self, fr, d, t):
        pass


# ======================================================================= TITLE
class TitleScene(Scene):
    owl_corner = False
    decor = "star"

    def setup(self):
        s = self.spec
        self.title = strip_emoji(s.get("title") or self.ctx["plan"].get("title", ""))
        self.sub = strip_emoji(s.get("subtitle", ""))
        self.emojis = (s.get("emojis") or [])[:4]
        self.t0 = self.bt(min(1, len(self.beats) - 1)) if len(self.beats) > 1 else 0.6
        words = self.title.split()
        self.t_words = [self.t0 + k * 0.09 for k in range(len(words))]
        self.sfx(self.t0, "sparkle")
        for k, tw in enumerate(self.t_words):
            self.sfx(tw, "blip", 1 + k * 0.08)
        self.t_em = self.t0 + 0.6 + 0.09 * len(words)
        for k in range(len(self.emojis)):
            self.sfx(self.t_em + k * 0.2, "pop")

    def owl_state(self, t):
        wave = t < self.be(0) + 0.3 or t > self.dur - 2.0
        if self.P:
            return dict(pos=(540, 1110), scale=1.1, wave=wave)
        return dict(pos=(430, 620), scale=1.45, wave=wave)

    def draw(self, fr, d, t):
        ch = self.ctx["brand"].get("channel") or ""
        pill(d, ch, self.cx, 80 if not self.P else 150, 34, "#7B5CD6", scale=pop(t, 0.2), maxw=900)
        solo = not self.ctx.get("mascot", True)
        cx = (960 if solo else 1230) if not self.P else 540
        maxw = (1500 if solo else 1250) if not self.P else 960
        words = self.title.split() or [""]
        size = 150 if not self.P else 120
        lines, size = fit_lines(self.title, maxw, size, 3, 700)
        lh = size * 1.12
        y0 = (400 if not self.P else 470) - lh * (len(lines) - 1) / 2
        f = font(size, 700)
        wi = 0
        for li, line in enumerate(lines):
            ws = line.split()
            widths = [f.getlength(w) for w in ws]
            space = f.getlength(" ")
            x = cx - (sum(widths) + space * (len(ws) - 1)) / 2
            for w, wd in zip(ws, widths):
                sc = pop(t, self.t_words[min(wi, len(self.t_words) - 1)], 0.45)
                if sc > 0:
                    y = y0 + li * lh + 10 * math.sin(2 * math.pi * t * 0.9 + wi * 0.7)
                    c = ACCENTS[(wi * 3 + 1) % len(ACCENTS)]
                    T(d, w, x + wd / 2 + 7, y + 9, size, "#5B3FB3", 700, stroke=12, sf="#5B3FB3", scale=sc)
                    T(d, w, x + wd / 2, y, size, c, 700, stroke=10, scale=sc)
                x += wd + space
                wi += 1
        burst(fr, cx, y0 + lh * (len(lines) - 1) / 2, t, self.t0 + 0.3, n=12, dist=420 if not self.P else 380,
              size=56)
        ys = y0 + lh * len(lines) + (40 if not self.P else 50)
        if self.sub:
            TB(d, self.sub, cx, ys, maxw, 54 if not self.P else 50, INK, 600, stroke=6, scale=pop(t, self.t0 + 0.7))
        ye = ys + (130 if not self.P else 150)
        n = len(self.emojis)
        es = 130 if not self.P else 130
        for k, e in enumerate(self.emojis):
            x = cx + (k - (n - 1) / 2) * (es + 50)
            put(fr, emoji(e, es), x, ye + 10 * math.sin(t * 3 + k), pop(t, self.t_em + k * 0.2))


# ======================================================================= CONCEPT
class ConceptScene(Scene):
    def setup(self):
        s = self.spec
        self.points = (s.get("points") or [])[:4]
        self.tp = [self.at(p, self.bt(min(k, len(self.beats) - 1)) + 0.2) for k, p in enumerate(self.points)]
        for tt in self.tp:
            self.sfx(tt, "pop")

    def draw(self, fr, d, t):
        s = self.spec
        self.heading(d, s.get("heading", ""), t)
        e = s.get("emoji")
        if self.P:
            ex, ey, es = 540, 560, 300
        else:
            ex, ey, es = 470, 540, 320
        r = es * 0.68
        sc = pop(t, 0.35)
        if sc > 0:
            d.ellipse((ex - r * sc, ey - r * sc + 14, ex + r * sc, ey + r * sc + 14), fill=self.shadow)
            d.ellipse((ex - r * sc, ey - r * sc, ex + r * sc, ey + r * sc), fill=(255, 255, 255),
                      outline=col("#E3DAFF"), width=6)
            if e:
                put(fr, emoji(e, es), ex, ey + 10 * math.sin(t * 2.2), sc)
        n = len(self.points)
        for k, p in enumerate(self.points):
            sc = pop(t, self.tp[k])
            if not sc:
                continue
            c = ACCENTS[(k * 2 + 5) % len(ACCENTS)]
            if self.P:
                x0, y, maxw, size = 110, 860 + k * 115, 830, 46
            else:
                y = 540 + (k - (n - 1) / 2) * 135
                x0, maxw, size = 870, 800, 52
            rr = 34 * sc
            d.ellipse((x0 - rr, y - rr, x0 + rr, y + rr), fill=col(c))
            T(d, str(k + 1), x0, y + 2, 40, "#FFFFFF", 700, scale=sc)
            lines, sz = fit_lines(strip_emoji(p.get("text", "")), maxw, size, 2, 600)
            lh = sz * 1.15
            for i, l in enumerate(lines):
                T(d, l, x0 + 60, y - lh * (len(lines) - 1) / 2 + i * lh, sz, INK, 600, anchor="lm", scale=sc)


# ======================================================================= OBJECTS
class ObjectsScene(Scene):
    def setup(self):
        s = self.spec
        self.groups = (s.get("groups") or [])[:3]
        self.items = []  # (group index, item index)
        for gi, g in enumerate(self.groups):
            n = max(1, min(20, int(g.get("count", 1))))
            g["count"] = n
            tg = self.at(g, self.bt(min(gi, len(self.beats) - 1)) + 0.3)
            g["_t"] = tg
            for k in range(n):
                self.items.append((gi, k, tg + k * min(0.12, 1.2 / n)))
                self.sfx(tg + k * min(0.12, 1.2 / n), "pop", 0.6)
        cb = s.get("count_beats")
        self.count_t = {}
        if cb and self.beats:
            start = int(cb.get("start", 0))
            step = max(1, int(cb.get("step", 1)))
            idx = 0
            for b in range(start, len(self.beats)):
                if idx >= len(self.items):
                    break
                for j in range(step):
                    if idx < len(self.items):
                        self.count_t[idx] = self.beats[b]["start"]
                        idx += 1
                self.sfx(self.beats[b]["start"], "blip", 1 + (b - start) * 0.05)
        eqs = s.get("equation") or {}
        self.eq_text = strip_emoji(eqs.get("text", "")) if isinstance(eqs, dict) else ""
        self.t_eq = self.at(eqs, self.bt(len(self.beats) - 1)) if self.eq_text else None
        if self.t_eq:
            self.sfx(self.t_eq + 0.6, "ding")
        self.layout()

    def layout(self):
        per_row = 5 if self.P else 10
        rows = []
        for gi, g in enumerate(self.groups):
            n = g["count"]
            for r0 in range(0, n, per_row):
                rows.append((gi, list(range(r0, min(n, r0 + per_row)))))
        top, bottom = (self.top + 20, 1080) if self.P else (self.top + 10, 700)
        avail_h = bottom - top
        nrows = max(1, len(rows))
        gaps = (len(self.groups) - 1) * 40
        size = min(150 if self.P else 120, (avail_h - gaps) / nrows - 16, (self.maxw - 180) / per_row - 14)
        size = max(46, int(size))
        self.size = size
        self.pos = {}
        y = top + size / 2 + (avail_h - (nrows * (size + 16) + gaps)) / 2
        last_g = None
        self.label_pos = {}
        x0c = self.cx + (40 if not self.P else 30)
        for gi, idxs in rows:
            if last_g is not None and gi != last_g:
                y += 40
            n = len(idxs)
            for j, k in enumerate(idxs):
                x = x0c + (j - (min(per_row, self.groups[gi]["count"]) - 1) / 2) * (size + 14)
                self.pos[(gi, k)] = (x, y)
            if gi not in self.label_pos:
                self.label_pos[gi] = (x0c - (min(per_row, self.groups[gi]["count"]) / 2) * (size + 14) - 60, y)
            y += size + 16
            last_g = gi

    def draw(self, fr, d, t):
        s = self.spec
        self.heading(d, s.get("heading", ""), t)
        counted = 0
        last_ct = None
        for idx, (gi, k, tp) in enumerate(self.items):
            g = self.groups[gi]
            x, y = self.pos[(gi, k)]
            ct = self.count_t.get(idx)
            if ct is not None and t >= ct:
                counted = idx + 1
                last_ct = ct
            yy = y - 20 * bump(t, ct, 0.3)
            put(fr, emoji(g.get("emoji", "⭐"), self.size), x, yy, pop(t, tp))
            if ct is not None and t >= ct:
                T(d, str(idx + 1), x, y - self.size / 2 - 18, max(28, self.size * 0.32), "#FF8A1F", 700, stroke=5,
                  scale=pop(t, ct))
        op = s.get("operator")
        for gi, g in enumerate(self.groups):
            lx, ly = self.label_pos[gi]
            c = ACCENTS[(gi * 3 + 5) % len(ACCENTS)]
            sc = pop(t, g["_t"] + 0.6)
            T(d, str(g["count"]), lx, ly, max(56, self.size * 0.75), c, 700, stroke=7, scale=sc)
            if g.get("label"):
                T(d, strip_emoji(g["label"]), lx, ly + max(56, self.size * 0.75) * 0.75, 30, INK, 600, scale=sc)
            if gi > 0 and op:
                T(d, op, lx - 70, ly, 70, INK, 700, stroke=6, scale=sc)
        ey = 1160 if self.P else 800
        if self.eq_text and self.t_eq and t >= self.t_eq - 0.05:
            toks = eq_parts(self.eq_text)
            parts = []
            for i, tk in enumerate(toks):
                is_last = i == len(toks) - 1 and "=" in toks
                c = "#2DBE60" if is_last else (INK if tk in "+-−×x÷=" else ACCENTS[(i * 3 + 5) % len(ACCENTS)])
                parts.append((tk, c, self.t_eq + (0.6 if is_last else i * 0.12)))
            eq(d, parts, self.cx, ey, 120 if not self.P else 110, t, maxw=self.maxw)
            burst(fr, self.cx, ey, t, self.t_eq + 0.6, n=10, dist=240, size=44)
        elif counted:
            T(d, str(counted), self.cx, ey, 130, "#FF8A1F", 700, stroke=10, scale=1 + 0.25 * bump(t, last_ct, 0.3))


# ======================================================================= EQUATION
class EquationScene(Scene):
    def setup(self):
        s = self.spec
        self.a, self.b, self.op = s.get("a", 0), s.get("b", 0), s.get("op", "+")
        self.ans = s.get("answer", "")
        self.t_show = self.at({"at": s.get("show_at", 0)}, 0.5)
        self.t_ans = self.at({"at": s.get("answer_at", max(0, len(self.beats) - 1)), "word": s.get("answer_word")},
                             self.bt(len(self.beats) - 1))
        self.sfx(self.t_show, "pop")
        self.sfx(self.t_ans, "ding")
        self.helpers = []
        e = s.get("emoji")
        try:
            a, b = int(self.a), int(self.b)
        except Exception:
            a = b = 0
        if e and 0 < a <= 10 and 0 <= b <= 10 and self.op in ("+", "-"):
            e2 = "cube-blue" if str(e).startswith("cube") else e
            self.helpers = [(e, a, "#F0453A"), (e2, b, "#2F7DF6")] if self.op == "+" else [(e, a, "#F0453A")]
            for k in range(a + (b if self.op == "+" else 0)):
                self.sfx(self.t_show + 0.4 + k * 0.08, "pop", 0.5)
        self.ib = (a, b)

    def draw(self, fr, d, t):
        s = self.spec
        self.heading(d, s.get("heading", ""), t)
        layout = s.get("layout", "vertical")
        txt = f"{self.a} {self.op} {self.b} = {self.ans}"
        if self.P:
            card(d, (240, 360, 840, 980), outline="#8E5CF0", shadow=self.shadow)
            cx, cy = 540, 670
        else:
            card(d, (380 if self.helpers else 660, 230, 900 if self.helpers else 1260, 830), outline="#8E5CF0",
                 shadow=self.shadow)
            cx, cy = (640 if self.helpers else 960), 530
        if layout == "vertical":
            size = 140
            xr = cx + 110
            vprob(d, xr, cy - size * 1.15, self.a, self.b, self.ans, size, t, op=self.op if self.op != "×" else "×",
                  ca="#F0453A", cb="#2F7DF6", t_ab=self.t_show, t_ans=self.t_ans)
            burst(fr, xr - 60, cy - size * 1.15 + size * 2.48, t, self.t_ans, n=10, dist=180, size=44)
        else:
            parts = [(str(self.a), "#F0453A", self.t_show), (self.op, INK, self.t_show + 0.15),
                     (str(self.b), "#2F7DF6", self.t_show + 0.3), ("=", INK, self.t_ans - 0.1),
                     (str(self.ans), "#2DBE60", self.t_ans)]
            eq(d, parts, cx, cy, 120, t, maxw=480 if self.helpers or self.P else 560)
            burst(fr, cx + 150, cy, t, self.t_ans, n=10, dist=180, size=44)
        if self.helpers:
            a, b = self.ib
            for row, (e, n, c) in enumerate(self.helpers):
                es = 64 if not self.P else 80
                for k in range(n):
                    if self.P:
                        x = 540 + (k % 5 - 2) * (es + 14)
                        y = 1060 + (row * 2 + k // 5) * (es + 14)
                    else:
                        x = 1080 + (k % 5) * (es + 14)
                        y = 380 + row * 220 + (k // 5) * (es + 14)
                    put(fr, emoji(e, es), x, y, pop(t, self.t_show + 0.4 + (row * a + k) * 0.08))
                    if self.op == "-" and k >= n - b and t >= self.t_ans - 0.4:
                        put(fr, badge("x", int(es * 0.6)), x + es * 0.3, y - es * 0.3, pop(t, self.t_ans - 0.4))


# ======================================================================= QUIZ
class QuizScene(Scene):
    def setup(self):
        s = self.spec
        self.kind = s.get("kind", "choice")
        self.opts = [strip_emoji(str(o)) for o in (s.get("options") or [])][:4]
        self.correct = s.get("correct")
        self.think = float(s.get("think_seconds", 3) or 3)
        self.t_q = 0.3
        self.c0 = self.be(0) + 0.1
        self.t_rev = self.bt(1) if len(self.beats) > 1 else self.c0 + self.think
        for j in range(int(self.think)):
            self.sfx(self.c0 + j, "tick")
        self.sfx(self.t_rev, "ding")
        self.sfx(self.t_rev + 0.05, "sparkle")
        for k in range(len(self.opts)):
            self.sfx(0.6 + k * 0.15, "pop", 0.6)

    def draw(self, fr, d, t):
        s = self.spec
        pill(d, "Quiz Time!", self.cx, 90 if not self.P else 200, 40, "#E64BA6", scale=pop(t, 0.1))
        qy = 210 if not self.P else 360
        TB(d, strip_emoji(s.get("question", "")), self.cx, qy, self.maxw - 100, 66 if not self.P else 60, INK, 700,
           stroke=6, max_lines=3, scale=pop(t, 0.25))
        revealed = t >= self.t_rev
        if self.kind == "choice" and self.opts:
            try:
                ci = int(self.correct)
            except Exception:
                ci = 0
            n = len(self.opts)
            for k, o in enumerate(self.opts):
                sc = pop(t, 0.6 + k * 0.15)
                if not sc:
                    continue
                if self.P:
                    bw, bh = 840, 150
                    x, y = 540, 620 + k * 185
                else:
                    bw, bh = 640, 170
                    x = self.cx + (-345 if k % 2 == 0 else 345) if n > 2 else self.cx + (-345 if k == 0 else 345)
                    y = (440 if k < 2 else 650) if n > 2 else 540
                c = ACCENTS[(k * 2 + 1) % len(ACCENTS)]
                fill, txt = col(c), "#FFFFFF"
                if revealed:
                    if k == ci:
                        fill = col("#2DBE60")
                    else:
                        fill, txt = (225, 221, 232), "#8D86A0"
                g = 1 + (0.05 * (1 + math.sin(t * 6)) / 2 if revealed and k == ci else 0)
                w2, h2 = bw / 2 * sc * g, bh / 2 * sc * g
                d.rounded_rectangle((x - w2, y - h2 + 10, x + w2, y + h2 + 10), radius=36, fill=shade(fill + (255,), 0.75)[:3])
                d.rounded_rectangle((x - w2, y - h2, x + w2, y + h2), radius=36, fill=fill, outline=(255, 255, 255),
                                    width=6)
                lx = x - w2 + 60 * sc
                d.ellipse((lx - 34 * sc, y - 34 * sc, lx + 34 * sc, y + 34 * sc), fill=(255, 255, 255))
                T(d, "ABCD"[k], lx, y + 2, 40, c if not revealed or k == ci else "#8D86A0", 700, scale=sc)
                TB(d, o, x + 30 * sc, y, bw - 170, 52, txt, 700, max_lines=2, scale=sc)
                if revealed and k == ci:
                    put(fr, badge("check", 84), x + w2 - 30, y - h2 + 10, pop(t, self.t_rev))
            if revealed:
                burst(fr, self.cx, 540 if not self.P else 900, t, self.t_rev, n=12, dist=500, size=50)
        else:
            y = 560 if not self.P else 820
            r = 150
            d.rounded_rectangle((self.cx - 220, y - r, self.cx + 220, y + r), radius=50, fill=(255, 255, 255),
                                outline=col("#8E5CF0"), width=8)
            if revealed:
                TB(d, strip_emoji(str(self.correct)), self.cx, y, 400, 140, "#2DBE60", 700, max_lines=1,
                   scale=pop(t, self.t_rev))
                burst(fr, self.cx, y, t, self.t_rev, n=12, dist=320, size=50)
            else:
                T(d, "?", self.cx, y - 10 * abs(math.sin(t * 3.5)), 160, "#8E5CF0", 700)
        if self.c0 <= t < self.c0 + self.think:
            u = t - self.c0
            rx, ry = ((1600, 560) if not self.P else (880, 1180)) if self.kind != "choice" else \
                ((1700, 210) if not self.P else (900, 1200))
            ring(fr, rx, ry, 80, u % 1.0, "#FF8A1F", int(self.think) - int(u))


# ======================================================================= STEPS
class StepsScene(Scene):
    def setup(self):
        self.steps = (self.spec.get("steps") or [])[:5]
        self.ts = [self.at(st, self.bt(min(k, len(self.beats) - 1)) + 0.2) for k, st in enumerate(self.steps)]
        for tt in self.ts:
            self.sfx(tt, "pop")

    def draw(self, fr, d, t):
        self.heading(d, self.spec.get("heading", ""), t)
        n = max(1, len(self.steps))
        for k, st in enumerate(self.steps):
            sc = pop(t, self.ts[k])
            c = ACCENTS[(k * 2 + 1) % len(ACCENTS)]
            if self.P:
                y = self.top + 40 + k * (880 / n)
                h = min(160, 880 / n - 30)
                box = (90, y, 990, y + h)
                ex, ey = 200, y + h / 2
                if sc:
                    card(d, box, outline=c, shadow=self.shadow, width=6, r=30)
                    put(fr, emoji(st.get("emoji", "⭐"), int(h * 0.7)), ex, ey, sc)
                    d.ellipse((90 - 26, y - 20, 90 + 26, y + 32), fill=col(c))
                    T(d, str(k + 1), 90, y + 6, 34, "#FFFFFF", 700)
                    TB(d, strip_emoji(st.get("text", "")), 620, ey, 620, 46, INK, 600, max_lines=2, scale=sc)
                if k < n - 1 and t >= self.ts[k] + 0.3:
                    put(fr, arrow(50, c, True), 540, y + h + 15, 0.6)
            else:
                cw = min(330, (1700 - (n - 1) * 60) / n)
                x0 = self.cx - (n * cw + (n - 1) * 60) / 2 + k * (cw + 60)
                box = (x0, 300, x0 + cw, 760)
                if sc:
                    card(d, box, outline=c, shadow=self.shadow, width=6, r=30)
                    put(fr, emoji(st.get("emoji", "⭐"), int(min(170, cw * 0.6))), x0 + cw / 2, 440, sc)
                    d.ellipse((x0 + 20, 320, x0 + 80, 380), fill=col(c))
                    T(d, str(k + 1), x0 + 50, 352, 38, "#FFFFFF", 700)
                    TB(d, strip_emoji(st.get("text", "")), x0 + cw / 2, 640, cw - 40, 44, INK, 600, max_lines=3,
                       scale=sc)
                if k < n - 1 and t >= self.ts[k] + 0.3:
                    put(fr, arrow(70, c), x0 + cw + 30, 530, pop(t, self.ts[k] + 0.3))


# ======================================================================= COMPARE
class CompareScene(Scene):
    def setup(self):
        s = self.spec
        self.cols = [s.get("left") or {}, s.get("right") or {}]
        self.items = []
        for ci, c in enumerate(self.cols):
            for k, it in enumerate((c.get("items") or [])[:6]):
                tt = self.at(it, 0.8 + ci * 0.5 + k * 0.3)
                self.items.append((ci, k, it, tt))
                self.sfx(tt, "pop")

    def draw(self, fr, d, t):
        self.heading(d, self.spec.get("heading", ""), t)
        colors = ["#2F7DF6", "#E64BA6"]
        for ci, c in enumerate(self.cols):
            if self.P:
                x0, x1, y0, y1 = (60, 525, 360, 1240) if ci == 0 else (555, 1020, 360, 1240)
            else:
                x0, x1, y0, y1 = (240, 900, 220, 860) if ci == 0 else (1020, 1680, 220, 860)
            sc = pop(t, 0.3 + ci * 0.2)
            if not sc:
                continue
            card(d, (x0, y0, x1, y1), fill=shade(colors[ci], 1.9)[:3], outline=colors[ci], shadow=self.shadow)
            mx = (x0 + x1) / 2
            put(fr, emoji(c.get("emoji", "⭐"), 90), mx, y0 + 70, sc)
            TB(d, strip_emoji(c.get("title", "")), mx, y0 + 160, x1 - x0 - 40, 50, colors[ci], 700, max_lines=1,
               scale=sc)
        for (ci, k, it, tt) in self.items:
            sc = pop(t, tt)
            if not sc:
                continue
            if self.P:
                x0, x1, y0 = (60, 525, 360) if ci == 0 else (555, 1020, 360)
                y = y0 + 260 + k * 150
                es = 90
            else:
                x0, x1, y0 = (240, 900, 220) if ci == 0 else (1020, 1680, 220)
                y = y0 + 250 + k * 100 if len(self.cols[ci].get("items") or []) > 3 else y0 + 270 + k * 125
                es = 80
            txt = strip_emoji(it.get("text", ""))
            if txt:
                put(fr, emoji(it.get("emoji", "⭐"), es), x0 + 80, y, sc)
                lines, sz = fit_lines(txt, x1 - x0 - 170, 44, 2)
                for i, l in enumerate(lines):
                    T(d, l, x0 + 140, y - sz * 0.58 * (len(lines) - 1) + i * sz * 1.15, sz, INK, 600, anchor="lm",
                      scale=sc)
            else:
                put(fr, emoji(it.get("emoji", "⭐"), es), (x0 + x1) / 2, y, sc)


# ======================================================================= STORY
class StoryScene(Scene):
    def bg_extra(self, img):
        dd = ImageDraw.Draw(img)
        if self.P:
            dd.ellipse((-400, 1150, 1480, 2300), fill=col("#9BD67A"))
        else:
            dd.ellipse((-400, 690, 2320, 1700), fill=col("#9BD67A"))

    def setup(self):
        s = self.spec
        self.chars = (s.get("characters") or [])[:3]
        self.props = (s.get("props") or [])[:4]
        self.pt = []
        for pi, p in enumerate(self.props):
            tt = self.at(p, 0.8 + pi)
            n = max(1, min(12, int(p.get("count", 1))))
            p["count"] = n
            for k in range(n):
                self.pt.append((pi, k, tt + k * 0.12))
                self.sfx(tt + k * 0.12, "pop", 0.6)
        eqs = s.get("equation")
        self.eq_text = strip_emoji(eqs.get("text", "")) if isinstance(eqs, dict) else ""
        self.t_eq = self.at(eqs, self.bt(len(self.beats) - 1)) if self.eq_text else None
        if self.t_eq:
            self.sfx(self.t_eq + 0.5, "ding")

    def draw(self, fr, d, t):
        s = self.spec
        if self.eq_text and self.t_eq and t >= self.t_eq - 0.05:
            toks = eq_parts(self.eq_text)
            parts = [(tk, "#2DBE60" if i == len(toks) - 1 else (INK if tk in "+-−×x÷=" else "#8E5CF0"),
                      self.t_eq + i * 0.15) for i, tk in enumerate(toks)]
            bw = 760 if self.P else 900
            d.rounded_rectangle((self.cx - bw / 2, self.head_y - 70, self.cx + bw / 2, self.head_y + 70), radius=36,
                                fill=(255, 255, 255), outline=col(INK), width=5)
            eq(d, parts, self.cx, self.head_y, 96, t, stroke=0, maxw=bw - 60)
        else:
            self.heading(d, s.get("heading", ""), t)
        n = len(self.chars)
        for k, c in enumerate(self.chars):
            side = c.get("side")
            if self.P:
                x = {"left": 230, "right": 850, "center": 540}.get(side, 230 + k * 310)
                y, es = 1080, 240
            else:
                x = {"left": 330, "right": 1430, "center": 960}.get(side, 330 + k * 550)
                y, es = 630, 300
            sc = pop(t, 0.3 + k * 0.2)
            put(fr, emoji(c.get("emoji", "🙂"), es), x, y + 5 * math.sin(t * 2.4 + k), sc)
            if c.get("name"):
                pill(d, strip_emoji(c["name"]), x, y + es / 2 + 40, 40, ACCENTS[(k * 3 + 6) % len(ACCENTS)], scale=sc)
        # props cluster in the middle
        allp = len(self.pt)
        per_row = 4 if self.P else 6
        ps = 96 if self.P else 100
        cy0 = 520 if self.P else 380
        cxm = self.cx
        for idx, (pi, k, tt) in enumerate(self.pt):
            r, cc = divmod(idx, per_row)
            nrow = min(per_row, allp - r * per_row)
            x = cxm + (cc - (nrow - 1) / 2) * (ps + 12)
            y = cy0 + r * (ps + 12)
            put(fr, emoji(self.props[pi].get("emoji", "⭐"), ps), x, y - 12 * bump(t, tt, 0.3), pop(t, tt))


# ======================================================================= FACT
class FactScene(Scene):
    decor = "star"

    def setup(self):
        self.sfx(0.4, "sparkle")

    def draw(self, fr, d, t):
        s = self.spec
        pill(d, strip_emoji(s.get("heading") or "Did you know?"), self.cx, self.head_y, 52, "#FF8A1F",
             scale=pop(t, 0.2))
        if self.P:
            box, ex, ey, ty = (80, 360, 1000, 1220), 540, 570, 960
        else:
            box, ex, ey, ty = (260, 220, 1660, 860), 560, 540, 540
        card(d, box, outline="#FFC21A", shadow=self.shadow, width=8)
        put(fr, star(size=70), box[0] + 40, box[1] + 40, pop(t, 0.5))
        put(fr, star(size=50), box[2] - 40, box[3] - 40, pop(t, 0.7))
        e = s.get("emoji")
        if e:
            put(fr, emoji(e, 280 if not self.P else 300), ex, ey + 12 * math.sin(t * 2), pop(t, 0.4))
        if self.P:
            TB(d, strip_emoji(s.get("text", "")), 540, ty, 820, 58, INK, 600, max_lines=5, scale=pop(t, 0.8))
        else:
            TB(d, strip_emoji(s.get("text", "")), 1170, ty, 820, 60, INK, 600, max_lines=5, scale=pop(t, 0.8))


# ======================================================================= ISLAMIC
class IslamicScene(Scene):
    def make_bg(self):
        self.bgpair = ("#F3FBF4", "#DCEFD9")
        self.shadow = (190, 214, 186)
        img = gradient(self.W, self.H, *self.bgpair).convert("RGBA")
        rnd = random.Random(5)
        for _ in range(26):
            x, y = rnd.uniform(0, self.W), rnd.uniform(0, self.H)
            sp = star8("#2E7D4F", rnd.choice([60, 90, 120]), 22)
            img.alpha_composite(sp, (int(x), int(y)))
        return img.convert("RGB")

    def draw_decor(self, fr, t):
        pass

    def setup(self):
        self.sfx(0.4, "sparkle")

    def draw(self, fr, d, t):
        s = self.spec
        kind = s.get("kind", "ayah")
        label = {"ayah": "From the Quran", "hadith": "Hadith", "seerah": "From the Seerah", "dua": "Dua"}.get(kind,
                                                                                                             "Islamic Connection")
        pill(d, strip_emoji(s.get("heading") or label), self.cx, self.head_y, 48, "#2E7D4F", scale=pop(t, 0.2))
        if self.P:
            box = (70, 350, 1010, 1240)
        else:
            box = (200, 210, 1720, 870)
        card(d, box, fill="#FFFDF5", outline="#C9A227", shadow=self.shadow, width=8)
        d.rounded_rectangle((box[0] + 18, box[1] + 18, box[2] - 18, box[3] - 18), radius=26,
                            outline=col("#E8D9A0"), width=3)
        e = s.get("emoji")
        y = box[1] + 110
        if e:
            put(fr, emoji(e, 110), self.cx, y, pop(t, 0.4))
            y += 120
        ar = (s.get("arabic") or "").strip()
        if ar:
            sc = pop(t, 0.6)
            if sc:
                f = afont(int(70 if not self.P else 60), 700)
                maxw = (box[2] - box[0]) - 140
                lines = arabic_lines(ar, f, maxw, 3)
                for i, l in enumerate(lines):
                    kw = {"direction": "rtl"} if HAS_RAQM else {}
                    d.text((self.cx, y + 20 + i * 95), l, font=f, fill=col("#1F5C3A"), anchor="mm", **kw)
                y += 60 + 95 * min(3, len(lines))
        tr = strip_emoji(s.get("translation", ""))
        rem = box[3] - 140 - y
        TB(d, ("“" + tr + "”") if tr and kind in ("ayah", "hadith", "dua") else tr, self.cx, y + rem / 2,
           (box[2] - box[0]) - 140, 54 if not self.P else 50, INK, 500, max_lines=5, scale=pop(t, 1.0))
        if s.get("reference"):
            pill(d, strip_emoji(s["reference"]), self.cx, box[3] - 70, 34, "#C9A227", scale=pop(t, 1.3))


# ======================================================================= RECAP
class RecapScene(Scene):
    def setup(self):
        self.points = (self.spec.get("points") or [])[:5]
        self.tp = [self.at(p, self.bt(min(k, len(self.beats) - 1)) + 0.2) for k, p in enumerate(self.points)]
        for tt in self.tp:
            self.sfx(tt, "pop")

    def draw(self, fr, d, t):
        self.heading(d, self.spec.get("heading") or "Let's remember!", t)
        n = max(1, len(self.points))
        if self.P:
            box = (70, 360, 1010, 1240)
        else:
            box = (300, 220, 1620, 860)
        card(d, box, outline="#8E5CF0", shadow=self.shadow)
        h = (box[3] - box[1] - 60) / n
        for k, p in enumerate(self.points):
            sc = pop(t, self.tp[k])
            if not sc:
                continue
            y = box[1] + 30 + h * (k + 0.5)
            put(fr, star(size=60), box[0] + 70, y, sc)
            lines, sz = fit_lines(strip_emoji(p.get("text", "")), box[2] - box[0] - 180, 54 if not self.P else 46, 2)
            lh = sz * 1.12
            for i, l in enumerate(lines):
                T(d, l, box[0] + 125, y - lh * (len(lines) - 1) / 2 + i * lh, sz, INK, 600, anchor="lm", scale=sc)


# ======================================================================= OUTRO
class OutroScene(Scene):
    owl_corner = False
    decor = "mix"

    def setup(self):
        self.sfx(0.2, "fanfare")
        self.sfx(1.4, "sparkle")

    def owl_state(self, t):
        if self.P:
            return dict(pos=(540, 760), scale=1.15, wave=True)
        return dict(pos=(960, 560), scale=1.4, wave=True)

    def draw(self, fr, d, t):
        s = self.spec
        b = self.ctx["brand"]
        confetti_draw(d, t, self.W, self.H, seed=9, n=60)
        if not self.ctx.get("mascot", True):
            x, y = (540, 760) if self.P else (960, 560)
            put(fr, emoji("🎉", 300), x, y + 14 * math.sin(t * 2.5), pop(t, 0.5) * (1 + 0.04 * math.sin(t * 4)))
        TB(d, strip_emoji(s.get("title") or "Great job, stars!"), self.cx, 165 if not self.P else 260, self.maxw, 100,
           "#E64BA6", 700, stroke=12, max_lines=2, scale=pop(t, 0.2) * (1 + 0.03 * math.sin(t * 5)))
        burst(fr, self.cx, 165 if not self.P else 260, t, 0.4, n=14, dist=560, size=60, dur=1.2)
        if s.get("subtitle"):
            TB(d, strip_emoji(s["subtitle"]), self.cx, 280 if not self.P else 420, self.maxw, 50, INK, 600, stroke=6,
               scale=pop(t, 0.7))
        if b.get("subscribe", True):
            y = 900 if not self.P else 1100
            sc = pop(t, 1.0) * (1 + 0.05 * math.sin(t * 6))
            if self.P:
                pill(d, "SUBSCRIBE", 540, y, 52, "#E53935", scale=sc)
                pill(d, "LIKE", 540, y + 120, 44, "#2F7DF6", scale=pop(t, 1.3))
                put(fr, emoji("🔔", 80), 800, y, pop(t, 1.2))
                put(fr, emoji("👍", 70), 680, y + 120, pop(t, 1.4))
            else:
                pill(d, "LIKE", 1420, 430, 44, "#2F7DF6", scale=pop(t, 1.3))
                put(fr, emoji("👍", 70), 1540, 430, pop(t, 1.4))
                pill(d, "SUBSCRIBE", 1440, 560, 52, "#E53935", scale=sc)
                put(fr, emoji("🔔", 80), 1660, 560, pop(t, 1.2))
        ch = b.get("channel")
        if ch:
            tag = b.get("tagline")
            txt = f"{ch} — {tag}" if tag else ch
            pill(d, txt, self.cx, 1330 if self.P else 860, 34, "#7B5CD6", scale=pop(t, 0.9), maxw=self.maxw)


SCENE_TYPES = {
    "title": TitleScene, "concept": ConceptScene, "objects": ObjectsScene, "equation": EquationScene,
    "quiz": QuizScene, "steps": StepsScene, "compare": CompareScene, "story": StoryScene, "fact": FactScene,
    "islamic": IslamicScene, "recap": RecapScene, "outro": OutroScene,
}
