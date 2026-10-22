import math, random, sys
from PIL import Image, ImageDraw

S = 1080
P = dict(bone=(243,236,222), clay=(229,196,170), sky=(205,226,232), sage=(208,214,190), blush=(240,214,205), straw=(236,222,176),
         cactus=(84,124,90), pine=(52,84,66), rust=(178,86,52), saffron=(226,168,52), lake=(70,128,150), plum=(110,70,95),
         ochre=(184,118,40), white=(255,255,255))
GROUND = [P[k] for k in "bone clay sky sage blush straw".split()]
INK = [P[k] for k in "cactus pine rust saffron lake plum".split()]

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
    for _ in range(r.randint(1, 3)):   # agave: a frond with fewer, stiffer blades
        base = r.uniform(0, 6.28); n = r.randint(5, 8); spread = r.uniform(1.4, 2.4); L = r.uniform(260, 460)
        x, y, col = r.uniform(60, S-60), r.uniform(60, S-60), r.choice([P["cactus"],P["pine"],P["lake"]])
        for i in range(n): blade(d, x, y, L*r.uniform(.75,1), r.uniform(14, 26), base-spread/2+spread*i/(n-1), col)
    for _ in range(r.randint(1, 3)):   # prickly pear paddles
        px, py, col = r.uniform(100, S-100), r.uniform(100, S-100), r.choice([P["cactus"],P["pine"]])
        ang = r.uniform(-.5, .5); 
        for k in range(r.randint(2, 4)):
            w, h = r.uniform(90, 150), r.uniform(130, 210)
            cx, cy = px + math.sin(ang)*k*h*.8 + r.uniform(-40,40), py - math.cos(ang)*k*h*.8
            d.ellipse((cx-w/2, cy-h/2, cx+w/2, cy+h/2), fill=col)
            for _ in range(r.randint(6, 12)):
                sx, sy = cx + r.uniform(-w*.35, w*.35), cy + r.uniform(-h*.35, h*.35)
                d.ellipse((sx-4, sy-4, sx+4, sy+4), fill=P["straw"])
    if r.random() < .6:   # stepped mesa along one edge
        col = r.choice([P["rust"],P["clay"],P["plum"]]); y0 = r.uniform(S*.55, S*.85); x = -10; pts=[(x, S+10)]
        while x < S+10:
            step = r.uniform(80, 200); pts += [(x, y0), (x+step, y0)]; x += step; y0 += r.choice([-1,1])*r.uniform(20, 70); y0 = max(S*.45, min(S*.9, y0))
        pts.append((S+10, S+10)); d.polygon(pts, fill=col)
    if r.random() < .5:   # sun arc
        sx, sy, R = r.uniform(200, S-200), r.uniform(150, S-150), r.uniform(120, 220)
        d.pieslice((sx-R, sy-R, sx+R, sy+R), 180, 360, fill=r.choice([P["saffron"],P["rust"],P["bone"]]))
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
            d.polygon(star_pts(cx, cy, R, rot), fill=P["bone"]+(230,))
            d.polygon(star_pts(cx, cy, R*.45, -rot*2), fill=r.choice(INK))
        elif mode == "line":
            d.polygon(star_pts(cx, cy, R, rot), outline=P["rust"], width=7)
            d.polygon(star_pts(cx, cy, R*.7, -rot), outline=P["white"], width=4)
        else:  # rays
            for i in range(9):
                a = rot*3 + i*2*math.pi/9
                d.line((cx+math.cos(a)*36, cy+math.sin(a)*36, cx+math.cos(a)*(R+135), cy+math.sin(a)*(R+135)), fill=P["white"], width=4)
            d.polygon(star_pts(cx, cy, R, rot), fill=P["straw"]+(235,))
        frames.append(im.quantize(colors=64, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=70, loop=0, optimize=True)

out = sys.argv[1]
modes = ["fill","line","rays"]
for i in range(12):
    make(301 + i*17, f"{out}/mesa-star-{i+1:02d}.gif", modes[i % 3])
    print(i+1, modes[i % 3])
