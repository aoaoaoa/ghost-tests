"""The nine-pointed star, its loop math, and the shared star treatments."""
import math

TURN = 2 * math.pi / 9          # ninefold symmetry: one turn of 40 degrees closes the loop
INNER = .62                     # inner radius as a fraction of R


def rot(f, N):
    """Rotation at frame f of N. Secondary rotations are integer multiples of this."""
    return f / N * TURN


def star_pts(cx, cy, R, rot):
    """18 points, outer radius R, inner radius 0.62 R, first point at -90 degrees."""
    return [(cx + math.cos(i * math.pi / 9 - math.pi / 2 + rot) * (R if i % 2 == 0 else R * INNER),
             cy + math.sin(i * math.pi / 9 - math.pi / 2 + rot) * (R if i % 2 == 0 else R * INNER)) for i in range(18)]


def px(n, S):
    """A length given at S=1080, scaled to S."""
    return n * S / 1080


def width(n, S):
    return max(1, round(n * S / 1080))


# Mode functions: (d, theme, cx, cy, R, rot, extras). `d` is an RGBA ImageDraw over the frame;
# extras holds the piece's star colours (RGB, from theme.star_colors) plus "S" and "im".

def fill(d, theme, cx, cy, R, rot, x):
    d.polygon(star_pts(cx, cy, R, rot), fill=x["fill"] + (230,))
    d.polygon(star_pts(cx, cy, R * .45, -rot * 2), fill=x["core"])


def line(d, theme, cx, cy, R, rot, x):
    S = x["S"]
    d.polygon(star_pts(cx, cy, R, rot), outline=x["line"], width=width(7, S))
    d.polygon(star_pts(cx, cy, R * .7, -rot), outline=x["line2"], width=width(4, S))


def rays(d, theme, cx, cy, R, rot, x):
    S = x["S"]; r0, r1 = px(36, S), R + px(135, S)
    for i in range(9):
        a = rot * 3 + i * TURN
        d.line((cx + math.cos(a) * r0, cy + math.sin(a) * r0, cx + math.cos(a) * r1, cy + math.sin(a) * r1),
               fill=x["ray"], width=width(4, S))
    d.polygon(star_pts(cx, cy, R, rot), fill=x["ray_star"] + (235,))


MODES = {"fill": fill, "line": line, "rays": rays}


def draw(d, mode, theme, cx, cy, R, rot, extras):
    MODES[mode](d, theme, cx, cy, R, rot, extras)
