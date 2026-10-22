# Specification

## Pipeline

```
theme.background(r) ─► still PIL.Image (S × S)
                            │  copied per frame
star.draw(d, mode, cx, cy, R, rot) ─► frame
render.quantize(frame) ─► palette image
render.write(frames, fmt, path)
batch.manifest(...)
```

The background is composed once per piece and reused for every frame. Only the star layer is redrawn.
This keeps a 36-frame render under a few seconds and guarantees the ground never flickers.

## Theme protocol (`themes/_base.py`)

```python
class Theme(Protocol):
    name: str                     # snake_case, used in filenames
    palette: dict[str, RGB]       # named tokens only; themes never use raw tuples elsewhere
    star_modes: list[str]         # at least three; cycled across a batch
    def background(self, r: random.Random, S: int) -> Image.Image: ...
    def star_colors(self, r: random.Random) -> dict: ...   # which tokens the star uses this piece
    def place_star(self, r: random.Random, S: int) -> tuple[float, float, float]:  # cx, cy, R
```

A theme may add its own star modes by registering a draw function in `star.MODES`, as the
stained-glass and print-shop references do. Mode functions receive `(draw, theme, cx, cy, R, rot, extras)`.

## Star (`star.py`)

- `star_pts(cx, cy, R, rot)` returns 18 points; outer radius R, inner radius 0.62 R, first point at −90°.
- Loop: `rot = f / N * (2π / 9)`. Any secondary rotation is `k * rot` for integer k.
- Built-in modes carried from the references: `fill`, `line`, `rays`, `glow`, `beams`, `tile`, `petals`,
  `overprint`, `knockout`, `halftone`, `panes`, `lattice`, `jewel`.

## Batch (`batch.py`)

- Seeds: `base + i * step` with a prime step, or `--unique` which draws seeds from a
  `random.Random(base)` and rejects any seed already present in `out/<theme>/manifest.json`.
- Filename: `<theme>-<seed>-<mode>.gif`. Never overwrite; a repeated seed is a no-op that reports the path.
- `manifest.json`: list of `{seed, mode, path, sha256, rendered_at}`.
- `--count N` is unbounded. Rendering is embarrassingly parallel; use `concurrent.futures` with
  one process per piece.

## Render (`render.py`)

- GIF: Pillow, `quantize(colors=96, method=MEDIANCUT, dither=NONE)`, `duration=70`, `loop=0`, `optimize=True`.
- APNG: Pillow, full colour, same timing. Preferred when the viewer supports it.
- MP4: `imageio-ffmpeg`, H.264, yuv420p, 14.3 fps (one frame per 70 ms), loop three times in the file
  so players without loop controls still read as continuous.
- `contact <batch-dir>`: frame 0 of every piece, 4 across, written as `contact.png`.

## CLI

```
starloom render <theme> [--count 12] [--seed 4096] [--unique] [--format gif|apng|mp4] [--size 1080]
starloom themes                      # list registered themes and their modes
starloom contact out/<theme>/<batch>
starloom check <theme>               # loop, determinism, render-at-size tests for one theme
```

## Tests (`tests/`)

- `test_loop.py`: rotate frame 0's star by 40° and compare to frame 36 (render N+1 frames for the test).
- `test_determinism.py`: render seed 11 twice, assert `tobytes()` equal for every frame.
- `test_themes.py`: every registered theme renders one piece at S=1080 and at S=480.
- `test_palette.py`: no raw RGB tuples in theme modules outside the `palette` dict (a regex over source).
