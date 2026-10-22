"""Seeds, naming, manifest.json per batch."""
import hashlib, json, os
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone

from . import render
from .themes import get

STEP = 17       # prime


def seeds(base, count, step=STEP):
    return [base + i * step for i in range(count)]


def existing(theme_dir, seed):
    """Path of a piece already rendered for this seed anywhere under the theme's directory."""
    for root, _, files in os.walk(theme_dir):
        for f in files:
            if f.split("-")[1:2] == [str(seed)]:
                return os.path.join(root, f)


def _one(job):
    name, seed, mode, path, fmt, S = job
    render.write(render.frames(get(name), seed, mode, S), fmt, path)
    with open(path, "rb") as fh:
        sha = hashlib.sha256(fh.read()).hexdigest()
    return dict(seed=seed, mode=mode, path=path, sha256=sha, rendered_at=datetime.now(timezone.utc).isoformat())


def run(name, count=12, seed=4096, fmt="gif", S=1080, out="out"):
    theme = get(name)
    theme_dir = os.path.join(out, name); batch_dir = os.path.join(theme_dir, str(seed))
    os.makedirs(batch_dir, exist_ok=True)
    jobs, skipped = [], []
    for i, s in enumerate(seeds(seed, count)):
        prior = existing(theme_dir, s)
        if prior:
            skipped.append(prior); continue
        mode = theme.star_modes[i % len(theme.star_modes)]
        jobs.append((name, s, mode, os.path.join(batch_dir, f"{name}-{s}-{mode}.{fmt}"), fmt, S))
    with ProcessPoolExecutor() as ex:
        done = list(ex.map(_one, jobs))
    mpath = os.path.join(batch_dir, "manifest.json")
    prior = json.load(open(mpath)) if os.path.exists(mpath) else []
    json.dump(prior + done, open(mpath, "w"), indent=1)
    return batch_dir, done, skipped
