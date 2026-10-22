import pytest

from starloom.themes import THEMES


def pytest_generate_tests(metafunc):
    if "theme" in metafunc.fixturenames:
        metafunc.parametrize("theme", list(THEMES.values()), ids=list(THEMES))
