# starloom

A generator of tasteful, unique, looping animated illustrations. Every piece is a cut-paper or printed
composition in a named theme, with one nine-pointed star turning over it. Batches of any size, on demand,
no two alike, every one reproducible from its seed.

## What this project is

- Input: a theme name, a count, an optional seed, an output format.
- Output: square 1080 × 1080 loops (GIF by default; APNG and MP4 when asked), filed by theme and seed.
- Themes are small Python modules. Each one owns a palette, a set of motifs, and a background composer.
  The star, the loop timing, the rendering and the batch logic are shared and live outside the themes.

## Non-negotiables

1. **Seamless loop.** The star has ninefold symmetry, so a rotation of exactly 40° (2π/9) closes the cycle.
   Counter-rotating inner elements must use integer multiples of that angle (−2×, +3×, and so on).
   Never a cross-fade, never a hold frame.
2. **Determinism.** `theme + seed` must reproduce the same frames byte for byte. All randomness goes
   through one `random.Random(seed)` passed into the theme. No `random.random()` at module level,
   no `time`, no unseeded numpy.
3. **1080 × 1080, 36 frames, 70 ms per frame** unless the caller overrides. Geometry scales from `S`;
   never hard-code pixel sizes that assume 480.
4. **Flat colour.** These are paper and ink, not photographs. Quantize without dithering.
   GIF: ≤ 96 colours. Palette tokens are named in the theme and nowhere else.
5. **One star per piece.** The nine-pointed star is the only shared motif. Keep it light and legible.
   Do not add the Greatest Name or the ringstone symbol; those are not decorative material.
6. **Taste over quantity.** A batch where three pieces are good and nine are filler is a failure.
   See `docs/TASTE.md`. When a theme produces muddy or crowded output, fix the theme, not the seed.

## Layout

```
starloom/
  starloom/
    __init__.py
    star.py        # star_pts(), the three or more star treatments, loop math
    render.py      # frame loop, quantize, GIF / APNG / MP4 writers
    batch.py       # unique seeds, naming, manifest.json per batch
    cli.py         # starloom render <theme> --count 12 --seed 4096 --format gif
    themes/
      __init__.py  # registry: name -> module
      _base.py     # Theme protocol: palette, background(r) -> Image, star_mode(i)
      garden_blush.py
      dusk_reef.py
      ...
  reference/       # the original one-file scripts; read-only, the source of truth for each look
  docs/
  prompts/
  out/             # generated, git-ignored
```

## Working rules for Claude Code

- Read `docs/SPEC.md` before touching `starloom/`. Read `docs/THEMES.md` before writing a theme.
- Port a reference script to a theme module without changing its look. Render the same seed from both,
  diff the first frame; a port that drifts is wrong.
- Keep theme modules under ~150 lines. Shared drawing helpers (torn edges, blades, halftone, speckle)
  go in `starloom/draw.py`, imported by themes.
- After any render, open two frames from two different pieces and look at them before reporting done.
  `python -m starloom contact <batch-dir>` writes a contact sheet; use it.
- Pillow only for drawing. `imageio-ffmpeg` only for MP4. No other runtime dependencies without asking.
- Tests live in `tests/`. The ones that matter: loop closes (frame 0 == frame N under rotation),
  determinism (two renders of one seed are identical), every theme renders at S=1080 without error.
- Commit messages name the theme or module touched. One theme per PR.
