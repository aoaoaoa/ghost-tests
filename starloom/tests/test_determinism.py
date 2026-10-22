from starloom import render


def test_same_seed_same_bytes(theme):
    for mode in theme.star_modes:
        a = [render.quantize(f).tobytes() for f in render.frames(theme, 11, mode, S=480)]
        b = [render.quantize(f).tobytes() for f in render.frames(theme, 11, mode, S=480)]
        assert a == b, mode
