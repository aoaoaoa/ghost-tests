"""Daylight tropical garden in torn pastel paper. Port of reference/garden_blush.py."""
from PIL import Image, ImageDraw

from ..draw import frond, patch, speckle, torn_panels
from ..star import px

name = "garden_blush"
palette = dict(blush=(245, 219, 226), pale=(251, 238, 241), peach=(246, 214, 198), cream=(251, 241, 232),
               coral=(239, 155, 132), salmon=(244, 185, 167), olive=(181, 178, 58), chart=(197, 199, 78),
               dark=(79, 94, 34), deep=(62, 79, 26), sage=(220, 214, 178), lav=(233, 223, 230), lilac=(220, 210, 222),
               ochre=(197, 138, 42), white=(255, 255, 255))
GROUND = [palette[k] for k in "blush pale peach cream lav sage lilac".split()]
INK = [palette[k] for k in "olive chart dark deep coral salmon".split()]
PATCH = dict(fill="dark deep olive coral", line="dark deep", rays="pale cream")   # grounds the star reads against
REACH = dict(fill=(2.4, 2.8), line=(2.5, 2.9), rays=(2.6, 3.0))   # patch size in R; line and rays need the star covered
star_modes = ["fill", "line", "rays"]


def background(r, S, star):
    cx, cy, R, mode = star
    im = Image.new("RGB", (S, S), r.choice(GROUND)); d = ImageDraw.Draw(im)
    torn_panels(d, r, S, GROUND, INK)
    for _ in range(r.randint(2, 4)):
        frond(d, r, r.uniform(px(30, S), S - px(30, S)), r.uniform(px(30, S), S - px(30, S)), r.choice(INK), S)
    speckle(d, r, S, palette["ochre"])
    patch(d, r, cx, cy, R, palette[r.choice(PATCH[mode].split())], S, REACH[mode])   # the star's own ground, laid last
    return im


def place_star(r, S):
    return r.uniform(px(315, S), S - px(315, S)), r.uniform(px(315, S), S - px(315, S)), r.uniform(px(158, S), px(248, S))


def star_colors(r):
    P = palette
    return dict(fill=P["cream"], core=r.choice(INK), line=P["ochre"], line2=P["white"], ray=P["ochre"], ray_star=P["dark"])
