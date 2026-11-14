"""Diagram-explainer renderer.

One illustrated "stage" (an SVG with named parts) stays on screen for the whole
video and changes step by step: parts appear, grow, move and change colour,
particles flow along paths (water, air, blood, electricity), labels point at
parts with leader lines and the camera zooms to what is being explained.

Usage:
  python explainer.py plan.json out_dir            # full render
  python explainer.py plan.json out_dir --stills 3,12.5,30   # PNG frames only
"""
import copy
import io
import json
import math
import os
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from multiprocessing import Pool

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
import resvg_py

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(HERE, "fonts")
SVGNS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVGNS)
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")

FFMPEG = os.environ.get("FFMPEG") or "ffmpeg"


# ----------------------------------------------------------------- helpers
def font(size, weight=600):
    return ImageFont.truetype(os.path.join(FONT_DIR, f"Fredoka-{weight}.ttf"), max(4, int(size)))


def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def ease(u):
    u = clamp(u)
    return u * u * (3 - 2 * u)


def ease_out(u):
    u = clamp(u)
    return 1 - (1 - u) ** 3


def back(u, s=1.7):
    u = clamp(u) - 1
    return 1 + (s + 1) * u ** 3 + s * u ** 2


def hex2rgb(h):
    h = h.strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def rgb2hex(c):
    return "#%02x%02x%02x" % tuple(int(round(v)) for v in c)


def mix_hex(a, b, u):
    try:
        ca, cb = hex2rgb(a), hex2rgb(b)
    except Exception:
        return b if u >= 0.5 else a
    return rgb2hex([ca[i] + (cb[i] - ca[i]) * u for i in range(3)])


def polyline_at(pts, u):
    """Point at fraction u along a polyline."""
    if len(pts) == 1:
        return pts[0]
    seg = [math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)]
    tot = sum(seg) or 1.0
    d = clamp(u) * tot
    for i, s in enumerate(seg):
        if d <= s or i == len(seg) - 1:
            k = 0 if s == 0 else clamp(d / s)
            return (pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k,
                    pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k)
        d -= s
    return pts[-1]


def text_tracked(d, xy, s, f, fill, tracking=0, anchor="l"):
    """Draw text with letter spacing. anchor: l / m / r (horizontal), baseline-middle vertical."""
    widths = [d.textlength(ch, font=f) for ch in s]
    total = sum(widths) + tracking * max(0, len(s) - 1)
    x, y = xy
    if anchor == "m":
        x -= total / 2
    elif anchor == "r":
        x -= total
    for ch, w in zip(s, widths):
        d.text((x, y), ch, font=f, fill=fill, anchor="lm")
        x += w + tracking
    return total


def wrap(d, text, f, maxw):
    words, lines, cur = text.split(), [], ""
    for w in words:
        t = (cur + " " + w).strip()
        if d.textlength(t, font=f) <= maxw or not cur:
            cur = t
        else:
            lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


# ----------------------------------------------------------------- timeline
def word_time(say, word, dur):
    i = say.lower().find(str(word).lower())
    if i < 0:
        return 0.0
    return dur * i / max(1, len(say))


def build_timeline(plan, beat_durs, lead=0.6):
    """Flatten steps/beats into absolute-time beats and actions."""
    beats, actions, headers = [], [], []
    t = lead
    k = 0
    for si, step in enumerate(plan["steps"]):
        headers.append({"t": t if si else 0.0, "tag": step.get("tag"), "title": step.get("title", ""),
                        "hl": step.get("highlight")})
        for b in step["beats"]:
            speech, total = beat_durs[k]
            beats.append({"t": t, "speech": speech, "end": t + total, "say": b.get("say", ""),
                          "caption": b.get("caption", b.get("say", ""))})
            for a in b.get("actions", []):
                a = dict(a)
                if "word" in a and "at" not in a:
                    a["at"] = word_time(b.get("say", ""), a["word"], speech)
                a["t0"] = t + float(a.get("at", 0))
                actions.append(a)
            t += total
            k += 1
    return beats, actions, headers, t + float(plan.get("tail", 1.2))


# ----------------------------------------------------------------- stage state
class Stage:
    def __init__(self, plan):
        self.plan = plan
        self.W, self.H = int(plan.get("w", 1080)), int(plan.get("h", 1920))
        svg = plan["stage"]
        if "xmlns=" not in svg[:300]:
            svg = svg.replace("<svg", f'<svg xmlns="{SVGNS}"', 1)
        self.root = ET.fromstring(svg)
        vb = self.root.get("viewBox")
        self.vb = [float(v) for v in re.split(r"[ ,]+", vb.strip())] if vb else [0, 0, self.W, self.H]
        self.hidden = set(plan.get("hidden", []))
        # original fills of every element under each id, for colour tweens
        self.ids = {}
        for el in self.root.iter():
            i = el.get("id")
            if i:
                self.ids[i] = el

    def fills_of(self, el):
        out = []
        for e in el.iter():
            f = e.get("fill")
            if f and f.startswith("#"):
                out.append((e, "fill", f))
            s = e.get("stroke")
            if s and s.startswith("#") and e.get("data-keep-stroke") is None:
                pass
        return out


class State:
    """Folds the action list into per-element properties at time t."""

    def __init__(self, stage, actions, total):
        self.s = stage
        self.acts = sorted(actions, key=lambda a: a["t0"])
        self.total = total

    def at(self, t):
        S = self.s
        props = {}

        def P(i):
            if i not in props:
                props[i] = {"op": 0.0 if i in S.hidden else 1.0, "dx": 0.0, "dy": 0.0, "sc": 1.0,
                            "wipe": None, "fill": None, "origin": None}
            return props[i]

        for i in S.hidden:
            P(i)
        x0, y0, w0, h0 = S.vb
        cam = list(self.plan_cam(w0, h0))
        labels, flows, pulses = {}, [], []
        for a in self.acts:
            if a["t0"] > t:
                break
            do = a.get("do")
            dur = float(a.get("dur", 0.6))
            u = 1.0 if dur <= 0 else clamp((t - a["t0"]) / dur)
            if do in ("show", "hide", "pop"):
                p = P(a["id"])
                target = 0.0 if do == "hide" else 1.0
                start = p["op"]
                p["op"] = start + (target - start) * ease(u)
                if do in ("show", "pop") and u < 1:
                    rise = float(a.get("rise", 0 if do == "pop" else 24))
                    p["dy"] += rise * (1 - ease_out(u))
                    if do == "pop":
                        p["sc"] = max(0.01, back(u))
                        p["origin"] = a.get("origin")
            elif do == "wipe":
                p = P(a["id"])
                p["op"] = 1.0
                p["wipe"] = (a.get("dir", "up"), a.get("box"), ease(u))
            elif do == "move":
                p = P(a["id"])
                to = a.get("to", [0, 0])
                p["dx"] += (float(to[0]) - p["dx"]) * ease(u)
                p["dy"] += (float(to[1]) - p["dy"]) * ease(u)
            elif do == "scale":
                p = P(a["id"])
                p["sc"] += (float(a.get("to", 1)) - p["sc"]) * ease(u)
                p["origin"] = a.get("origin")
            elif do == "fill":
                p = P(a["id"])
                prev = p["fill"]
                p["fill"] = (a["color"], ease(u), prev)
            elif do == "camera":
                bx = a.get("box")
                if bx:
                    w = float(bx[2])
                    h = w * S.H / S.W
                    tgt = [float(bx[0]), float(bx[1]), w, h]
                else:
                    tgt = [x0, y0, w0, h0]
                e = ease(u)
                cam = [cam[i] + (tgt[i] - cam[i]) * e for i in range(4)]
            elif do == "label":
                labels[a["id"]] = {"a": a, "t0": a["t0"], "off": None}
            elif do == "unlabel":
                for lid in ([a["id"]] if a.get("id") != "*" else list(labels)):
                    if lid in labels:
                        labels[lid]["off"] = a["t0"]
            elif do == "flow":
                flows.append(a)
            elif do == "pulse":
                if t - a["t0"] < float(a.get("dur", 1.2)):
                    pulses.append(a)
        return props, cam, labels, flows, pulses

    def plan_cam(self, w0, h0):
        c = self.s.plan.get("camera")
        if c:
            w = float(c[2])
            return [float(c[0]), float(c[1]), w, w * self.s.H / self.s.W]
        x0, y0 = self.s.vb[0], self.s.vb[1]
        return [x0, y0, w0, h0]


# ----------------------------------------------------------------- frame
class Renderer:
    def __init__(self, plan, beats, actions, headers, total):
        self.plan = plan
        self.stage = Stage(plan)
        self.state = State(self.stage, actions, total)
        self.beats, self.headers, self.total = beats, headers, total
        self.W, self.H = self.stage.W, self.stage.H
        th = plan.get("theme", {})
        self.bg = th.get("bg", "#EEF2F4")
        self.ink = th.get("ink", "#1E2A30")
        self.label_ink = th.get("label", "#2B3A42")
        self.accent = th.get("accent", "#E03131")
        self.captions = plan.get("captions", True)
        self.F_tag = font(30, 600)
        self.F_title = font(76, 700)
        self.F_label = font(31, 600)
        self.F_cap = font(46, 600)

    # --- stage svg for time t
    def stage_png(self, t, props, cam, flows, pulses):
        root = copy.deepcopy(self.stage.root)
        idmap = {el.get("id"): el for el in root.iter() if el.get("id")}
        parent = {c: p for p in root.iter() for c in p}
        defs = root.find(f"{{{SVGNS}}}defs")
        if defs is None:
            defs = ET.SubElement(root, f"{{{SVGNS}}}defs")
            root.remove(defs)
            root.insert(0, defs)
        for i, p in props.items():
            el = idmap.get(i)
            if el is None:
                continue
            if p["op"] <= 0.003:
                par = parent.get(el)
                if par is not None:
                    par.remove(el)
                continue
            if p["op"] < 0.999:
                el.set("opacity", f"{p['op'] * float(el.get('opacity', 1)):.3f}")
            tr = el.get("transform", "")
            pre = ""
            if abs(p["sc"] - 1) > 1e-3:
                o = p["origin"] or self._center_guess(el)
                pre += f"translate({o[0]:.2f} {o[1]:.2f}) scale({p['sc']:.4f}) translate({-o[0]:.2f} {-o[1]:.2f}) "
            if abs(p["dx"]) > 0.01 or abs(p["dy"]) > 0.01:
                pre = f"translate({p['dx']:.2f} {p['dy']:.2f}) " + pre
            if pre:
                el.set("transform", (pre + tr).strip())
            if p["wipe"]:
                d, box, u = p["wipe"]
                bx = box or self.stage.vb
                x, y, w, h = [float(v) for v in bx]
                if d == "up":
                    r = (x, y + h * (1 - u), w, h * u)
                elif d == "down":
                    r = (x, y, w, h * u)
                elif d == "left":
                    r = (x + w * (1 - u), y, w * u, h)
                else:
                    r = (x, y, w * u, h)
                cid = f"wipe-{i}"
                cp = ET.SubElement(defs, f"{{{SVGNS}}}clipPath", {"id": cid, "clipPathUnits": "userSpaceOnUse"})
                ET.SubElement(cp, f"{{{SVGNS}}}rect", {"x": f"{r[0]:.2f}", "y": f"{r[1]:.2f}",
                                                         "width": f"{max(0.01, r[2]):.2f}",
                                                         "height": f"{max(0.01, r[3]):.2f}"})
                # wrap so the clip is applied in the parent's space (before element transform)
                par = parent.get(el)
                if par is not None:
                    idx = list(par).index(el)
                    g = ET.Element(f"{{{SVGNS}}}g", {"clip-path": f"url(#{cid})"})
                    par.remove(el)
                    g.append(el)
                    par.insert(idx, g)
            if p["fill"]:
                self._apply_fill(el, p["fill"])
        # flowing particles
        for a in flows:
            self._flow(root, idmap, a, t)
        for a in pulses:
            u = clamp((t - a["t0"]) / float(a.get("dur", 1.2)))
            x, y = a["point"]
            r0 = float(a.get("r", 50))
            for k in range(2):
                uu = clamp(u * 1.4 - k * 0.3)
                if 0 < uu < 1:
                    ET.SubElement(root, f"{{{SVGNS}}}circle", {
                        "cx": str(x), "cy": str(y), "r": f"{r0 * (0.6 + uu):.1f}", "fill": "none",
                        "stroke": a.get("color", self.accent), "stroke-width": f"{6 * (1 - uu) + 1:.1f}",
                        "opacity": f"{(1 - uu) * 0.9:.2f}"})
        root.set("viewBox", " ".join(f"{v:.2f}" for v in cam))
        root.set("width", str(self.W))
        root.set("height", str(self.H))
        root.set("preserveAspectRatio", "xMidYMid slice")
        svg = ET.tostring(root, encoding="unicode")
        png = resvg_py.svg_to_bytes(svg_string=svg, background=self.bg, skip_system_fonts=True,
                                    font_dirs=[FONT_DIR], font_family="Fredoka")
        return Image.open(io.BytesIO(bytes(png))).convert("RGB")

    def _center_guess(self, el):
        nums = [float(v) for v in re.findall(r"-?\d+\.?\d*", " ".join(
            el.get(k, "") for k in ("cx", "cy", "x", "y")))]
        if len(nums) >= 2:
            return nums[:2]
        return [self.stage.vb[0] + self.stage.vb[2] / 2, self.stage.vb[1] + self.stage.vb[3] / 2]

    def _apply_fill(self, el, f):
        color, u, prev = f
        base_from = None
        if prev:
            base_from = prev[0] if prev[1] >= 1 else None
        for e in el.iter():
            for attr in ("fill",):
                v = e.get(attr)
                if v and v.startswith("#") and e.get("data-fixed") is None:
                    src = base_from or v
                    e.set(attr, mix_hex(src, color, u))

    def _flow(self, root, idmap, a, t):
        pts = [tuple(map(float, p)) for p in a["path"]]
        n = int(a.get("count", 8))
        speed = float(a.get("speed", 2.5))
        emit_for = float(a.get("dur", 6))
        r = float(a.get("r", 9))
        color = a.get("color", "#4DABF7")
        shape = a.get("shape", "dot")
        gap = speed / max(1, n)
        layer = idmap.get(a.get("layer")) if a.get("layer") else None
        host = layer if layer is not None else root
        g = ET.SubElement(host, f"{{{SVGNS}}}g")
        k = 0
        while True:
            te = a["t0"] + k * gap
            if te > t or te > a["t0"] + emit_for:
                break
            u = (t - te) / speed
            k += 1
            if u >= 1 or u < 0:
                continue
            x, y = polyline_at(pts, u)
            op = 1.0
            if a.get("fade", True):
                op = min(1.0, u / 0.12, (1 - u) / 0.15)
            jitter = float(a.get("wiggle", 0))
            if jitter:
                x += math.sin((te * 7.3 + u * 9.0)) * jitter
            if shape == "steam":
                rr = r * (0.8 + u * 0.8)
                ET.SubElement(g, f"{{{SVGNS}}}path", {
                    "d": f"M{x - rr:.1f} {y:.1f} q{rr / 2:.1f} {-rr:.1f} {rr:.1f} 0 t{rr:.1f} 0",
                    "fill": "none", "stroke": color, "stroke-width": f"{r * 0.45:.1f}",
                    "stroke-linecap": "round", "opacity": f"{op * 0.85:.2f}"})
            else:
                ET.SubElement(g, f"{{{SVGNS}}}circle", {"cx": f"{x:.1f}", "cy": f"{y:.1f}", "r": f"{r:.1f}",
                                                       "fill": color, "opacity": f"{op:.2f}"})
                ET.SubElement(g, f"{{{SVGNS}}}circle", {"cx": f"{x - r * 0.3:.1f}", "cy": f"{y - r * 0.35:.1f}",
                                                       "r": f"{r * 0.32:.1f}", "fill": "#FFFFFF",
                                                       "opacity": f"{op * 0.7:.2f}"})

    # --- overlays
    def to_screen(self, cam, x, y):
        cx, cy, cw, ch = cam
        s = max(self.W / cw, self.H / ch)
        ox = (self.W - cw * s) / 2
        oy = (self.H - ch * s) / 2
        return ((x - cx) * s + ox, (y - cy) * s + oy)

    def draw_labels(self, img, t, cam, labels):
        d = ImageDraw.Draw(img)
        for lid, L in labels.items():
            a = L["a"]
            u_in = clamp((t - L["t0"]) / 0.45)
            op = ease(u_in)
            if L["off"] is not None:
                op *= 1 - ease(clamp((t - L["off"]) / 0.35))
            if op <= 0.01:
                continue
            px, py = self.to_screen(cam, *a["point"])
            side = a.get("side", "right")
            ln = float(a.get("len", 150))
            dy = float(a.get("dy", 0))
            sx = -1 if side == "left" else 1
            ex, ey = px + sx * ln, py + dy
            g = ease_out(clamp((t - L["t0"]) / 0.35))
            lx, ly = px + (ex - px) * g, py + (ey - py) * g
            ink = hex2rgb(a.get("color", self.label_ink))
            col = (*ink, int(255 * op))
            ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
            od = ImageDraw.Draw(ov)
            od.line([(px, py), (lx, ly)], fill=col, width=3)
            od.ellipse([px - 6, py - 6, px + 6, py + 6], fill=col)
            if g >= 0.6:
                top = op * clamp((g - 0.6) / 0.4)
                txt = a["text"].upper()
                tc = (*ink, int(255 * top))
                # soft halo for readability
                halo = Image.new("RGBA", img.size, (0, 0, 0, 0))
                hd = ImageDraw.Draw(halo)
                tx = ex + sx * 12
                bg = hex2rgb(self.bg)
                text_tracked(hd, (tx, ey), txt, self.F_label, (*bg, int(220 * top)), 2.2,
                             "r" if side == "left" else "l")
                halo = halo.filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(3))
                ov = Image.alpha_composite(halo, ov)
                od = ImageDraw.Draw(ov)
                text_tracked(od, (tx, ey), txt, self.F_label, tc, 2.2, "r" if side == "left" else "l")
            img.paste(Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB"))

    def header_at(self, t):
        cur = 0
        for i, h in enumerate(self.headers):
            if h["t"] <= t:
                cur = i
        return cur

    def draw_header(self, img, t):
        W = self.W
        i = self.header_at(t)
        h = self.headers[i]
        u = clamp((t - h["t"]) / 0.45) if i else 1.0
        prev = self.headers[i - 1] if i else None
        ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
        # readable top band
        band = Image.new("L", (1, 420))
        for y in range(420):
            band.putpixel((0, y), int(235 * clamp(1 - (y - 250) / 170)))
        bgc = hex2rgb(self.bg)
        top = Image.new("RGBA", (W, 420), (*bgc, 255))
        top.putalpha(band.resize((W, 420)))
        ov.alpha_composite(top, (0, 0))
        d = ImageDraw.Draw(ov)
        if prev is not None and u < 1:
            self._header_block(d, prev, 1 - ease(u * 1.6), -18 * ease(u))
        self._header_block(d, h, ease(u), 18 * (1 - ease(u)))
        img.paste(Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB"))

    def _header_block(self, d, h, op, dy):
        if op <= 0.01:
            return
        W = self.W
        ink = hex2rgb(self.ink)
        y_title = 250 if h.get("tag") else 215
        if h.get("tag"):
            tag = h["tag"].upper()
            tw = text_tracked(ImageDraw.Draw(Image.new("RGBA", (1, 1))), (0, 0), tag, self.F_tag, (0, 0, 0, 0), 3)
            bx0, bx1 = W / 2 - tw / 2 - 26, W / 2 + tw / 2 + 26
            by = 150 + dy
            d.rounded_rectangle([bx0, by - 26, bx1, by + 26], radius=26, fill=(255, 255, 255, int(255 * op)),
                                outline=(*ink, int(60 * op)), width=2)
            text_tracked(d, (W / 2, by + 1), tag, self.F_tag, (*ink, int(255 * op)), 3, "m")
        title = h.get("title", "")
        lines = wrap(d, title, self.F_title, W - 140)[:2]
        hl = set(re.findall(r"[a-z']+", (h.get("hl") or "").lower()))
        y = y_title + dy - (len(lines) - 1) * 44
        for ln in lines:
            tw = d.textlength(ln, font=self.F_title)
            x = W / 2 - tw / 2
            for wd in ln.split(" "):
                key = re.sub(r"[^a-z']", "", wd.lower())
                colr = hex2rgb(self.accent) if key and key in hl else ink
                d.text((x, y), wd, font=self.F_title, fill=(*colr, int(255 * op)), anchor="lm")
                x += d.textlength(wd + " ", font=self.F_title)
            y += 88

    def draw_caption(self, img, t):
        if not self.captions:
            return
        b = None
        for bb in self.beats:
            if bb["t"] - 0.05 <= t < bb["end"]:
                b = bb
        if not b or not b["caption"]:
            return
        u = clamp((t - b["t"]) / 0.25) * clamp((b["end"] - t) / 0.2)
        if u <= 0.01:
            return
        W, H = self.W, self.H
        ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        lines = wrap(d, b["caption"], self.F_cap, W - 200)[:3]
        lh = 60
        hgt = lh * len(lines) + 40
        y0 = H - 210 - hgt
        wmax = max(d.textlength(l, font=self.F_cap) for l in lines)
        d.rounded_rectangle([W / 2 - wmax / 2 - 34, y0, W / 2 + wmax / 2 + 34, y0 + hgt], radius=30,
                            fill=(255, 255, 255, int(235 * u)))
        # karaoke: highlight words already spoken
        spoken = clamp((t - b["t"]) / max(0.2, b["speech"]))
        say_words = sum(len(l.split()) for l in lines)
        lit = int(round(spoken * say_words))
        k = 0
        ink = hex2rgb(self.ink)
        acc = hex2rgb(self.accent)
        for li, l in enumerate(lines):
            words = l.split()
            tw = d.textlength(l, font=self.F_cap)
            x = W / 2 - tw / 2
            y = y0 + 20 + lh * li + lh / 2
            for w in words:
                c = acc if k < lit else ink
                d.text((x, y), w, font=self.F_cap, fill=(*c, int(255 * u)), anchor="lm")
                x += d.textlength(w + " ", font=self.F_cap)
                k += 1
        img.paste(Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB"))

    def frame(self, t):
        props, cam, labels, flows, pulses = self.state.at(t)
        img = self.stage_png(t, props, cam, flows, pulses)
        self.draw_labels(img, t, cam, labels)
        self.draw_header(img, t)
        self.draw_caption(img, t)
        fo = clamp(t / 0.35) * clamp((self.total - t) / 0.5)
        if fo < 1:
            img = Image.blend(Image.new("RGB", img.size, hex2rgb(self.bg)), img, fo)
        return img


# ----------------------------------------------------------------- workers
_R = None


def _init(args):
    global _R
    _R = Renderer(*args)


def _chunk(job):
    i, f0, f1, fps, out = job
    tmp = out[:-4] + ".part.mp4"
    p = subprocess.Popen([FFMPEG, "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                          "-s", f"{_R.W}x{_R.H}", "-r", str(fps), "-i", "-", "-c:v", "libx264", "-crf", "18",
                          "-preset", "veryfast", "-pix_fmt", "yuv420p", tmp], stdin=subprocess.PIPE)
    for f in range(f0, f1):
        p.stdin.write(_R.frame(f / fps).tobytes())
    p.stdin.close()
    if p.wait() != 0:
        raise RuntimeError("ffmpeg failed on chunk %d" % i)
    os.replace(tmp, out)
    return i


# ----------------------------------------------------------------- audio
def make_audio(plan, beats_spec, total, out_wav):
    sys.path.insert(0, HERE)
    import audio as AU
    from scipy.signal import resample_poly
    sr = AU.SR
    n = int(total * sr) + sr
    voice = np.zeros(n, np.float32)
    fx = np.zeros(n, np.float32)
    for b, clip in beats_spec:
        AU.mix_at(voice, resample_poly(clip, 2, 1).astype(np.float32), int(b["t"] * sr))
    for a in plan.get("_actions", []):
        k = a.get("sfx")
        if k is None:
            k = {"pop": "pop", "camera": "whoosh", "label": "tick"}.get(a.get("do"))
            if a.get("do") == "label":
                k = None
        if k:
            AU.mix_at(fx, AU.sfx(k, 0.7), int(a["t0"] * sr))
    mix = voice + fx * 0.6
    style = plan.get("music", "calm")
    if style in ("cheerful", "calm"):
        m = AU.music(n, style)
        fade = np.ones(n, np.float32)
        fn = int(2.0 * sr)
        fade[-fn:] = np.linspace(1, 0, fn)
        mix = mix + m * 0.13 * fade
    mix /= max(1e-6, float(np.abs(mix).max())) / 0.9
    import wave
    with wave.open(out_wav, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((mix[: int(total * sr)] * 32767).astype(np.int16).tobytes())


# ----------------------------------------------------------------- main
def narrate(plan):
    sys.path.insert(0, HERE)
    from tts import Voice, SR
    v = Voice()
    clips, durs = [], []
    for step in plan["steps"]:
        for b in step["beats"]:
            clip = v.say(b.get("say", ""), plan.get("voice", "af_heart"), float(plan.get("speed", 0.92)))
            sp = len(clip) / SR
            clips.append(clip)
            durs.append((sp, sp + float(b.get("pause", 0.35))))
    return clips, durs


def main():
    plan_path, out_dir = sys.argv[1], sys.argv[2]
    stills = None
    if "--stills" in sys.argv:
        stills = [float(x) for x in sys.argv[sys.argv.index("--stills") + 1].split(",")]
    os.makedirs(out_dir, exist_ok=True)
    plan = json.load(open(plan_path))
    fps = int(plan.get("fps", 30))
    cache = os.path.join(out_dir, "narration.npz")
    say_key = json.dumps([[b.get("say") for b in s["beats"]] for s in plan["steps"]]) + plan.get("voice", "") + str(
        plan.get("speed", 0.92))
    clips = durs = None
    if os.path.exists(cache):
        z = np.load(cache, allow_pickle=True)
        if str(z["key"]) == say_key:
            clips = list(z["clips"])
            durs = [tuple(d) for d in z["durs"]]
    if clips is None:
        clips, durs = narrate(plan)
        np.savez(cache, key=say_key, clips=np.array(clips, dtype=object), durs=np.array(durs))
    beats, actions, headers, total = build_timeline(plan, durs)
    print(f"duration {total:.1f}s, {len(beats)} beats, {len(actions)} actions", flush=True)
    args = (plan, beats, actions, headers, total)
    if stills is not None:
        r = Renderer(*args)
        for t in stills:
            r.frame(t).save(os.path.join(out_dir, f"still_{t:06.2f}.png"))
        return
    nfr = int(math.ceil(total * fps))
    workers = int(os.environ.get("WORKERS", os.cpu_count() or 2))
    nchunks = max(workers, min(24, nfr // 90))
    edges = [round(nfr * k / nchunks) for k in range(nchunks + 1)]
    jobs = [(k, edges[k], edges[k + 1], fps, os.path.join(out_dir, f"c{k:03d}.mp4")) for k in range(nchunks)]
    with Pool(workers, initializer=_init, initargs=(args,)) as pool:
        for i in pool.imap_unordered(_chunk, jobs):
            print(f"chunk {i + 1}/{nchunks}", flush=True)
    with open(os.path.join(out_dir, "list.txt"), "w") as f:
        for j in jobs:
            f.write(f"file '{os.path.basename(j[4])}'\n")
    silent = os.path.join(out_dir, "silent.mp4")
    subprocess.run([FFMPEG, "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i",
                    os.path.join(out_dir, "list.txt"), "-c", "copy", silent], check=True)
    plan["_actions"] = actions
    wav = os.path.join(out_dir, "mix.wav")
    make_audio(plan, list(zip(beats, clips)), total, wav)
    final = os.path.join(out_dir, plan.get("out", "video.mp4"))
    tmp = final[:-4] + ".tmp.mp4"
    subprocess.run([FFMPEG, "-loglevel", "error", "-y", "-i", silent, "-i", wav, "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-shortest", "-movflags", "+faststart", tmp], check=True)
    os.replace(tmp, final)
    print("done", final, flush=True)


if __name__ == "__main__":
    main()
