"""Generate PWA PNG icons from the brand mark (the purple 'докога' arrow).
The arrow silhouette is traced from public/favicon.svg's main path so we don't
need an SVG renderer. Outputs maskable 192/512 + a 180 apple-touch icon."""
import os
from PIL import Image, ImageDraw

HERE = os.path.dirname(__file__)
OUT = os.path.join(HERE, "..", "public", "icons")
APPLE = os.path.join(HERE, "..", "public", "apple-touch-icon.png")

# Absolute vertices of the favicon main path (viewBox 48 x 46), tiny corner
# radii flattened to points — the arrow silhouette.
PTS = [
    (25.946, 44.938), (23.925, 44.240), (23.925, 33.937), (21.663, 31.675),
    (10.287, 31.675), (9.367, 29.887), (16.847, 19.416), (15.005, 15.838),
    (1.237, 15.838), (0.317, 14.050), (10.013, 0.474), (10.933, 0.0),
    (39.827, 0.0), (40.747, 1.788), (33.267, 12.259), (35.109, 15.838),
    (46.486, 15.838), (47.376, 17.668), (25.947, 44.940),
]
VB_H = 46.0
NAVY = (2, 12, 32, 255)      # #020c20
PURPLE = (134, 59, 255, 255)  # #863bff


def render(size, mark_frac=0.58, bg=NAVY):
    ss = 4
    c = size * ss
    img = Image.new("RGBA", (c, c), bg)
    scale = (mark_frac * c) / VB_H
    mw = max(x for x, _ in PTS) * scale
    mh = VB_H * scale
    ox = (c - mw) / 2
    oy = (c - mh) / 2
    poly = [(ox + x * scale, oy + y * scale) for x, y in PTS]
    ImageDraw.Draw(img).polygon(poly, fill=PURPLE)
    return img.resize((size, size), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    render(192).save(os.path.join(OUT, "icon-192.png"))
    render(512).save(os.path.join(OUT, "icon-512.png"))
    # apple-touch needs no transparency and a bit more breathing room
    render(180, mark_frac=0.52).convert("RGB").save(APPLE)
    print("wrote icons to", os.path.normpath(OUT), "+ apple-touch-icon.png")


if __name__ == "__main__":
    main()
