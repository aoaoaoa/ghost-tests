from PIL import ImageChops

from starloom import render


def test_loop_closes(theme):
    # Frame N is frame 0 turned by 40 degrees; ninefold symmetry makes them the same image.
    for i, mode in enumerate(theme.star_modes):
        fr = render.frames(theme, 11 + i, mode, S=480, upto=render.N + 1)
        assert ImageChops.difference(fr[0], fr[render.N]).getbbox() is None, mode
