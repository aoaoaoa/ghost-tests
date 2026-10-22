"""starloom render | themes | contact | check"""
import argparse, glob, os, sys

from . import batch, render
from .themes import THEMES, get


def main(argv=None):
    p = argparse.ArgumentParser(prog="starloom"); sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("render"); r.add_argument("theme")
    r.add_argument("--count", type=int, default=12); r.add_argument("--seed", type=int, default=4096)
    r.add_argument("--format", default="gif", choices=["gif", "apng", "mp4"])
    r.add_argument("--size", type=int, default=1080); r.add_argument("--out", default="out")
    sub.add_parser("themes")
    c = sub.add_parser("contact"); c.add_argument("batch_dir")
    k = sub.add_parser("check"); k.add_argument("theme")
    a = p.parse_args(argv)

    if a.cmd == "render":
        d, done, skipped = batch.run(a.theme, a.count, a.seed, a.format, a.size, a.out)
        for m in done: print(m["path"])
        for s in skipped: print(f"exists: {s}")
    elif a.cmd == "themes":
        for n, t in THEMES.items(): print(f"{n}: {', '.join(t.star_modes)}")
    elif a.cmd == "contact":
        paths = sorted(f for f in glob.glob(os.path.join(a.batch_dir, "*")) if f.endswith((".gif", ".png")) and "contact" not in f)
        print(render.contact(paths, os.path.join(a.batch_dir, "contact.png")))
    elif a.cmd == "check":
        get(a.theme)
        import pytest
        sys.exit(pytest.main([os.path.join(os.path.dirname(__file__), "..", "tests"), "-q", "-k", a.theme]))


if __name__ == "__main__":
    main()
