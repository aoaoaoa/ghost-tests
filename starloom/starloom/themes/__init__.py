"""Theme registry: name -> module."""
import importlib

NAMES = []

THEMES = {n: importlib.import_module(f"{__name__}.{n}") for n in NAMES}


def get(name):
    try:
        return THEMES[name]
    except KeyError:
        raise SystemExit(f"unknown theme {name!r}; known: {', '.join(THEMES) or 'none'}")
