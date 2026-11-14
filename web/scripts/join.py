"""Joins two screenshots side by side with labels: join.py design.png ours.png out.png"""
import sys

from PIL import Image, ImageDraw

a, b = Image.open(sys.argv[1]).convert("RGB"), Image.open(sys.argv[2]).convert("RGB")
if b.width != a.width:  # ours rendered at the canvas width (1440) -> same scale as the design image
    b = b.resize((a.width, round(b.height * a.width / b.width)), Image.LANCZOS)
gap, top = 24, 40
out = Image.new("RGB", (a.width + b.width + gap, max(a.height, b.height) + top), "white")
out.paste(a, (0, top))
out.paste(b, (a.width + gap, top))
d = ImageDraw.Draw(out)
d.text((10, 12), "DIZAYN", fill="black")
d.text((a.width + gap + 10, 12), "BIZNIKI", fill="black")
out.save(sys.argv[3])
