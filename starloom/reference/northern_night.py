import math, random, sys
from PIL import Image, ImageDraw

S = 1080
P = dict(navy=(18,28,52), ink=(10,16,34), slate=(44,58,92), steel=(78,98,138), ice=(196,220,236), frost=(232,240,246),
         aurora=(96,214,170), teal=(52,160,150), violet=(142,110,190), magenta=(190,98,150), gold=(238,200,110), white=(255,255,255))
SKY = [P["navy"], P["ink"], P["slate"]]

def ridge(d, r, y0, color, rough):
    pts = [(-10, S+10)]; x = -10; y = y0
    while x < S+10:
        step = r.uniform(40, 120); y = max(S*.3, min(S*.95, y + r.uniform(-rough, rough)))
        pts.append((x, y)); x += step
    pts += [(S+10, y), (S+10, S+10)]; d.polygon(pts, fill=color)

def pines(d, r, y_base, color, n):
    for _ in range(n):
        x = r.uniform(0, S); h = r.uniform(60, 160); w = h*.45
        for k in range(3):
            t = k/3; d.polygon([(x, y_base-h+t*h*.6), (x-w*(.5+t*.5), y_base-h*(.35-t*.3)+t*h*.3), (x+w*(.5+t*.5), y_base-h*(.35-t*.3)+t*h*.3)], fill=color)

def aurora(d, r, color, phase):
    # soft banded curtain drawn as translucent ribbons
    for b in range(4):
        y0 = r.uniform(S*.08, S*.45); amp = r.uniform(30, 80); per = r.uniform(300, 600); th = r.uniform(30, 70)
        top = [(x, y0+math.sin(x/per*6.28+phase+b)*amp) for x in range(0, S+1, 12)]
        bot = [(x, y+th+math.sin(x/120+b)*8) for x, y in reversed(top)]
        d.polygon(top+bot, fill=color+(70,))

def star_pts(cx, cy, R, rot):
    return [(cx+math.cos(i*math.pi/9-math.pi/2+rot)*(R if i % 2 == 0 else R*.62),
             cy+math.sin(i*math.pi/9-math.pi/2+rot)*(R if i % 2 == 0 else R*.62)) for i in range(18)]

def background(seed):
    r = random.Random(seed)
    im = Image.new("RGB", (S, S), r.choice(SKY)); d = ImageDraw.Draw(im, "RGBA")
    # gradient bands of sky, as torn paper strips
    for i in range(6):
        y = S*i/6; d.polygon([(0, y+r.uniform(-20, 20)), (S, y+r.uniform(-20, 20)), (S, y+S/6+r.uniform(-20, 20)), (0, y+S/6+r.uniform(-20, 20))],
                             fill=r.choice(SKY)+(120,))
    # stars field
    for _ in range(r.randint(60, 140)):
        x, y, rad = r.uniform(0, S), r.uniform(0, S*.75), r.uniform(1.5, 4.5)
        d.ellipse((x-rad, y-rad, x+rad, y+rad), fill=r.choice([P["frost"], P["ice"], P["gold"]]))
    # aurora ribbons
    aurora(d, r, r.choice([P["aurora"], P["teal"], P["violet"], P["magenta"]]), r.uniform(0, 6.28))
    if r.random() < .5: aurora(d, r, r.choice([P["aurora"], P["violet"]]), r.uniform(0, 6.28))
    # moon, sometimes
    if r.random() < .5:
        mx, my, R = r.uniform(150, S-150), r.uniform(120, S*.45), r.uniform(50, 110)
        d.ellipse((mx-R, my-R, mx+R, my+R), fill=P["frost"])
        if r.random() < .6: d.ellipse((mx-R+R*.5, my-R-R*.2, mx+R+R*.5, my+R-R*.2), fill=r.choice(SKY))
    # ridgelines, far to near
    cols = [P["steel"], P["slate"], P["navy"], P["ink"]]
    y = S*.55
    for i, c in enumerate(cols[:r.randint(2, 4)]):
        ridge(d, r, y, c, 40 + i*25); y += r.uniform(60, 110)
    pines(d, r, S*.98, P["ink"], r.randint(4, 12))
    # snow flecks on the ground
    for _ in range(r.randint(20, 50)):
        x, y = r.uniform(0, S), r.uniform(S*.7, S); d.ellipse((x-3, y-3, x+3, y+3), fill=P["ice"]+(180,))
    return im

def make(seed, path, mode):
    bg = background(seed); r = random.Random(seed+99)
    cx, cy, R = r.uniform(260, S-260), r.uniform(200, S*.55), r.uniform(140, 230)
    frames = []; N = 36
    for f in range(N):
        im = bg.copy(); d = ImageDraw.Draw(im, "RGBA")
        rot = f/N * (2*math.pi/9)
        if mode == "glow":
            for k, a in ((R*1.35, 40), (R*1.15, 70)):
                d.polygon(star_pts(cx, cy, k, rot), fill=P["gold"]+(a,))
            d.polygon(star_pts(cx, cy, R, rot), fill=P["frost"])
            d.polygon(star_pts(cx, cy, R*.4, -rot*2), fill=P["gold"])
        elif mode == "line":
            d.polygon(star_pts(cx, cy, R, rot), outline=P["ice"], width=7)
            d.polygon(star_pts(cx, cy, R*.68, -rot), outline=P["gold"], width=4)
            d.polygon(star_pts(cx, cy, R*.36, rot*2), outline=P["frost"], width=3)
        else:  # beams
            for i in range(9):
                a = rot*3 + i*2*math.pi/9
                d.polygon([(cx+math.cos(a-.03)*40, cy+math.sin(a-.03)*40), (cx+math.cos(a)*(R+220), cy+math.sin(a)*(R+220)),
                           (cx+math.cos(a+.03)*40, cy+math.sin(a+.03)*40)], fill=P["gold"]+(90,))
            d.polygon(star_pts(cx, cy, R, rot), fill=P["frost"])
        frames.append(im.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=70, loop=0, optimize=True)

out = sys.argv[1]; modes = ["glow", "line", "beams"]
for i in range(12):
    make(701 + i*23, f"{out}/north-star-{i+1:02d}.gif", modes[i % 3]); print(i+1, modes[i % 3])
