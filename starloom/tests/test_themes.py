import pytest

from starloom import render


@pytest.mark.parametrize("S", [1080, 480])
def test_renders_at_size(theme, S, tmp_path):
    mode = theme.star_modes[0]
    path = tmp_path / f"{theme.name}-11-{mode}.gif"
    render.write(render.frames(theme, 11, mode, S=S), "gif", path)
    assert len(theme.star_modes) >= 3
    with render.Image.open(path) as im:
        assert im.size == (S, S) and im.n_frames == render.N
