import inspect, re

TUPLE = re.compile(r"\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)")


def test_no_raw_rgb_outside_palette(theme):
    src = inspect.getsource(theme)
    body = re.sub(r"^palette = dict\(.*?\)\n(?=\S)", "", src, flags=re.S | re.M)
    assert TUPLE.search(src), "palette not found"
    assert not TUPLE.findall(body), TUPLE.findall(body)
