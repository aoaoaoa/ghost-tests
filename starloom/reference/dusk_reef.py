import math, random, sys
from PIL import Image, ImageDraw

S = 1080
P = dict(sand=(239,227,207), shell=(247,238,226), mist=(223,233,228), foam=(191,224,214), rose=(232,196,187), lilac=(217,211,227),
         teal=(47,127,122), deep=(31,79,88), indigo=(45,58,107), terra=(199,106,60), mustard=(217,165,58), sea=(111,179,168),
         ochre=(176,123,44), white=(255,255,255))
GROUND = [P[k] for k in "sand shell mist foam rose lilac".split()]
INK = [P[k] for k in "teal deep indigo terra sea mustard".split()]

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
    if r.random() < .7:   # fan shell
        sx, sy, R, ang = r.uniform(120, S-120), r.uniform(120, S-120), r.uniform(120, 220), r.uniform(0, 6.28)
        pts=[(sx,sy)]+[(sx+math.cos(ang+a/20*math.pi)*R, sy-math.sin(ang+a/20*math.pi)*R*math.cos(ang)+math.sin(ang)*0) for a in range(21)]
        pts=[(sx,sy)]+[(sx+math.cos(ang)*math.cos(t)*R-math.sin(ang)*math.sin(t)*R, sy+math.sin(ang)*math.cos(t)*R+math.cos(ang)*math.sin(t)*R) for t in [k*math.pi/20 for k in range(21)]]
        d.polygon(pts, fill=r.choice([P["terra"],P["mustard"],P["rose"]]))
        for k in range(1,7):
            t=k*math.pi/7; d.line((sx,sy, sx+math.cos(ang)*math.cos(t)*R-math.sin(ang)*math.sin(t)*R, sy+math.sin(ang)*math.cos(t)*R+math.cos(ang)*math.sin(t)*R), fill=r.choice(GROUND), width=6)
    if r.random() < .8:   # wave lines
        wx, wy, ww, wh = r.uniform(0, S-400), r.uniform(0, S-250), r.uniform(300, 500), r.uniform(120, 260)
        col = r.choice([P["white"], P["deep"]]); amp, per = r.uniform(12, 24), r.uniform(80, 140)
        yy = wy
        while yy < wy+wh:
            d.line([(x, yy+math.sin(x/per*6.28)*amp) for x in range(int(wx), int(wx+ww), 8)], fill=col, width=7, joint="curve"); yy += r.uniform(36, 56)
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
            d.polygon(star_pts(cx, cy, R, rot), fill=P["shell"]+(230,))
            d.polygon(star_pts(cx, cy, R*.45, -rot*2), fill=r.choice(INK))
        elif mode == "line":
            d.polygon(star_pts(cx, cy, R, rot), outline=P["mustard"], width=7)
            d.polygon(star_pts(cx, cy, R*.7, -rot), outline=P["white"], width=4)
        else:  # rays
            for i in range(9):
                a = rot*3 + i*2*math.pi/9
                d.line((cx+math.cos(a)*36, cy+math.sin(a)*36, cx+math.cos(a)*(R+135), cy+math.sin(a)*(R+135)), fill=P["white"], width=4)
            d.polygon(star_pts(cx, cy, R, rot), fill=P["sand"]+(235,))
        frames.append(im.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=70, loop=0, optimize=True)

out = sys.argv[1]
for i, (seed, mode) in enumerate([(101, "fill"), (113, "line"), (127, "rays"), (139, "fill"), (151, "line"), (163, "rays")], 1):
    make(seed, f"{out}/dusk-star-{i:02d}.gif", mode)
    print(i, mode)
