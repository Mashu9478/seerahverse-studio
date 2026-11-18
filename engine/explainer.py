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

FFMPEG = os.environ.get("FFMPEG")
if not FFMPEG:
    try:
        import imageio_ffmpeg
        FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        FFMPEG = "ffmpeg"


# ----------------------------------------------------------------- helpers
def font(size, weight=600, urdu=False):
    if urdu:
        w = 700 if weight >= 700 else 600
        return ImageFont.truetype(os.path.join(FONT_DIR, f"NotoNastaliqUrdu-{w}.ttf"), max(4, int(size)),
                                  layout_engine=ImageFont.Layout.RAQM)
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
                    a["at"] = word_time(b.get("say", ""), a["word"], speech) + float(a.get("after", 0))
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
                            "wipe": None, "fill": None, "origin": None, "rot": 0.0, "rorg": None}
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
            elif do == "rotate":
                p = P(a["id"])
                p["rot"] += (float(a.get("to", 0)) - p["rot"]) * ease(u)
                p["rorg"] = a.get("origin") or p["rorg"]
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
# ----------------------------------------------------------------- frame
class Renderer:
    def __init__(self, part, beats, actions, headers, total):
        self.plan = part
        self.stage = Stage(part)
        self.state = State(self.stage, actions, total)
        self.beats, self.headers, self.total = beats, headers, total
        self.W, self.H = self.stage.W, self.stage.H
        self.portrait = self.H >= self.W
        th = part.get("theme") or {}
        self.bg = th.get("bg", "#EEF2F4")
        self.ink = th.get("ink", "#1E2A30")
        self.label_ink = th.get("label", "#2B3A42")
        self.accent = th.get("accent", "#1C7ED6")
        self.captions = part.get("captions", True)
        if self.portrait:
            self.L = dict(band=420, tag_y=150, title_y=250, title_y_notag=215, title_size=76, title_lh=88,
                          title_maxw=self.W - 140, title_lines=2, cap_size=46, cap_lh=60, cap_maxw=self.W - 200,
                          cap_bottom=210, cap_lines=3)
        else:
            self.L = dict(band=250, tag_y=64, title_y=142, title_y_notag=110, title_size=66, title_lh=76,
                          title_maxw=self.W - 520, title_lines=1, cap_size=42, cap_lh=54, cap_maxw=self.W - 560,
                          cap_bottom=60, cap_lines=2)
        self.rtl = bool(part.get("rtl")) or part.get("lang") == "ur"
        U = self.rtl
        if U:  # Nastaliq needs taller lines and slightly smaller sizes
            self.L["title_size"] = int(self.L["title_size"] * 0.9)
            self.L["title_lh"] = int(self.L["title_lh"] * 1.5)
            self.L["cap_size"] = int(self.L["cap_size"] * 0.95)
            self.L["cap_lh"] = int(self.L["cap_lh"] * 1.55)
        self.F_tag = font(38 if U else 30, 600, U)
        self.F_title = font(self.L["title_size"], 700, U)
        self.F_label = font(42 if U else 31, 600, U)
        self.F_cap = font(self.L["cap_size"], 600, U)
        self.dir = "rtl" if U else None
        band = Image.new("L", (1, self.L["band"]))
        b0 = self.L["band"] * 0.6
        for y in range(self.L["band"]):
            band.putpixel((0, y), int(235 * clamp(1 - (y - b0) / (self.L["band"] - b0))))
        self.band = Image.new("RGBA", (self.W, self.L["band"]), (*hex2rgb(self.bg), 255))
        self.band.putalpha(band.resize((self.W, self.L["band"])))

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
            if abs(p["rot"]) > 0.01:
                o = p["rorg"] or self._center_guess(el)
                pre = f"rotate({p['rot']:.3f} {o[0]:.2f} {o[1]:.2f}) " + pre
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

    # --- overlays (all drawn onto one RGBA layer per frame)
    def to_screen(self, cam, x, y):
        cx, cy, cw, ch = cam
        s = max(self.W / cw, self.H / ch)
        ox = (self.W - cw * s) / 2
        oy = (self.H - ch * s) / 2
        return ((x - cx) * s + ox, (y - cy) * s + oy)

    def draw_labels(self, d, t, cam, labels):
        bg = hex2rgb(self.bg)
        for lid, L in labels.items():
            a = L["a"]
            op = ease(clamp((t - L["t0"]) / 0.45))
            if L["off"] is not None:
                op *= 1 - ease(clamp((t - L["off"]) / 0.35))
            if op <= 0.01 or not a.get("point"):
                continue
            px, py = self.to_screen(cam, *a["point"][:2])
            side = a.get("side", "right")
            ln = float(a.get("len", 150))
            dy = float(a.get("dy", 0))
            sx = -1 if side == "left" else 1
            ex, ey = px + sx * ln, py + dy
            g = ease_out(clamp((t - L["t0"]) / 0.35))
            lx, ly = px + (ex - px) * g, py + (ey - py) * g
            ink = hex2rgb(a.get("color", self.label_ink))
            col = (*ink, int(255 * op))
            d.line([(px, py), (lx, ly)], fill=(*bg, int(200 * op)), width=8)
            d.line([(px, py), (lx, ly)], fill=col, width=3)
            d.ellipse([px - 7, py - 7, px + 7, py + 7], fill=(*bg, int(220 * op)))
            d.ellipse([px - 5.5, py - 5.5, px + 5.5, py + 5.5], fill=col)
            if g >= 0.6:
                top = op * clamp((g - 0.6) / 0.4)
                txt = str(a.get("text", "")).upper()
                tx = ex + sx * 12
                anc = "r" if side == "left" else "l"
                self._tracked(d, (tx, ey), txt, self.F_label, (*ink, int(255 * top)), 2.2, anc,
                              halo=(*bg, int(235 * top)))

    def _tracked(self, d, xy, s, f, fill, tracking, anchor, halo=None):
        if self.rtl:
            anc = {"l": "lm", "m": "mm", "r": "rm"}[anchor]
            if halo:
                d.text(xy, s, font=f, fill=halo, anchor=anc, direction="rtl", stroke_width=7, stroke_fill=halo)
            d.text(xy, s, font=f, fill=fill, anchor=anc, direction="rtl")
            return d.textlength(s, font=f, direction="rtl")
        widths = [d.textlength(ch, font=f) for ch in s]
        total = sum(widths) + tracking * max(0, len(s) - 1)
        x0 = xy[0] - (total / 2 if anchor == "m" else total if anchor == "r" else 0)
        passes = ([("halo", halo)] if halo else []) + [("fill", fill)]
        for kind, colr in passes:
            x = x0
            for ch, w in zip(s, widths):
                if kind == "halo":
                    d.text((x, xy[1]), ch, font=f, fill=colr, anchor="lm", stroke_width=6, stroke_fill=colr)
                else:
                    d.text((x, xy[1]), ch, font=f, fill=colr, anchor="lm")
                x += w + tracking
        return total

    def header_at(self, t):
        cur = 0
        for i, h in enumerate(self.headers):
            if h["t"] <= t:
                cur = i
        return cur

    def draw_header(self, ov, d, t):
        i = self.header_at(t)
        h = self.headers[i]
        u = clamp((t - h["t"]) / 0.45) if i else 1.0
        prev = self.headers[i - 1] if i else None
        ov.alpha_composite(self.band, (0, 0))
        if prev is not None and u < 1:
            self._header_block(d, prev, 1 - ease(u * 1.6), -18 * ease(u))
        self._header_block(d, h, ease(u), 18 * (1 - ease(u)))

    def _header_block(self, d, h, op, dy):
        if op <= 0.01:
            return
        W, L = self.W, self.L
        ink = hex2rgb(self.ink)
        y_title = L["title_y"] if h.get("tag") else L["title_y_notag"]
        if h.get("tag"):
            tag = str(h["tag"]).upper()
            tw = (d.textlength(tag, font=self.F_tag, direction="rtl") if self.rtl
                  else sum(d.textlength(c, font=self.F_tag) for c in tag) + 3 * max(0, len(tag) - 1))
            bx0, bx1 = W / 2 - tw / 2 - 26, W / 2 + tw / 2 + 26
            by = L["tag_y"] + dy
            d.rounded_rectangle([bx0, by - 26, bx1, by + 26], radius=26, fill=(255, 255, 255, int(255 * op)),
                                outline=(*ink, int(60 * op)), width=2)
            self._tracked(d, (W / 2, by + 1), tag, self.F_tag, (*ink, int(255 * op)), 3, "m")
        title = h.get("title", "") or ""
        f = self.F_title
        lines = wrap(d, title, f, L["title_maxw"])
        if len(lines) > L["title_lines"]:
            f = font(L["title_size"] * 0.8, 700)
            lines = wrap(d, title, f, L["title_maxw"])[: L["title_lines"]]
        hl = set(re.findall(r"[a-z0-9']+", (h.get("hl") or "").lower()))
        lh = L["title_lh"] * (f.size / self.F_title.size)
        y = y_title + dy - (len(lines) - 1) * lh / 2
        if self.rtl:
            hl = set((h.get("hl") or "").split())
        sp = d.textlength(" ", font=f)
        for ln in lines:
            words = ln.split(" ")
            ws = [d.textlength(w, font=f, direction=self.dir) for w in words]
            tw = sum(ws) + sp * (len(words) - 1)
            x = W / 2 + tw / 2 if self.rtl else W / 2 - tw / 2
            for wd, ww in zip(words, ws):
                key = wd if self.rtl else re.sub(r"[^a-z0-9']", "", wd.lower())
                colr = hex2rgb(self.accent) if key and key in hl else ink
                if self.rtl:
                    d.text((x, y), wd, font=f, fill=(*colr, int(255 * op)), anchor="rm", direction="rtl")
                    x -= ww + sp
                else:
                    d.text((x, y), wd, font=f, fill=(*colr, int(255 * op)), anchor="lm")
                    x += ww + sp
            y += lh

    def draw_caption(self, d, t):
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
        W, H, L = self.W, self.H, self.L
        lines = wrap(d, b["caption"], self.F_cap, L["cap_maxw"])
        if len(lines) > L["cap_lines"]:
            # long beat: show the half being spoken
            half = clamp((t - b["t"]) / max(0.2, b["speech"])) >= 0.5
            mid = (len(lines) + 1) // 2
            lines = lines[mid:] if half else lines[:mid]
            lines = lines[: L["cap_lines"]]
        lh = L["cap_lh"]
        hgt = lh * len(lines) + 40
        y0 = H - L["cap_bottom"] - hgt
        wmax = max(d.textlength(l, font=self.F_cap, direction=self.dir) for l in lines)
        d.rounded_rectangle([W / 2 - wmax / 2 - 34, y0, W / 2 + wmax / 2 + 34, y0 + hgt], radius=30,
                            fill=(255, 255, 255, int(235 * u)))
        all_words = b["caption"].split()
        spoken = clamp((t - b["t"]) / max(0.2, b["speech"]))
        lit = int(round(spoken * len(all_words)))
        first = 0
        joined = " ".join(lines).split()
        # index of first shown word inside the caption
        for k in range(len(all_words)):
            if all_words[k:k + len(joined)] == joined:
                first = k
                break
        k = first
        ink, acc = hex2rgb(self.ink), hex2rgb(self.accent)
        sp = d.textlength(" ", font=self.F_cap)
        for li, l in enumerate(lines):
            words = l.split()
            ws = [d.textlength(w, font=self.F_cap, direction=self.dir) for w in words]
            tw = sum(ws) + sp * (len(words) - 1)
            x = W / 2 + tw / 2 if self.rtl else W / 2 - tw / 2
            y = y0 + 20 + lh * li + lh / 2
            for w, ww in zip(words, ws):
                c = acc if k < lit else ink
                if self.rtl:
                    d.text((x, y), w, font=self.F_cap, fill=(*c, int(255 * u)), anchor="rm", direction="rtl")
                    x -= ww + sp
                else:
                    d.text((x, y), w, font=self.F_cap, fill=(*c, int(255 * u)), anchor="lm")
                    x += ww + sp
                k += 1

    def frame(self, t):
        props, cam, labels, flows, pulses = self.state.at(t)
        img = self.stage_png(t, props, cam, flows, pulses).convert("RGBA")
        ov = Image.new("RGBA", img.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(ov)
        self.draw_labels(d, t, cam, labels)
        self.draw_header(ov, d, t)
        self.draw_caption(d, t)
        img = Image.alpha_composite(img, ov).convert("RGB")
        fo = clamp(t / 0.35) * clamp((self.total - t) / 0.5)
        if fo < 1:
            img = Image.blend(Image.new("RGB", img.size, hex2rgb(self.bg)), img, fo)
        return img


# ----------------------------------------------------------------- plan normalising
def parts_of(plan):
    """Return (parts, settings). Accepts the website VideoPlan (style=explainer) or the flat sample format."""
    ex = plan.get("explainer")
    if ex and ex.get("parts"):
        fmt = plan.get("format", "short")
        W, H = (1080, 1920) if fmt == "short" else (1920, 1080)
        theme = ex.get("theme") or {}
        parts = []
        for p in ex["parts"]:
            parts.append({"stage": p["stage"], "hidden": p.get("hidden", []), "camera": p.get("camera"),
                          "steps": p["steps"], "theme": theme, "w": W, "h": H,
                          "captions": plan.get("captions", True), "lang": plan.get("language", "en")})
        cfg = {"voice": plan.get("voice", "af_heart"), "speed": plan.get("speed", 0.92),
               "music": plan.get("music", "calm"), "sfx": plan.get("sfx", True), "title": plan.get("title", ""),
               "fps": 30}
        return parts, cfg
    part = {k: plan[k] for k in ("stage", "hidden", "camera", "steps", "theme", "w", "h", "captions", "lang", "rtl") if k in plan}
    cfg = {"voice": plan.get("voice", "af_heart"), "speed": plan.get("speed", 0.92),
           "music": plan.get("music", "calm"), "sfx": plan.get("sfx", True), "title": plan.get("title", ""),
           "fps": int(plan.get("fps", 30))}
    return [part], cfg


def part_timelines(parts, durs):
    """durs: list of (speech, total) for every beat across parts, in order."""
    out, k, off = [], 0, 0.0
    for p in parts:
        n = sum(len(s["beats"]) for s in p["steps"])
        beats, actions, headers, total = build_timeline(p, durs[k:k + n])
        out.append({"part": p, "beats": beats, "actions": actions, "headers": headers, "total": total, "off": off})
        k += n
        off += total
    return out, off


# ----------------------------------------------------------------- workers
_R = {}


def _init(tls):
    global _R
    _R = {i: Renderer(tl["part"], tl["beats"], tl["actions"], tl["headers"], tl["total"]) for i, tl in enumerate(tls)}


def _chunk(job):
    i, pi, f0, f1, fps, out = job
    R = _R[pi]
    tmp = out[:-4] + ".part.mp4"
    p = subprocess.Popen([FFMPEG, "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                          "-s", f"{R.W}x{R.H}", "-r", str(fps), "-i", "-", "-c:v", "libx264", "-crf", "18",
                          "-preset", "veryfast", "-pix_fmt", "yuv420p", "-g", str(fps * 2), tmp],
                         stdin=subprocess.PIPE)
    for f in range(f0, f1):
        p.stdin.write(R.frame(f / fps).tobytes())
    p.stdin.close()
    if p.wait() != 0:
        raise RuntimeError("video encoder failed on chunk %d" % i)
    os.replace(tmp, out)
    return i, f1 - f0


# ----------------------------------------------------------------- audio
def make_audio(cfg, tls, clips, total, out_wav):
    sys.path.insert(0, HERE)
    import audio as AU
    from scipy.signal import resample_poly
    sr = AU.SR
    n = int(total * sr) + sr
    voice = np.zeros(n, np.float32)
    fx = np.zeros(n, np.float32)
    k = 0
    for tl in tls:
        for b in tl["beats"]:
            AU.mix_at(voice, resample_poly(clips[k], 2, 1).astype(np.float32), int((tl["off"] + b["t"]) * sr))
            k += 1
        if cfg.get("sfx", True):
            for a in tl["actions"]:
                kind = a.get("sfx") or {"pop": "pop", "camera": "whoosh"}.get(a.get("do"))
                if kind:
                    try:
                        AU.mix_at(fx, AU.sfx(kind, 0.7), int((tl["off"] + a["t0"]) * sr))
                    except Exception:
                        pass
    mix = voice + fx * 0.5
    style = cfg.get("music", "calm")
    if style in ("cheerful", "calm"):
        m = AU.music(n, style)
        fade = np.ones(n, np.float32)
        fn = min(n, int(2.0 * sr))
        fade[-fn:] = np.linspace(1, 0, fn)
        mix = mix + m * 0.13 * fade
    mix /= max(1e-6, float(np.abs(mix).max())) / 0.9
    import wave
    with wave.open(out_wav, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((mix[: int(total * sr)] * 32767).astype(np.int16).tobytes())


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def write_srt(tls, path):
    rows, k = [], 1
    for tl in tls:
        for b in tl["beats"]:
            if not b["caption"]:
                continue
            rows.append(f"{k}\n{srt_time(tl['off'] + b['t'])} --> {srt_time(tl['off'] + b['end'] - 0.05)}\n{b['caption']}\n")
            k += 1
    open(path, "w").write("\n".join(rows))


def narrate(parts, cfg, rep=None):
    sys.path.insert(0, HERE)
    from tts import Voice, SR
    v = Voice()
    clips, durs = [], []
    beats = [b for p in parts for s in p["steps"] for b in s["beats"]]
    for i, b in enumerate(beats):
        clip = v.say(b.get("say", ""), cfg.get("voice", "af_heart"), float(cfg.get("speed", 0.92)))
        sp = len(clip) / SR
        clips.append(clip)
        durs.append((sp, sp + float(b.get("pause", 0.35) if b.get("pause") is not None else 0.35)))
        if rep:
            rep.set("voice", 4 + 22 * (i + 1) / len(beats), f"Recording narration {i + 1}/{len(beats)}")
    return clips, durs


class _NoRep:
    def set(self, *a):
        print(*a, flush=True)

    def done(self, payload):
        print("done", payload, flush=True)


def run_job(plan, out_dir, rep=None, stills=None):
    rep = rep or _NoRep()
    os.makedirs(out_dir, exist_ok=True)
    parts, cfg = parts_of(plan)
    fps = cfg["fps"]
    rep.set("voice", 3, "Warming up the voice")
    cache = os.path.join(out_dir, "narration.npz")
    key = json.dumps([[b.get("say") for s in p["steps"] for b in s["beats"]] for p in parts]) + str(cfg["voice"]) + str(cfg["speed"])
    clips = durs = None
    if os.path.exists(cache):
        z = np.load(cache, allow_pickle=True)
        if str(z["key"]) == key:
            clips, durs = list(z["clips"]), [tuple(d) for d in z["durs"]]
    if clips is None:
        clips, durs = narrate(parts, cfg, rep)
        np.savez(cache, key=key, clips=np.array(clips, dtype=object), durs=np.array(durs))
    # pauses can change without re-recording: rebuild beat totals from the current plan
    _beats = [b for p in parts for s in p["steps"] for b in s["beats"]]
    durs = [(sp, sp + float(b.get("pause") if b.get("pause") is not None else 0.35)) for (sp, _t), b in zip(durs, _beats)]
    tls, total = part_timelines(parts, durs)
    print(f"duration {total:.1f}s, {len(parts)} part(s), {len(clips)} beats", flush=True)
    if stills is not None:
        _init(tls)
        for t in stills:
            pi = max(i for i, tl in enumerate(tls) if tl["off"] <= t)
            _R[pi].frame(t - tls[pi]["off"]).save(os.path.join(out_dir, f"still_{t:06.2f}.png"))
        return None
    rep.set("render", 28, "Drawing the diagram")
    try:
        cores = len(os.sched_getaffinity(0))
    except Exception:
        cores = os.cpu_count() or 2
    workers = int(os.environ.get("WORKERS", max(1, min(8, cores))))
    jobs = []
    for pi, tl in enumerate(tls):
        nfr = int(math.ceil(tl["total"] * fps))
        nch = max(1, min(40, round(nfr / 90)))
        edges = [round(nfr * k / nch) for k in range(nch + 1)]
        for k in range(nch):
            jobs.append((len(jobs), pi, edges[k], edges[k + 1], fps, os.path.join(out_dir, f"c{len(jobs):03d}.mp4")))
    total_frames = sum(j[3] - j[2] for j in jobs)
    done_frames = 0
    # biggest chunks first keeps all cores busy to the end
    order = sorted(jobs, key=lambda j: -(j[3] - j[2]))
    with Pool(workers, initializer=_init, initargs=(tls,)) as pool:
        for _i, nf in pool.imap_unordered(_chunk, order):
            done_frames += nf
            rep.set("render", 28 + 60 * done_frames / max(1, total_frames),
                    f"Animating frames {done_frames}/{total_frames}")
    with open(os.path.join(out_dir, "list.txt"), "w") as f:
        for j in jobs:
            f.write(f"file '{os.path.basename(j[5])}'\n")
    silent = os.path.join(out_dir, "silent.mp4")
    subprocess.run([FFMPEG, "-loglevel", "error", "-y", "-f", "concat", "-safe", "0", "-i",
                    os.path.join(out_dir, "list.txt"), "-c", "copy", silent], check=True)
    rep.set("audio", 90, "Mixing voice, sound effects and music")
    wav = os.path.join(out_dir, "mix.wav")
    make_audio(cfg, tls, clips, total_frames / fps, wav)
    rep.set("encode", 94, "Finishing the video file")
    final = os.path.join(out_dir, "video.mp4")
    tmp = final[:-4] + ".tmp.mp4"
    subprocess.run([FFMPEG, "-loglevel", "error", "-y", "-i", silent, "-i", wav, "-map", "0:v", "-map", "1:a",
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-shortest", "-movflags", "+faststart", tmp], check=True)
    os.replace(tmp, final)
    # thumbnail: a well-developed moment of the first diagram
    r0 = Renderer(tls[0]["part"], tls[0]["beats"], tls[0]["actions"], tls[0]["headers"], tls[0]["total"])
    r0.captions = False
    tt = tls[0]["beats"][min(len(tls[0]["beats"]) - 1, max(0, len(tls[0]["beats"]) * 2 // 3))]["t"] + 1.2
    im = r0.frame(min(tt, tls[0]["total"] - 1))
    if im.width > im.height:
        im = im.resize((1280, 720), Image.LANCZOS)
    thumb = os.path.join(out_dir, "thumb.jpg")
    im.save(thumb, quality=90)
    srt = os.path.join(out_dir, "captions.srt")
    write_srt(tls, srt)
    for j in jobs:
        try:
            os.remove(j[5])
        except OSError:
            pass
    return {"video": final, "thumb": thumb, "srt": srt, "duration": round(total_frames / fps, 2)}


def main():
    plan_path, out_dir = sys.argv[1], sys.argv[2]
    stills = None
    if "--stills" in sys.argv:
        stills = [float(x) for x in sys.argv[sys.argv.index("--stills") + 1].split(",")]
    plan = json.load(open(plan_path))
    res = run_job(plan, out_dir, stills=stills)
    if res:
        print("done", res, flush=True)


if __name__ == "__main__":
    main()
