import math, random, sys
from PIL import Image, ImageDraw, ImageChops

S = 1080
P = dict(kraft=(206,178,138), cream=(240,230,208), charcoal=(38,36,40), vermilion=(220,66,48), riso=(40,86,190),
         mint=(120,200,170), pink=(238,120,160), white=(255,255,255))
PAPER = [P["kraft"], P["cream"]]
INKS = [P["charcoal"], P["vermilion"], P["riso"], P["mint"], P["pink"]]

def multiply(base, layer):
    return ImageChops.multiply(base, layer)

def ink_layer(fn):
    """draw with fn onto white, return layer for multiply overprint"""
    L = Image.new("RGB", (S, S), P["white"]); d = ImageDraw.Draw(L); fn(d); return L

def halftone(d, r, x, y, w, h, color):
    pitch = r.choice([14, 18, 22]); ang = r.uniform(0, 1.2)
    for i in range(-int(h/pitch), int(w/pitch)+int(h/pitch)):
        for j in range(int(h/pitch)+1):
            px = x + i*pitch + j*pitch*math.sin(ang); py = y + j*pitch*math.cos(ang)
            if x <= px <= x+w and y <= py <= y+h:
                rad = pitch*.42*(1 - (py-y)/h*.85)
                d.ellipse((px-rad, py-rad, px+rad, py+rad), fill=color)

def grain(d, r, x, y, w, h, color):
    for yy in range(int(y), int(y+h), r.choice([9, 12, 15])):
        pts = [(xx, yy + math.sin(xx/90 + yy/40)*5 + r.uniform(-1, 1)) for xx in range(int(x), int(x+w), 8)]
        d.line(pts, fill=color, width=2)

def regmark(d, x, y, color):
    d.ellipse((x-16, y-16, x+16, y+16), outline=color, width=3)
    d.line((x-26, y, x+26, y), fill=color, width=3); d.line((x, y-26, x, y+26), fill=color, width=3)

def background(seed):
    r = random.Random(seed)
    paper = Image.new("RGB", (S, S), r.choice(PAPER))
    # faint paper tooth
    d = ImageDraw.Draw(paper)
    for _ in range(1400):
        x, y = r.uniform(0, S), r.uniform(0, S); d.point((x, y), fill=tuple(max(0, c-14) for c in paper.getpixel((0, 0))))
    # each ink is one layer, offset slightly for misregistration
    inks = r.sample(INKS, r.randint(2, 3))
    for ink in inks:
        def draw(d, ink=ink):
            for _ in range(r.randint(2, 4)):
                w, h = r.uniform(180, 520), r.uniform(140, 460); x, y = r.uniform(-40, S-w+40), r.uniform(-40, S-h+40)
                kind = r.random()
                if kind < .4: d.rectangle((x, y, x+w, y+h), fill=ink)
                elif kind < .6: d.ellipse((x, y, x+w, y+h), fill=ink)
                elif kind < .8: halftone(d, r, x, y, w, h, ink)
                else: grain(d, r, x, y, w, h, ink)
            if r.random() < .5:
                d.polygon([(r.uniform(0, S), r.uniform(0, S)) for _ in range(3)], fill=ink)
        L = ink_layer(draw)
        L = ImageChops.offset(L, int(r.uniform(-9, 9)), int(r.uniform(-9, 9)))
        paper = multiply(paper, L)
    d = ImageDraw.Draw(paper)
    for (x, y) in [(50, 50), (S-50, 50), (50, S-50), (S-50, S-50)]:
        if r.random() < .7: regmark(d, x, y, P["charcoal"])
    # a thin rule and a numeral, like a print-shop proof
    d.line((60, S-90, S-60, S-90), fill=P["charcoal"], width=2)
    return paper, inks

def star_pts(cx, cy, R, rot):
    return [(cx+math.cos(i*math.pi/9-math.pi/2+rot)*(R if i % 2 == 0 else R*.62),
             cy+math.sin(i*math.pi/9-math.pi/2+rot)*(R if i % 2 == 0 else R*.62)) for i in range(18)]

def make(seed, path, mode):
    bg, inks = background(seed); r = random.Random(seed+99)
    cx, cy, R = r.uniform(280, S-280), r.uniform(260, S-300), r.uniform(150, 240)
    a, b = P["vermilion"], P["riso"]
    frames = []; N = 36
    for f in range(N):
        rot = f/N * (2*math.pi/9)
        if mode == "overprint":   # two inks, the star printed twice and misregistered, turning against each other
            L1 = ink_layer(lambda d: d.polygon(star_pts(cx, cy, R, rot), fill=a))
            L2 = ink_layer(lambda d: d.polygon(star_pts(cx+12, cy+8, R, -rot), fill=b))
            im = multiply(multiply(bg, L1), L2)
        elif mode == "knockout":  # star left as bare paper inside a charcoal disc
            L = ink_layer(lambda d: (d.ellipse((cx-R*1.15, cy-R*1.15, cx+R*1.15, cy+R*1.15), fill=P["charcoal"]),
                                     d.polygon(star_pts(cx, cy, R, rot), fill=P["white"]),
                                     d.polygon(star_pts(cx, cy, R*.4, -rot*2), fill=a)))
            im = multiply(bg, L)
        else:   # halftone star: dots fade toward the points, outline in blue
            def draw(d):
                d.polygon(star_pts(cx, cy, R, rot), outline=b, width=9)
                for i in range(9):
                    ang = rot + i*2*math.pi/9 - math.pi/2
                    for k in range(1, 7):
                        t = k/7; px, py = cx+math.cos(ang)*R*t*.9, cy+math.sin(ang)*R*t*.9; rad = 14*(1-t)+3
                        d.ellipse((px-rad, py-rad, px+rad, py+rad), fill=a)
            im = multiply(bg, ink_layer(draw))
        frames.append(im.quantize(colors=96, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE))
    frames[0].save(path, save_all=True, append_images=frames[1:], duration=70, loop=0, optimize=True)

out = sys.argv[1]; modes = ["overprint", "knockout", "halftone"]
for i in range(12):
    make(1201 + i*31, f"{out}/press-star-{i+1:02d}.gif", modes[i % 3]); print(i+1, modes[i % 3])
