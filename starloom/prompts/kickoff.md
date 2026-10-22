# Kickoff prompt

Paste this as the first message in Claude Code, from the `starloom/` directory.

---

Read CLAUDE.md, then docs/SPEC.md, docs/THEMES.md and docs/TASTE.md, in that order. The seven scripts in
reference/ are working generators I have already approved; their output is the standard.

Build the package described in SPEC.md. Work in this order and stop for review after step 3.

1. Create the package skeleton: `starloom/star.py`, `render.py`, `batch.py`, `cli.py`, `draw.py`,
   `themes/_base.py`, `themes/__init__.py`, `pyproject.toml` (Pillow pinned, imageio-ffmpeg optional),
   `tests/`. No theme yet.
2. Port `reference/garden_blush.py` to `themes/garden_blush.py` against that skeleton. Render seed 11 from
   the reference script and from the port, and show me that frame 0 is pixel-identical. If it is not,
   fix the port, not the reference.
3. Write the four tests in SPEC.md and make them pass for garden_blush. Run
   `starloom render garden_blush --count 12 --seed 4096` and `starloom contact` on the result; attach
   the contact sheet. Stop here.
4. On my go: port the remaining six references the same way, one commit each, each with its pixel
   check and its contact sheet.
5. Add APNG and MP4 writers and the `--unique` seed mode.
6. Build one new theme from the "not yet built" list in THEMES.md, following its recipe exactly, and
   show me thirty-six at S=480 as a contact sheet before rendering anything at 1080.

Rules while you work: never change a reference script; never add a dependency without asking; look at
rendered frames before saying a step is done; keep replies short and lead with what you need from me.
