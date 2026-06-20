import geo


def test_encode_is_stable_and_prefixes_by_proximity():
    a = geo.encode(42.1354, 24.7453)  # Plovdiv
    b = geo.encode(42.1355, 24.7454)  # ~15 m away
    assert isinstance(a, str) and len(a) == 9
    assert a[:6] == b[:6]             # close points share a prefix


def test_bbox_where_builds_params():
    frag, params = geo.bbox_where(42.0, 24.0, 43.0, 25.0)
    assert "lat BETWEEN" in frag and "lng BETWEEN" in frag
    assert params == [42.0, 43.0, 24.0, 25.0]


def test_attribute_known_city_to_oblast():
    assert geo.attribute(42.1354, 24.7453) == "Пловдив"        # Plovdiv


def test_attribute_outside_bulgaria_is_none():
    assert geo.attribute(48.8566, 2.3522) is None              # Paris
