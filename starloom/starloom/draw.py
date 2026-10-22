"""Shared drawing helpers. Lengths are given at S=1080 and scaled by the caller's S."""
import math

from .star import px


def torn(d, r, pts, fill, S, jitter=7):
    """Polygon with torn-paper edges: six steps per side, each nudged diagonally."""
    j0 = px(jitter, S); out = []
    for i, a in enumerate(pts):
        b = pts[(i + 1) % len(pts)]
        for k in range(6):
            t = k / 6; j = r.uniform(-j0, j0) if k else 0
            out.append((a[0] + (b[0] - a[0]) * t + j, a[1] + (b[1] - a[1]) * t + j))
    d.polygon(out, fill=fill)


def torn_panels(d, r, S, grounds, inks, n=8, ink_odds=.25):
    """n torn rectangles (half of them cut to triangles), mostly ground, sometimes ink."""
    for _ in range(n):
        w, h = r.uniform(px(225, S), px(675, S)), r.uniform(px(225, S), px(675, S))
        x, y = r.uniform(-px(90, S), S - w + px(90, S)), r.uniform(-px(90, S), S - h + px(90, S))
        fill = r.choice(grounds) if r.random() < 1 - ink_odds else r.choice(inks)
        c = [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]
        if r.random() < .5: c.pop(r.randrange(4))
        torn(d, r, c, fill, S)


def blade(d, x, y, L, w, ang, fill):
    """A curved leaf blade from (x, y), length L, belly w, pointing at ang."""
    pts = []
    for k in range(13):
        t = k / 12; bx = L * t; by = -w * 4 * t * (1 - t)
        pts.append((x + bx * math.cos(ang) - by * math.sin(ang), y + bx * math.sin(ang) + by * math.cos(ang)))
    for k in range(12, -1, -1):
        t = k / 12; bx = L * t; by = w * 1.4 * t * (1 - t)
        pts.append((x + bx * math.cos(ang) - by * math.sin(ang), y + bx * math.sin(ang) + by * math.cos(ang)))
    d.polygon(pts, fill=fill)


def frond(d, r, x, y, fill, S):
    """A fan of 6 to 10 blades from one root."""
    base = r.uniform(0, 6.28); n = r.randint(6, 10); spread = r.uniform(.9, 1.6); L = r.uniform(px(270, S), px(495, S))
    for i in range(n):
        blade(d, x, y, L * r.uniform(.7, 1), r.uniform(px(22, S), px(45, S)), base - spread / 2 + spread * i / (n - 1), fill)


def speckle(d, r, S, fill, count=(6, 14), size=(3.5, 11)):
    """A scatter of round specks over the whole sheet."""
    for _ in range(r.randint(*count)):
        cx, cy, rad = r.uniform(0, S), r.uniform(0, S), r.uniform(px(size[0], S), px(size[1], S))
        d.ellipse((cx - rad, cy - rad, cx + rad, cy + rad), fill=fill)
