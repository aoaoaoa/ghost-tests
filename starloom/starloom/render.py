"""Frame loop, quantize, writers."""
import random

from PIL import Image, ImageDraw

from . import star

N = 36
DURATION = 70
COLORS = 96


def frames(theme, seed, mode, S=1080, N=N, upto=None):
    """RGB frames 0..upto-1 (default N) of one piece. The ground is composed once and reused."""
    bg = theme.background(random.Random(seed), S)
    r = random.Random(seed + 99)
    cx, cy, R = theme.place_star(r, S)
    extras = dict(theme.star_colors(r), S=S)
    out = []
    for f in range(N if upto is None else upto):
        im = bg.copy(); d = ImageDraw.Draw(im, "RGBA")
        star.draw(d, mode, theme, cx, cy, R, star.rot(f, N), dict(extras, im=im))
        out.append(im)
    return out


def quantize(frame, colors=COLORS):
    return frame.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)


def write(frames, fmt, path, duration=DURATION):
    if fmt != "gif":
        raise NotImplementedError(f"{fmt} writer not built yet")
    q = [quantize(f) for f in frames]
    q[0].save(path, save_all=True, append_images=q[1:], duration=duration, loop=0, optimize=True)


def contact(paths, out, across=4, tile=360, gap=12):
    """Frame 0 of every piece, `across` per row."""
    rows = -(-len(paths) // across)
    sheet = Image.new("RGB", (across * tile + (across + 1) * gap, rows * tile + (rows + 1) * gap), "white")
    for i, p in enumerate(paths):
        with Image.open(p) as im:
            im.seek(0); th = im.convert("RGB").resize((tile, tile), Image.Resampling.LANCZOS)
        sheet.paste(th, (gap + (i % across) * (tile + gap), gap + (i // across) * (tile + gap)))
    sheet.save(out)
    return out
