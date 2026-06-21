import os
import sys
import cairosvg

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SVG_PATH = os.path.join(ROOT, "dokoga-logo.svg")
PUBLIC_DIR = os.path.join(ROOT, "frontend", "public")
ICONS_DIR = os.path.join(PUBLIC_DIR, "icons")

os.makedirs(ICONS_DIR, exist_ok=True)

# Copy official logo vector to favicon.svg
shutil_copy = True
try:
    import shutil
    shutil.copyfile(SVG_PATH, os.path.join(PUBLIC_DIR, "favicon.svg"))
    print("  -> Copied dokoga-logo.svg to public/favicon.svg")
except Exception as e:
    print(f"Error copying favicon: {e}")

print("Compiling high-resolution vector icons from dokoga-logo.svg...")

try:
    # Compile apple-touch-icon.png (180x180)
    cairosvg.svg2png(url=SVG_PATH, write_to=os.path.join(PUBLIC_DIR, "apple-touch-icon.png"), output_width=180, output_height=180)
    print("  -> Rendered apple-touch-icon.png (180x180)")

    # Compile icon-192.png (192x192)
    cairosvg.svg2png(url=SVG_PATH, write_to=os.path.join(ICONS_DIR, "icon-192.png"), output_width=192, output_height=192)
    print("  -> Rendered icon-192.png (192x192)")

    # Compile icon-512.png (512x512)
    cairosvg.svg2png(url=SVG_PATH, write_to=os.path.join(ICONS_DIR, "icon-512.png"), output_width=512, output_height=512)
    print("  -> Rendered icon-512.png (512x512)")

    print("\nVector icon compilation complete! All PNG assets are now crisp and perfect!")
except Exception as e:
    print(f"Error compiling icons: {e}")
    sys.exit(1)
