import math, random, sys
from PIL import Image, ImageDraw

S = 1080
P = dict(ivory=(246,240,226), plaster=(236,226,206), cobalt=(32,58,140), lapis=(22,40,100), turquoise=(58,170,172), jade=(40,120,100),
         cypress=(30,70,50), saffron=(232,178,54), coral=(226,112,88), terracotta=(176,88,54), rose=(232,196,186), white=(255,255,255))
WALL = [P["ivory"], P["plaster"], P["rose"]]
TILE = [P["cobalt"], P["lapis"], P["turquoise"], P["jade"], P["saffron"], P["coral"]]

def tiles(d, r, x, y, w, h, a, b, cell):
    for i in range(int(w/cell)+1):
        for j in range(int(h/cell)+1):
            c = a if (i+j) % 2 == 0 else b
            x0, y0 = x+i*cell, y+j*cell
            d.rectangle((x0, y0, x0+cell-3, y0+cell-3), fill=c)

def arch(d, r, x, y, w, h, color, inner):
    # pointed arch, cut from paper
    d.rectangle((x, y+w/2, x+w, y+h), fill=color)
    d.pieslice((x, y, x+w, y+w), 180, 360, fill=color)
    d.polygon([(x, y+w/2), (x+w/2, y-w*.35), (x+w, y+w/2)], fill=color)
    m = w*.12
    d.rectangle((x+m, y+w/2, x+w-m, y+h), fill=inner)
    d.pieslice((x+m, y+m, x+w-m, y+w-m), 180, 360, fill=inner)
    d.polygon([(x+m, y+w/2), (x+w/2, y-w*.35+m*1.6), (x+w-m, y+w/2)], fill=inner)

def cypress(d, r, x, y_base, h, color):
    w = h*.22
    d.polygon([(x, y_base-h), (x+w*.5, y_base-h*.55), (x+w*.35, y_base), (x-w*.35, y_base), (x-w*.5, y_base-h*.55)], fill=color)

def channel(d, r, x, y, w, h):
    d.rectangle((x, y, x+w, y+h), fill=P["turquoise"])
    for k in range(int(h/22)):
        yy = y+k*22+8
        d.line([(xx, yy+math.sin(xx/40)*4) for xx in range(int(x)+6, int(x+w)-6, 6)], fill=P["ivory"], width=3)

def background(seed):
    r = random.Random(seed)
    im = Image.new("RGB", (S, S), r.choice(WALL)); d = ImageDraw.Draw(im, "RGBA")
    # tile fields
    for _ in range(r.randint(1, 3)):
        w, h = r.uniform(240, 560), r.uniform(200, 520); x, y = r.uniform(-40, S-w+40), r.uniform(-40, S-h+40)
        a, b = r.sample(TILE, 2); tiles(d, r, x, y, w, h, a, b, r.choice([36, 48, 60]))
    # plaster patches over the tiles
    for _ in range(r.randint(2, 4)):
        w, h = r.uniform(180, 420), r.uniform(140, 380); x, y = r.uniform(0, S-w), r.uniform(0, S-h)
        d.rectangle((x, y, x+w, y+h), fill=r.choice(WALL))
    # arches
    for _ in range(r.randint(1, 3)):
        w = r.uniform(140, 260); h = r.uniform(w*1.3, w*2.1); x, y = r.uniform(20, S-w-20), r.uniform(60, S-h-20)
        arch(d, r, x, y, w, h, r.choice([P["cobalt"], P["terracotta"], P["jade"]]), r.choice(WALL+[P["turquoise"], P["saffron"]]))
    # water channel, sometimes
    if r.random() < .6:
        if r.random() < .5: channel(d, r, r.uniform(S*.3, S*.6), 0, r.uniform(70, 120), S)
        else: channel(d, r, 0, r.uniform(S*.55, S*.85), S, r.uniform(70, 120))
    # cypresses
    base = r.uniform(S*.8, S*.98)
    for _ in range(r.randint(2, 6)):
        cypress(d, r, r.uniform(40, S-40), base+r.uniform(-30, 30), r.uniform(160, 420), r.choice([P["cypress"], P["jade"]]))
    # saffron dots, like a tile border
    yb = r.uniform(S*.05, S*.95); c = r.choice([P["saffron"], P["coral"]])
    for x in range(20, S, 46): d.ellipse((x-7, yb-7, x+7, yb+7), fill=c)
    return im

def star_pts(cx, cy, R, rot):
    return [(cx+math.cos(i*math.pi/9-math.pi/2+rot)*(R if i % 2 == 0 else R*.62),
             cy+math.sin(i*math.pi/9-math.pi/2+rot)*(R if i % 2 == 0 else R*.62)) for i in range(18)]

def make(seed, path, mode):
    bg = background(seed); r = random.Random(seed+99)
    cx, cy, R = r.uniform(260, S-260), r.uniform(220, S*.6), r.uniform(140, 230)
    frames = []; N = 36
    for f in range(N):
        im = bg.copy(); d = ImageDraw.Draw(im, "RGBA")
        rot = f/N * (2*math.pi/9)
        if mode == "tile":   # star inlaid like a tile: ivory on cobalt disc
            d.ellipse((cx-R*1.12, cy-R*1.12, cx+R*1.12, cy+R*1.12), fill=P["cobalt"])
            d.polygon(star_pts(cx, cy, R, rot), fill=P["ivory"])
            d.polygon(star_pts(cx, cy, R*.42, -rot*2), fill=P["saffron"])
        elif mode == "line":
            d.polygon(star_pts(cx, cy, R, rot), outline=P["cobalt"], width=8)
            d.polygon(star_pts(cx, cy, R*.7, -rot), outline=P["saffron"], width=5)
            d.polygon(star_pts(cx, cy, R*.4, rot*2), outline=P["coral"], width=3)
        else:   # petals: nine lobes turning behind a plain star
            for i in range(9):
                a = -rot*2 + i*2*math.pi/9; px, py = cx+math.cos(a)*R*.95, cy+math.sin(a)*R*.95
                d.ellipse((px-R*.3, py-R*.3, px+R*.3, py+R*.3), fill=P["turquoise"]+(200,))
            d.polygon(star_pts(cx, cy, R*.85, rot), fill=P["ivory"])
            d.polygon(star_pts(cx, cy, R*.35, rot), fill=P["coral"])
        frames.append(im.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=70, loop=0, optimize=True)

out = sys.argv[1]; modes = ["tile", "line", "petals"]
for i in range(12):
    make(901 + i*29, f"{out}/garden-star-{i+1:02d}.gif", modes[i % 3]); print(i+1, modes[i % 3])
