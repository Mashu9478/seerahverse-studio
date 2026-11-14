"""Drawing toolkit shared by all scenes: fonts, emoji, mascot, sprites, animation helpers."""
import math, os, random, re
from functools import lru_cache
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
FONT_DIR = os.path.join(HERE, "fonts")
EMOJI_DIR = os.environ.get("EMOJI_DIR", "/vercel/sandbox/assets/twemoji")
FPS = 30
INK = "#2B2045"
ACCENTS = ["#F0453A", "#FF8A1F", "#F5B700", "#2DBE60", "#14B8A6", "#2F7DF6", "#8E5CF0", "#E64BA6"]

PALETTES = {
    "bright": [("#FFF6C7", "#FFCFA0"), ("#E6FAEA", "#BDEBC9"), ("#DDF1FF", "#AFD8FF"), ("#EEE8FF", "#D2C6FF"),
               ("#FFEFE3", "#FFD3B5"), ("#FFE6F3", "#E5D6FF"), ("#DFFFF6", "#B2EEDD")],
    "pastel": [("#FDF2F8", "#F5D0FE"), ("#ECFEFF", "#BAE6FD"), ("#F0FDF4", "#BBF7D0"), ("#FFFBEB", "#FDE68A"),
               ("#F5F3FF", "#DDD6FE"), ("#FFF1F2", "#FECDD3")],
    "ocean": [("#E0F7FF", "#A5DEFF"), ("#E3FDFD", "#A6E3E9"), ("#E8F1FF", "#B9CCFF"), ("#E6FFFA", "#9DECDB")],
    "sunset": [("#FFF1E0", "#FFC59E"), ("#FFE8EC", "#FFB8C6"), ("#FFF6D6", "#FFD27F"), ("#F7E8FF", "#E2B8FF")],
    "forest": [("#F0FBEA", "#C8EBB0"), ("#EAF7F0", "#AEE0C3"), ("#FBF8E8", "#E6DDA6"), ("#E9F5EC", "#B9DDC4")],
    "candy": [("#FFE3F1", "#FFB5DA"), ("#E9E3FF", "#C7B8FF"), ("#E0FBFF", "#9EE7F5"), ("#FFF5D1", "#FFE08A")],
}


# ------------------------------------------------------------------ colors & fonts
def hx(h, a=255):
    if isinstance(h, tuple):
        return h if len(h) == 4 else tuple(h) + (a,)
    h = h.lstrip("#")
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)


def col(c):
    return hx(c)[:3]


def shade(c, f):
    c = hx(c)
    if f < 1:
        return tuple(int(v * f) for v in c[:3]) + (c[3],)
    return tuple(int(v + (255 - v) * (f - 1)) for v in c[:3]) + (c[3],)


@lru_cache(maxsize=None)
def font(size, weight=600):
    return ImageFont.truetype(f"{FONT_DIR}/Fredoka-{weight}.ttf", max(4, int(size)))


try:
    from PIL import features as _features
    HAS_RAQM = bool(_features.check("raqm")) and not os.environ.get("FORCE_BASIC_LAYOUT")
except Exception:
    HAS_RAQM = False


@lru_cache(maxsize=None)
def afont(size, weight=400):
    eng = ImageFont.Layout.RAQM if HAS_RAQM else ImageFont.Layout.BASIC
    return ImageFont.truetype(f"{FONT_DIR}/Amiri-{weight}.ttf", max(4, int(size)), layout_engine=eng)


def arabic_lines(text, f, maxw, max_lines=3):
    """Wrap Arabic text into visual lines ready to draw left-to-right (shaped + reordered if no raqm)."""
    words = text.split()
    lines, cur = [], []

    def vis(ws):
        s = " ".join(ws)
        if HAS_RAQM:
            return s
        import arabic_reshaper
        from bidi.algorithm import get_display
        return get_display(arabic_reshaper.reshape(s))

    def width(ws):
        s = vis(ws)
        return f.getlength(s, direction="rtl") if HAS_RAQM else f.getlength(s)

    for w in words:
        if cur and width(cur + [w]) > maxw:
            lines.append(cur)
            cur = [w]
        else:
            cur.append(w)
    if cur:
        lines.append(cur)
    return [vis(l) for l in lines[:max_lines]]


_EMOJI_RE = re.compile("[\U0001F000-\U0001FAFF☀-➿️‍⬀-⯿⌀-⏿\U000E0000-\U000E007F]+")


def strip_emoji(s):
    return re.sub(r"\s{2,}", " ", _EMOJI_RE.sub("", s or "")).strip()


# ------------------------------------------------------------------ supersampled pen
class Pen:
    def __init__(self, w, h, scale=1.0, ss=3):
        self.m = scale * ss
        self.out = (max(1, int(round(w * scale))), max(1, int(round(h * scale))))
        self.img = Image.new("RGBA", (max(1, int(w * self.m)), max(1, int(h * self.m))), (0, 0, 0, 0))
        self.d = ImageDraw.Draw(self.img)

    def B(self, box):
        return [v * self.m for v in box]

    def P(self, pts):
        return [(x * self.m, y * self.m) for x, y in pts]

    def w(self, w):
        return max(1, int(round(w * self.m)))

    def ellipse(self, box, fill=None, outline=None, width=0):
        self.d.ellipse(self.B(box), fill=fill, outline=outline, width=self.w(width) if outline else 0)

    def rrect(self, box, r, fill=None, outline=None, width=0):
        self.d.rounded_rectangle(self.B(box), radius=r * self.m, fill=fill, outline=outline,
                                 width=self.w(width) if outline else 0)

    def poly(self, pts, fill=None, outline=None, width=0):
        self.d.polygon(self.P(pts), fill=fill, outline=outline, width=self.w(width) if outline else 0)

    def line(self, pts, fill, width, caps=True):
        self.d.line(self.P(pts), fill=fill, width=self.w(width), joint="curve")
        if caps:
            r = width / 2
            for (x, y) in (pts[0], pts[-1]):
                self.ellipse((x - r, y - r, x + r, y + r), fill=fill)

    def arc(self, box, a0, a1, fill, width):
        self.d.arc(self.B(box), a0, a1, fill=fill, width=self.w(width))

    def text(self, xy, s, size, fill, weight=600, anchor="mm"):
        self.d.text((xy[0] * self.m, xy[1] * self.m), s, font=font(size * self.m, weight), fill=fill, anchor=anchor)

    def done(self):
        return self.img.resize(self.out, Image.LANCZOS)


# ------------------------------------------------------------------ sprites
CUBE = {"red": "#F0453A", "blue": "#2F7DF6", "green": "#2DBE60", "yellow": "#FFC21A",
        "orange": "#FF8A1F", "purple": "#8E5CF0", "pink": "#E64BA6", "teal": "#14B8A6"}


@lru_cache(maxsize=None)
def cube(color, size=84, label=None):
    c = hx(CUBE.get(color, "#F0453A"))
    p = Pen(100, 112, size / 100)
    p.rrect((34, 0, 66, 20), 5, fill=shade(c, 0.72))
    p.rrect((3, 12, 97, 109), 14, fill=shade(c, 0.70))
    p.rrect((3, 12, 91, 101), 14, fill=c)
    p.rrect((14, 22, 52, 32), 5, fill=(255, 255, 255, 95))
    img = p.done()
    if label is not None:
        d = ImageDraw.Draw(img)
        d.text((img.width * 0.47, img.height * 0.54), str(label), font=font(size * 0.46, 700), fill=(255, 255, 255),
               anchor="mm", stroke_width=max(1, int(size * 0.03)), stroke_fill=shade(c, 0.55)[:3])
    return img


@lru_cache(maxsize=None)
def owl(eyes="open", beak=0, wave=False, scale=0.8):
    P = Pen(300, 340, scale)
    body, dark, belly, face = hx("#7B5CD6"), hx("#5B3FB3"), hx("#CDBEFF"), hx("#EEE7FF")
    ink, orange = hx("#2B2045"), hx("#FF9F1C")
    P.ellipse((105, 312, 140, 336), fill=orange)
    P.ellipse((160, 312, 195, 336), fill=orange)
    P.ellipse((40, 95, 260, 330), fill=body)
    P.poly([(58, 115), (72, 38), (125, 92)], fill=body)
    P.poly([(242, 115), (228, 38), (175, 92)], fill=body)
    P.ellipse((50, 50, 250, 225), fill=body)
    P.ellipse((18, 165, 88, 295), fill=dark)
    if wave:
        P.poly([(215, 185), (262, 70), (296, 92), (262, 210)], fill=dark)
        P.ellipse((250, 62, 298, 112), fill=dark)
    else:
        P.ellipse((212, 165, 282, 295), fill=dark)
    P.ellipse((95, 180, 205, 312), fill=belly)
    for (x, y) in [(125, 215), (160, 215), (142, 245), (125, 275), (160, 275)]:
        P.arc((x - 10, y - 8, x + 10, y + 8), 20, 160, shade(belly, 0.8), 4)
    P.ellipse((68, 82, 152, 166), fill=face)
    P.ellipse((148, 82, 232, 166), fill=face)
    if eyes == "open":
        for cx in (110, 190):
            P.ellipse((cx - 29, 95, cx + 29, 153), fill=(255, 255, 255, 255))
            P.ellipse((cx - 16, 106, cx + 16, 140), fill=ink)
            P.ellipse((cx - 8, 110, cx + 2, 120), fill=(255, 255, 255, 255))
    else:
        for cx in (110, 190):
            P.arc((cx - 24, 105, cx + 24, 140), 15, 165, ink, 7)
    if beak == 0:
        P.poly([(134, 150), (166, 150), (150, 182)], fill=orange)
    else:
        o = 7 if beak == 1 else 14
        P.ellipse((136, 156, 164, 176 + o), fill=hx("#7A1F2B"))
        P.poly([(132, 146), (168, 146), (150, 166)], fill=orange)
        P.poly([(139, 170 + o), (161, 170 + o), (150, 186 + o)], fill=shade(orange, 0.85))
    P.rrect((112, 42, 188, 70), 8, fill=ink)
    P.poly([(80, 44), (150, 16), (220, 44), (150, 66)], fill=ink)
    P.line([(150, 40), (208, 48), (208, 82)], hx("#FFD43B"), 5)
    P.ellipse((200, 76, 216, 96), fill=hx("#FFD43B"))
    return P.done()



# ------------------------------------------------------------------ presenter characters
# All share the owl's 300x340 design box so placement code is identical.
SKIN_LIGHT, SKIN_TAN = "#F2C9A0", "#D9A27A"


def _face_features(P, cx, cy, eyes, mouth, ink="#2B2045", spread=28, eye_w=8, eye_h=11, mouth_y=34, mouth_w=16):
    ink = hx(ink)
    for sx in (-spread, spread):
        x = cx + sx
        if eyes == "open":
            P.ellipse((x - eye_w, cy - eye_h, x + eye_w, cy + eye_h), fill=ink)
            P.ellipse((x - eye_w * 0.2, cy - eye_h * 0.7, x + eye_w * 0.6, cy - eye_h * 0.1), fill=(255, 255, 255, 255))
        else:
            P.arc((x - eye_w * 1.4, cy - 6, x + eye_w * 1.4, cy + 10), 15, 165, ink, 5)
    my = cy + mouth_y
    if mouth == 0:
        P.arc((cx - mouth_w, my - 12, cx + mouth_w, my + 8), 20, 160, ink, 5)
    else:
        h = 9 if mouth == 1 else 15
        w = mouth_w * (0.75 if mouth == 1 else 0.95)
        P.ellipse((cx - w, my - 4, cx + w, my + h), fill=hx("#7A1F2B"))
        P.ellipse((cx - w * 0.6, my + h * 0.35, cx + w * 0.6, my + h + 1), fill=hx("#F87171"))


def _arms(P, color, skin, wave, left_item=None):
    c, s = hx(color), hx(skin)
    # left arm (viewer's left)
    P.line([(92, 232), (70, 292)], c, 28)
    P.ellipse((56, 282, 84, 310), fill=s)
    if left_item == "book":
        P.rrect((40, 262, 92, 304), 6, fill=hx("#2F7DF6"))
        P.rrect((45, 266, 88, 300), 4, fill=hx("#DBEAFE"))
        P.line([(66, 266), (66, 300)], hx("#2F7DF6"), 3, caps=False)
    if wave:
        P.line([(208, 230), (250, 168)], c, 28)
        P.ellipse((236, 140, 268, 172), fill=s)
    else:
        P.line([(208, 232), (230, 292)], c, 28)
        P.ellipse((216, 282, 244, 310), fill=s)


@lru_cache(maxsize=None)
def maryam(eyes="open", mouth=0, wave=False, scale=0.8):
    P = Pen(300, 340, scale)
    hijab, hijab_dk, dress = hx("#8B5CF6"), hx("#6D28D9"), hx("#F472B6")
    P.rrect((78, 205, 222, 336), 46, fill=dress)
    P.rrect((118, 300, 182, 336), 10, fill=shade(dress, 0.85))
    _arms(P, "#F472B6", SKIN_LIGHT, wave, left_item="book")
    P.rrect((62, 150, 238, 262), 70, fill=hijab_dk)
    P.ellipse((58, 32, 242, 244), fill=hijab)
    P.ellipse((90, 74, 210, 206), fill=shade(hijab, 1.25))
    P.ellipse((97, 82, 203, 200), fill=hx(SKIN_LIGHT))
    P.ellipse((104, 156, 124, 170), fill=hx("#F4A3A6"))
    P.ellipse((176, 156, 196, 170), fill=hx("#F4A3A6"))
    P.arc((116, 116, 140, 128), 200, 340, hx("#5B3A29"), 3)
    P.arc((160, 116, 184, 128), 200, 340, hx("#5B3A29"), 3)
    _face_features(P, 150, 140, eyes, mouth, spread=22, eye_w=7, eye_h=10, mouth_y=32, mouth_w=14)
    P.ellipse((180, 196, 196, 212), fill=hx("#FBBF24"))  # brooch pin
    return P.done()


@lru_cache(maxsize=None)
def yusuf(eyes="open", mouth=0, wave=False, scale=0.8):
    P = Pen(300, 340, scale)
    kurta = hx("#38BDF8")
    P.rrect((80, 200, 220, 336), 42, fill=kurta)
    P.poly([(136, 200), (164, 200), (150, 236)], fill=shade(kurta, 0.8))
    P.line([(150, 236), (150, 300)], shade(kurta, 0.8), 3, caps=False)
    for y in (252, 272, 292):
        P.ellipse((146, y - 4, 154, y + 4), fill=hx("#F8FAFC"))
    _arms(P, "#38BDF8", SKIN_TAN, wave)
    P.ellipse((84, 122, 106, 156), fill=hx(SKIN_TAN))
    P.ellipse((194, 122, 216, 156), fill=hx(SKIN_TAN))
    P.ellipse((92, 58, 208, 150), fill=hx("#2D1B12"))
    P.ellipse((97, 78, 203, 200), fill=hx(SKIN_TAN))
    P.ellipse((92, 34, 208, 104), fill=hx("#F8FAFC"))
    P.rrect((92, 70, 208, 92), 8, fill=hx("#E2E8F0"))
    for x in range(102, 204, 12):
        P.ellipse((x - 2.5, 78, x + 2.5, 84), fill=hx("#94A3B8"))
    P.ellipse((104, 154, 124, 168), fill=hx("#E0907C"))
    P.ellipse((176, 154, 196, 168), fill=hx("#E0907C"))
    P.arc((112, 104, 140, 120), 200, 340, hx("#2D1B12"), 5)
    P.arc((160, 104, 188, 120), 200, 340, hx("#2D1B12"), 5)
    _face_features(P, 150, 136, eyes, mouth, spread=24, eye_w=8, eye_h=11, mouth_y=34, mouth_w=15)
    return P.done()


@lru_cache(maxsize=None)
def robo(eyes="open", mouth=0, wave=False, scale=0.8):
    P = Pen(300, 340, scale)
    body, dark, led = hx("#0EA5E9"), hx("#0369A1"), hx("#67E8F9")
    P.rrect((108, 296, 140, 336), 8, fill=dark)
    P.rrect((160, 296, 192, 336), 8, fill=dark)
    P.rrect((88, 182, 212, 306), 26, fill=body)
    P.rrect((112, 208, 188, 278), 16, fill=hx("#E0F2FE"))
    P.ellipse((136, 226, 164, 254), fill=hx("#F472B6"))
    P.ellipse((142, 230, 152, 240), fill=hx("#FDF2F8"))
    # arms
    P.line([(90, 214), (62, 276)], dark, 18)
    P.ellipse((46, 266, 78, 298), fill=hx("#94A3B8"))
    if wave:
        P.line([(210, 214), (252, 160)], dark, 18)
        P.ellipse((238, 132, 270, 164), fill=hx("#94A3B8"))
    else:
        P.line([(210, 214), (238, 276)], dark, 18)
        P.ellipse((222, 266, 254, 298), fill=hx("#94A3B8"))
    P.rrect((140, 160, 160, 190), 4, fill=hx("#94A3B8"))
    # head
    P.line([(150, 22), (150, 52)], hx("#94A3B8"), 6)
    P.ellipse((138, 8, 162, 32), fill=hx("#FBBF24"))
    P.ellipse((56, 92, 82, 128), fill=dark)
    P.ellipse((218, 92, 244, 128), fill=dark)
    P.rrect((70, 44, 230, 172), 34, fill=body)
    P.rrect((88, 64, 212, 152), 24, fill=hx("#0F172A"))
    if eyes == "open":
        P.rrect((108, 86, 136, 114), 9, fill=led)
        P.rrect((164, 86, 192, 114), 9, fill=led)
        P.ellipse((112, 90, 120, 98), fill=hx("#ECFEFF"))
        P.ellipse((168, 90, 176, 98), fill=hx("#ECFEFF"))
    else:
        P.rrect((106, 98, 138, 106), 4, fill=led)
        P.rrect((162, 98, 194, 106), 4, fill=led)
    if mouth == 0:
        P.arc((126, 112, 174, 140), 20, 160, led, 5)
    else:
        hts = [8, 16, 12, 18, 9] if mouth == 2 else [5, 9, 7, 10, 5]
        for i, h in enumerate(hts):
            x = 126 + i * 11
            P.rrect((x, 134 - h, x + 7, 134 + h * 0.4), 3, fill=led)
    return P.done()


@lru_cache(maxsize=None)
def sheru(eyes="open", mouth=0, wave=False, scale=0.8):
    P = Pen(300, 340, scale)
    fur, mane, light = hx("#FBBF24"), hx("#D97706"), hx("#FEF3C7")
    # tail
    P.line([(200, 290), (252, 270), (262, 236)], fur, 12)
    P.ellipse((248, 216, 278, 246), fill=mane)
    P.ellipse((88, 190, 212, 330), fill=fur)
    P.ellipse((118, 220, 182, 318), fill=light)
    P.ellipse((96, 306, 138, 336), fill=fur)
    P.ellipse((162, 306, 204, 336), fill=fur)
    P.ellipse((72, 236, 104, 296), fill=fur)
    if not wave:
        P.ellipse((196, 236, 228, 296), fill=fur)
    # mane petals
    import math as _m
    for k in range(14):
        a = 2 * _m.pi * k / 14
        x, y = 150 + 86 * _m.cos(a), 122 + 86 * _m.sin(a)
        P.ellipse((x - 34, y - 34, x + 34, y + 34), fill=mane if k % 2 else shade(mane, 1.12))
    P.ellipse((70, 42, 230, 202), fill=mane)
    P.ellipse((92, 54, 128, 90), fill=fur)
    P.ellipse((172, 54, 208, 90), fill=fur)
    P.ellipse((100, 62, 120, 82), fill=hx("#F9A8D4"))
    P.ellipse((180, 62, 200, 82), fill=hx("#F9A8D4"))
    P.ellipse((86, 64, 214, 194), fill=fur)
    P.ellipse((116, 132, 184, 186), fill=light)
    _face_features(P, 150, 116, eyes, mouth, ink="#3B2412", spread=27, eye_w=8, eye_h=11, mouth_y=44, mouth_w=13)
    P.poly([(138, 136), (162, 136), (150, 150)], fill=hx("#7C2D12"))
    if wave:
        P.line([(206, 246), (252, 186)], fur, 30)
        P.ellipse((234, 156, 274, 196), fill=fur)
        for dx in (-10, 0, 10):
            P.ellipse((250 + dx - 4, 158, 250 + dx + 4, 166), fill=shade(fur, 0.8))
    return P.done()


def character(kind, eyes="open", mouth=0, wave=False, scale=0.8):
    """Presenter sprite. kind: ollie | maryam | yusuf | robo | sheru."""
    if kind == "maryam":
        return maryam(eyes, mouth, wave, scale)
    if kind == "yusuf":
        return yusuf(eyes, mouth, wave, scale)
    if kind == "robo":
        return robo(eyes, mouth, wave, scale)
    if kind == "sheru":
        return sheru(eyes, mouth, wave, scale)
    return owl(eyes, mouth, wave, scale)


@lru_cache(maxsize=None)
def star(color="#FFD43B", size=60, outline="#F08C00"):
    P = Pen(100, 100, size / 100)
    pts = []
    for i in range(10):
        r = 48 if i % 2 == 0 else 21
        a = -math.pi / 2 + i * math.pi / 5
        pts.append((50 + r * math.cos(a), 52 + r * math.sin(a)))
    P.poly(pts, fill=hx(color), outline=hx(outline) if outline else None, width=4)
    return P.done()


@lru_cache(maxsize=None)
def star8(color="#FFFFFF", size=80, alpha=60):
    P = Pen(100, 100, size / 100)
    c = hx(color)[:3] + (alpha,)
    P.poly([(50, 4), (63, 37), (96, 50), (63, 63), (50, 96), (37, 63), (4, 50), (37, 37)], fill=c)
    P.rrect((22, 22, 78, 78), 2, fill=c)
    return P.done()


@lru_cache(maxsize=None)
def badge(kind="check", size=90):
    P = Pen(100, 100, size / 100)
    if kind == "check":
        P.ellipse((4, 4, 96, 96), fill=hx("#2DBE60"), outline=(255, 255, 255, 255), width=6)
        P.line([(28, 52), (44, 68), (73, 34)], (255, 255, 255, 255), 11)
    else:
        P.ellipse((4, 4, 96, 96), fill=hx("#F0453A"), outline=(255, 255, 255, 255), width=6)
        P.line([(33, 33), (67, 67)], (255, 255, 255, 255), 11)
        P.line([(67, 33), (33, 67)], (255, 255, 255, 255), 11)
    return P.done()


@lru_cache(maxsize=None)
def bubble(size=60, kind="circle", color="#FFFFFF"):
    P = Pen(100, 100, size / 100)
    c = hx(color)
    if kind == "circle":
        P.ellipse((6, 6, 94, 94), fill=c[:3] + (55,), outline=c[:3] + (120,), width=4)
        P.ellipse((24, 22, 40, 38), fill=c[:3] + (150,))
    else:
        pts = []
        for i in range(10):
            r = 46 if i % 2 == 0 else 20
            a = -math.pi / 2 + i * math.pi / 5
            pts.append((50 + r * math.cos(a), 52 + r * math.sin(a)))
        P.poly(pts, fill=c[:3] + (90,))
    return P.done()


@lru_cache(maxsize=None)
def arrow(length=120, color="#8E5CF0", vertical=False):
    P = Pen(length, 60, 1.0)
    c = hx(color)
    P.line([(8, 30), (length - 30, 30)], c, 12)
    P.poly([(length - 40, 8), (length - 4, 30), (length - 40, 52)], fill=c)
    img = P.done()
    return img.rotate(-90, expand=True) if vertical else img


# ------------------------------------------------------------------ emoji (Twemoji SVG)
def _emoji_files(e):
    cps = [f"{ord(c):x}" for c in e]
    yield "-".join(cps)
    no_fe = [c for c in cps if c != "fe0f"]
    yield "-".join(no_fe)
    if no_fe:
        yield no_fe[0]


@lru_cache(maxsize=None)
def emoji(e, size=120):
    e = (e or "").strip()
    if e.startswith("cube"):
        colr = e.split("-", 1)[1] if "-" in e else "red"
        return cube(colr, int(size * 0.9))
    path = None
    for name in _emoji_files(e):
        p = os.path.join(EMOJI_DIR, name + ".svg")
        if os.path.exists(p):
            path = p
            break
    if path is None:
        return _emoji_fallback(e, size)
    import resvg_py
    png = resvg_py.svg_to_bytes(svg_path=path, width=int(size), height=int(size))
    from io import BytesIO
    return Image.open(BytesIO(bytes(png))).convert("RGBA")


@lru_cache(maxsize=None)
def _emoji_fallback(e, size):
    P = Pen(100, 100, size / 100)
    P.ellipse((6, 6, 94, 94), fill=hx("#FFC21A"), outline=hx("#F08C00"), width=4)
    P.ellipse((32, 36, 42, 50), fill=hx(INK))
    P.ellipse((58, 36, 68, 50), fill=hx(INK))
    P.arc((30, 44, 70, 76), 20, 160, hx(INK), 5)
    return P.done()


# ------------------------------------------------------------------ animation helpers
def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease_out_back(u, s=1.9):
    u -= 1
    return u * u * ((s + 1) * u + s) + 1


def ease_io(u):
    u = clamp(u)
    return u * u * (3 - 2 * u)


def pop(t, t0, dur=0.38):
    if t0 is None or t < t0:
        return 0.0
    u = (t - t0) / dur
    return 1.0 if u >= 1 else max(0.0, ease_out_back(u))


def bump(t, t0, dur=0.35):
    if t0 is None or t < t0 or t > t0 + dur:
        return 0.0
    return math.sin(math.pi * (t - t0) / dur)


_scaled = {}


def put(fr, sp, cx, cy, scale=1.0, alpha=1.0):
    if sp is None or scale <= 0.02 or alpha <= 0.02:
        return
    if abs(scale - 1) > 0.01:
        q = round(scale, 2)
        key = (id(sp), q)
        if key not in _scaled:
            w, h = sp.size
            _scaled[key] = sp.resize((max(1, int(w * q)), max(1, int(h * q))), Image.BILINEAR)
            if len(_scaled) > 3000:
                _scaled.clear()
        sp = _scaled[key]
    if alpha < 0.98:
        sp = sp.copy()
        sp.putalpha(sp.getchannel("A").point(lambda v: int(v * alpha)))
    w, h = sp.size
    fr.paste(sp, (int(cx - w / 2), int(cy - h / 2)), sp)


def T(d, s, cx, cy, size, fill=INK, w=600, stroke=0, sf="#FFFFFF", anchor="mm", scale=1.0):
    if scale <= 0.05 or not s:
        return
    sz = max(6, int(size * scale / 2) * 2)
    d.text((cx, cy), s, font=font(sz, w), fill=col(fill), anchor=anchor,
           stroke_width=int(stroke * scale), stroke_fill=col(sf))


def wrap(text, f, maxw):
    words, lines, cur = text.split(), [], ""
    for wd in words:
        trial = (cur + " " + wd).strip()
        if f.getlength(trial) <= maxw or not cur:
            cur = trial
        else:
            lines.append(cur)
            cur = wd
    if cur:
        lines.append(cur)
    return lines


def fit_lines(text, maxw, size, max_lines=2, weight=600, min_size=24):
    """Shrink font until the wrapped text fits max_lines lines of maxw."""
    size = int(size)
    while True:
        f = font(size, weight)
        lines = wrap(text, f, maxw)
        if (len(lines) <= max_lines and all(f.getlength(l) <= maxw for l in lines)) or size <= min_size:
            return lines, size
        size = int(size * 0.92)


def TB(d, text, cx, cy, maxw, size, fill=INK, w=600, stroke=0, sf="#FFFFFF", max_lines=2, scale=1.0,
       line_gap=1.15, anchor_x="m"):
    """Wrapped, auto-fitting text block centered at (cx, cy)."""
    if scale <= 0.05 or not text:
        return 0
    lines, sz = fit_lines(text, maxw, size, max_lines, w)
    lh = sz * line_gap
    y0 = cy - lh * (len(lines) - 1) / 2
    for i, l in enumerate(lines):
        T(d, l, cx, y0 + i * lh, sz, fill, w, stroke, sf, anchor=anchor_x + "m", scale=scale)
    return lh * len(lines)


def pill(d, s, cx, cy, size, bgc, fg="#FFFFFF", padx=None, scale=1.0, outline=None, maxw=None):
    if scale <= 0.05 or not s:
        return
    size = int(size)
    f = font(int(size * scale), 600)
    fe = ["-kern"] if "hV" in s else None
    tw = f.getlength(s, features=fe)
    if maxw and tw > maxw * scale:
        size = int(size * maxw * scale / tw)
        f = font(int(size * scale), 600)
        tw = f.getlength(s, features=fe)
    px = (padx if padx is not None else size * 0.7) * scale
    h = size * 1.55 * scale
    box = (cx - tw / 2 - px, cy - h / 2, cx + tw / 2 + px, cy + h / 2)
    d.rounded_rectangle(box, radius=h / 2, fill=col(bgc), outline=col(outline) if outline else None,
                        width=4 if outline else 0)
    d.text((cx, cy + 2 * scale), s, font=f, fill=col(fg), anchor="mm", features=fe)
    return box


def card(d, box, fill="#FFFFFF", outline=None, width=6, r=34, shadow=(0, 0, 0)):
    x0, y0, x1, y1 = box
    d.rounded_rectangle((x0, y0 + 12, x1, y1 + 12), radius=r, fill=col(shadow))
    d.rounded_rectangle(box, radius=r, fill=col(fill), outline=col(outline) if outline else None,
                        width=width if outline else 0)


def eq_parts(text):
    """Split '5 + 5 = 10' into tokens."""
    return [tok for tok in re.split(r"\s+", text.strip()) if tok]


def eq(d, parts, cx, cy, size, t, stroke=8, w=700, maxw=None):
    """parts: list of (text, color, t_appear). Fixed layout; each part pops in."""
    f = font(size, w)
    gap = size * 0.28
    widths = [f.getlength(p[0]) for p in parts]
    total = sum(widths) + gap * (len(parts) - 1)
    if maxw and total > maxw:
        return eq(d, parts, cx, cy, int(size * maxw / total), t, stroke, w)
    x = cx - total / 2
    for (s, c, ta), wd in zip(parts, widths):
        sc = pop(t, ta)
        if sc > 0:
            T(d, s, x + wd / 2, cy, size, c, w, stroke=stroke, scale=sc)
        x += wd + gap
    return cx - total / 2, cx + total / 2


def vprob(d, xr, ytop, a, b, ans, size, t, op="+", ca=INK, cb=INK, cans="#2DBE60", t_ab=-1, t_ans=None):
    f = font(size, 700)
    if pop(t, t_ab) <= 0:
        return
    T(d, str(a), xr, ytop, size, ca, 700, anchor="rm")
    T(d, str(b), xr, ytop + size * 1.1, size, cb, 700, anchor="rm")
    wmax = max(f.getlength(str(a)), f.getlength(str(b)), f.getlength(str(ans)), f.getlength("00"))
    T(d, op, xr - wmax - size * 0.25, ytop + size * 1.1, size, INK, 700, anchor="rm")
    lx0 = xr - wmax - size * 0.85
    d.rounded_rectangle((lx0, ytop + size * 1.72, xr + size * 0.12, ytop + size * 1.72 + max(5, size * 0.07)),
                        radius=4, fill=col(INK))
    sc = pop(t, t_ans)
    if sc > 0:
        sz = max(6, int(size * sc / 2) * 2)
        d.text((xr, ytop + size * 2.48), str(ans), font=font(sz, 700), fill=col(cans), anchor="rm")


def burst(fr, cx, cy, t, t0, n=10, dist=210, dur=0.9, size=52, color="#FFD43B"):
    if t0 is None:
        return
    u = (t - t0) / dur
    if not 0 <= u <= 1:
        return
    r = dist * (1 - (1 - u) ** 3)
    for k in range(n):
        a = 2 * math.pi * k / n + 0.35
        s = max(8, int(size * (1 - 0.75 * u) / 4) * 4)
        put(fr, star(color, s), cx + r * math.cos(a), cy + r * math.sin(a), alpha=1 - u * 0.6)


def ring(fr, cx, cy, r, frac, color, num):
    P = Pen(2 * r + 20, 2 * r + 20, 1.0, ss=2)
    P.ellipse((10, 10, 2 * r + 10, 2 * r + 10), fill=(255, 255, 255, 235))
    P.arc((16, 16, 2 * r + 4, 2 * r + 4), 0, 360, hx("#E7E2F3"), 14)
    if frac > 0:
        P.arc((16, 16, 2 * r + 4, 2 * r + 4), -90, -90 + 360 * frac, hx(color), 14)
    P.text((r + 10, r + 12), str(num), r * 0.95, hx(INK), 700)
    put(fr, P.done(), cx, cy)


def gradient(W, H, c0, c1):
    a, b = np.array(col(c0), float), np.array(col(c1), float)
    y = np.linspace(0, 1, H)[:, None, None]
    g = a * (1 - y) + b * y
    return Image.fromarray(np.repeat(g, W, axis=1).astype(np.uint8), "RGB")


def confetti_draw(d, t, W, H, seed=1, n=40, speed=1.0):
    rnd = random.Random(seed)
    for i in range(n):
        x0, ph, sp, c = rnd.uniform(0, W), rnd.uniform(0, 1), rnd.uniform(90, 170) * speed, rnd.choice(ACCENTS)
        y = ((ph * (H + 100) + t * sp) % (H + 100)) - 50
        x = x0 + 30 * math.sin(t * 1.3 + i)
        a = t * 3 + i
        s = 11
        pts = [(x + s * math.cos(a + k * math.pi / 2) * (1.0 if k % 2 == 0 else 0.5),
                y + s * math.sin(a + k * math.pi / 2) * (1.0 if k % 2 == 0 else 0.5)) for k in range(4)]
        d.polygon(pts, fill=col(c))
