"""The Theme protocol. A theme is a module that provides these names."""
import random
from typing import Protocol

from PIL import Image

RGB = tuple[int, int, int]


class Theme(Protocol):
    name: str                       # snake_case, used in filenames
    palette: dict[str, RGB]         # named tokens only; no raw tuples elsewhere in the module
    star_modes: list[str]           # at least three; cycled across a batch

    def background(self, r: random.Random, S: int) -> Image.Image: ...

    def place_star(self, r: random.Random, S: int) -> tuple[float, float, float]: ...   # cx, cy, R

    def star_colors(self, r: random.Random) -> dict[str, RGB]: ...    # role -> colour, fixed for the piece
