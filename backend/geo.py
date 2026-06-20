"""Geo helpers: geohash, viewport bbox, oblast point-in-polygon attribution."""
import json, os
from functools import lru_cache
from shapely.geometry import shape, Point

_B32 = "0123456789bcdefghjkmnpqrstuvwxyz"
_GEOJSON = os.path.join(os.path.dirname(__file__), "..", "data", "app", "bg_oblasti.geojson")


def encode(lat: float, lng: float, precision: int = 9) -> str:
    lat_r, lng_r = (-90.0, 90.0), (-180.0, 180.0)
    out, bit, ch, even = [], 0, 0, True
    while len(out) < precision:
        if even:
            mid = sum(lng_r) / 2
            if lng > mid:
                ch |= 1 << (4 - bit); lng_r = (mid, lng_r[1])
            else:
                lng_r = (lng_r[0], mid)
        else:
            mid = sum(lat_r) / 2
            if lat > mid:
                ch |= 1 << (4 - bit); lat_r = (mid, lat_r[1])
            else:
                lat_r = (lat_r[0], mid)
        even = not even
        if bit < 4:
            bit += 1
        else:
            out.append(_B32[ch]); bit, ch = 0, 0
    return "".join(out)


def bbox_where(min_lat, min_lng, max_lat, max_lng):
    return ("lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?",
            [min_lat, max_lat, min_lng, max_lng])


@lru_cache(maxsize=1)
def _oblasti():
    fc = json.load(open(_GEOJSON, encoding="utf-8"))
    return [(f["properties"]["region_name"], shape(f["geometry"])) for f in fc["features"]]


def attribute(lat: float, lng: float):
    p = Point(lng, lat)
    for name, poly in _oblasti():
        if poly.contains(p):
            return name
    return None
