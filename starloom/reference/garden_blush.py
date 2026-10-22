import math, random, sys
from PIL import Image, ImageDraw

S = 1080
P = dict(blush=(245,219,226), pale=(251,238,241), peach=(246,214,198), cream=(251,241,232),
         coral=(239,155,132), salmon=(244,185,167), olive=(181,178,58), chart=(197,199,78),
         dark=(79,94,34), deep=(62,79,26), sage=(220,214,178), lav=(233,223,230), lilac=(220,210,222),
         ochre=(197,138,42), white=(255,255,255))
GROUND = [P[k] for k in "blush pale peach cream lav sage lilac".split()]
INK = [P[k] for k in "olive chart dark deep coral salmon".split()]

def torn(d, r, pts, fill):
    out = []
    for i, a in enumerate(pts):
        b = pts[(i+1) % len(pts)]
        for k in range(6):
            t = k/6; j = r.uniform(-7, 7) if k else 0
            out.append((a[0]+(b[0]-a[0])*t+j, a[1]+(b[1]-a[1])*t+j))
    d.polygon(out, fill=fill)

def blade(d, x, y, L, w, ang, fill):
    pts = []
    for k in range(13):
        t = k/12; px = L*t; py = -w*4*t*(1-t)
        pts.append((x+px*math.cos(ang)-py*math.sin(ang), y+px*math.sin(ang)+py*math.cos(ang)))
    for k in range(12, -1, -1):
        t = k/12; px = L*t; py = w*1.4*t*(1-t)
        pts.append((x+px*math.cos(ang)-py*math.sin(ang), y+px*math.sin(ang)+py*math.cos(ang)))
    d.polygon(pts, fill=fill)

def frond(d, r, x, y, fill):
    base = r.uniform(0, 6.28); n = r.randint(6, 10); spread = r.uniform(.9, 1.6); L = r.uniform(270, 495)
    for i in range(n):
        blade(d, x, y, L*r.uniform(.7, 1), r.uniform(22, 45), base-spread/2+spread*i/(n-1), fill)

def background(seed):
    r = random.Random(seed)
    im = Image.new("RGB", (S, S), r.choice(GROUND)); d = ImageDraw.Draw(im)
    for _ in range(8):
        w, h = r.uniform(225, 675), r.uniform(225, 675); x, y = r.uniform(-90, S-w+90), r.uniform(-90, S-h+90)
        fill = r.choice(GROUND) if r.random() < .75 else r.choice(INK)
        c = [(x, y), (x+w, y), (x+w, y+h), (x, y+h)]
        if r.random() < .5: c.pop(r.randrange(4))
        torn(d, r, c, fill)
    for _ in range(r.randint(2, 4)):
        frond(d, r, r.uniform(30, S-30), r.uniform(30, S-30), r.choice(INK))
    for _ in range(r.randint(6, 14)):
        cx, cy, rad = r.uniform(0, S), r.uniform(0, S), r.uniform(3.5, 11)
        d.ellipse((cx-rad, cy-rad, cx+rad, cy+rad), fill=P["ochre"])
    return im

def star_pts(cx, cy, R, rot):
    return [(cx+math.cos(i*math.pi/9-math.pi/2+rot)*(R if i % 2 == 0 else R*.62),
             cy+math.sin(i*math.pi/9-math.pi/2+rot)*(R if i % 2 == 0 else R*.62)) for i in range(18)]

def make(seed, path, mode):
    bg = background(seed); r = random.Random(seed+99)
    cx, cy, R = r.uniform(315, S-315), r.uniform(315, S-315), r.uniform(158, 248)
    frames = []; N = 36
    for f in range(N):
        im = bg.copy(); d = ImageDraw.Draw(im, "RGBA")
        rot = f/N * (2*math.pi/9)           # ninefold symmetry: 40 degrees closes the loop
        if mode == "fill":
            d.polygon(star_pts(cx, cy, R, rot), fill=P["cream"]+(230,))
            d.polygon(star_pts(cx, cy, R*.45, -rot*2), fill=r.choice(INK))
        elif mode == "line":
            d.polygon(star_pts(cx, cy, R, rot), outline=P["ochre"], width=7)
            d.polygon(star_pts(cx, cy, R*.7, -rot), outline=P["white"], width=4)
        else:  # rays
            for i in range(9):
                a = rot*3 + i*2*math.pi/9
                d.line((cx+math.cos(a)*36, cy+math.sin(a)*36, cx+math.cos(a)*(R+135), cy+math.sin(a)*(R+135)), fill=P["white"], width=4)
            d.polygon(star_pts(cx, cy, R, rot), fill=P["pale"]+(235,))
        frames.append(im.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=70, loop=0, optimize=True)

out = sys.argv[1]
for i, (seed, mode) in enumerate([(11, "fill"), (23, "line"), (37, "rays"), (49, "fill"), (58, "line"), (71, "rays")], 1):
    make(seed, f"{out}/rotating-star-{i:02d}.gif", mode)
    print(i, mode)
