import math, random, sys
from PIL import Image, ImageDraw, ImageFilter

S = 1080
P = dict(lead=(34,30,32), stone=(86,80,76), ruby=(176,34,52), amber=(236,160,44), emerald=(32,128,84), sapphire=(36,70,158),
         amethyst=(118,62,142), rose=(224,128,150), clear=(214,226,222), honey=(246,214,128), white=(255,255,255))
GLASS = [P[k] for k in "ruby amber emerald sapphire amethyst rose clear honey".split()]

def jitter_grid(r, cols, rows):
    pts = {}
    for i in range(cols+1):
        for j in range(rows+1):
            x = i*S/cols + (r.uniform(-S/cols*.3, S/cols*.3) if 0 < i < cols else 0)
            y = j*S/rows + (r.uniform(-S/rows*.3, S/rows*.3) if 0 < j < rows else 0)
            pts[(i, j)] = (x, y)
    return pts

def shade(color, k):
    return tuple(int(max(0, min(255, c*k))) for c in color)

def pane(d, r, poly, color):
    # glass pane with a streak of lighter tone, then lead outline
    d.polygon(poly, fill=color)
    cx = sum(p[0] for p in poly)/len(poly); cy = sum(p[1] for p in poly)/len(poly)
    ang = r.uniform(0, 3.14); L = 120
    d.line((cx-math.cos(ang)*L, cy-math.sin(ang)*L, cx+math.cos(ang)*L, cy+math.sin(ang)*L), fill=shade(color, 1.25), width=r.randint(6, 14))
    d.line(poly+[poly[0]], fill=P["lead"], width=9, joint="curve")

def background(seed):
    r = random.Random(seed)
    im = Image.new("RGB", (S, S), P["lead"]); d = ImageDraw.Draw(im)
    cols, rows = r.choice([(4, 5), (5, 6), (6, 7), (3, 4)])
    g = jitter_grid(r, cols, rows)
    palette = r.sample(GLASS, r.randint(3, 5))
    for i in range(cols):
        for j in range(rows):
            quad = [g[(i, j)], g[(i+1, j)], g[(i+1, j+1)], g[(i, j+1)]]
            if r.random() < .4:   # split the quad on a diagonal
                k = r.randrange(2)
                tri1 = [quad[k], quad[k+1], quad[k+2]]; tri2 = [quad[k+2], quad[(k+3) % 4], quad[k]]
                pane(d, r, tri1, r.choice(palette)); pane(d, r, tri2, r.choice(palette))
            else:
                pane(d, r, quad, r.choice(palette))
    # stone tracery arch at the top in some windows
    if r.random() < .5:
        d.pieslice((-S*.1, -S*.5, S*1.1, S*.55), 0, 180, fill=None)
        d.arc((60, 40, S-60, S*.9), 180, 360, fill=P["stone"], width=26)
    return im

def star_pts(cx, cy, R, rot):
    return [(cx+math.cos(i*math.pi/9-math.pi/2+rot)*(R if i % 2 == 0 else R*.62),
             cy+math.sin(i*math.pi/9-math.pi/2+rot)*(R if i % 2 == 0 else R*.62)) for i in range(18)]

def rose_window(d, r, cx, cy, R, rot, mode, pal):
    # round frame of lead and stone
    d.ellipse((cx-R*1.3, cy-R*1.3, cx+R*1.3, cy+R*1.3), fill=P["stone"])
    d.ellipse((cx-R*1.2, cy-R*1.2, cx+R*1.2, cy+R*1.2), fill=P["lead"])
    if mode == "panes":   # nine wedge panes turn, star leaded over them
        for i in range(9):
            a0 = rot + i*2*math.pi/9; a1 = a0 + 2*math.pi/9
            d.pieslice((cx-R*1.12, cy-R*1.12, cx+R*1.12, cy+R*1.12), math.degrees(a0), math.degrees(a1), fill=pal[i % len(pal)], outline=P["lead"], width=7)
        d.polygon(star_pts(cx, cy, R, rot), fill=P["honey"], outline=P["lead"], width=8)
        d.polygon(star_pts(cx, cy, R*.4, -rot*2), fill=P["ruby"], outline=P["lead"], width=5)
    elif mode == "lattice":   # star as clear glass against dark blue, inner star counter-turning
        d.ellipse((cx-R*1.12, cy-R*1.12, cx+R*1.12, cy+R*1.12), fill=P["sapphire"])
        for i in range(9):
            a = -rot + i*2*math.pi/9
            d.line((cx, cy, cx+math.cos(a)*R*1.12, cy+math.sin(a)*R*1.12), fill=P["lead"], width=6)
        d.polygon(star_pts(cx, cy, R, rot), fill=P["clear"], outline=P["lead"], width=8)
        d.polygon(star_pts(cx, cy, R*.5, rot*2), fill=P["amber"], outline=P["lead"], width=6)
    else:   # jewel: star in ruby over amber glass, with a ring of small turning roundels
        d.ellipse((cx-R*1.12, cy-R*1.12, cx+R*1.12, cy+R*1.12), fill=P["amber"])
        for i in range(9):
            a = rot*2 + i*2*math.pi/9; px, py = cx+math.cos(a)*R*.98, cy+math.sin(a)*R*.98
            d.ellipse((px-R*.16, py-R*.16, px+R*.16, py+R*.16), fill=pal[i % len(pal)], outline=P["lead"], width=5)
        d.polygon(star_pts(cx, cy, R*.78, rot), fill=P["ruby"], outline=P["lead"], width=8)
        d.polygon(star_pts(cx, cy, R*.3, -rot), fill=P["honey"], outline=P["lead"], width=5)

def make(seed, path, mode):
    bg = background(seed); r = random.Random(seed+99)
    cx, cy, R = r.uniform(300, S-300), r.uniform(300, S-300), r.uniform(150, 230)
    pal = r.sample(GLASS, 5)
    frames = []; N = 36
    for f in range(N):
        im = bg.copy(); d = ImageDraw.Draw(im)
        rot = f/N * (2*math.pi/9)
        rose_window(d, r, cx, cy, R, rot, mode, pal)
        frames.append(im.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=70, loop=0, optimize=True)

out = sys.argv[1]; modes = ["panes", "lattice", "jewel"]
for i in range(12):
    make(1501 + i*37, f"{out}/glass-star-{i+1:02d}.gif", modes[i % 3]); print(i+1, modes[i % 3])
