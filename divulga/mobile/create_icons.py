#!/usr/bin/env python3
"""Aplica a identidade NovaByte às variantes de launcher do APK de teste."""
from pathlib import Path
import cairosvg
from PIL import Image
from io import BytesIO
root = Path(__file__).resolve().parent
source = (root.parent / "icon.svg").read_bytes()
app = root / "android" / "app" / "src" / "main" / "res"
sizes = {"mdpi":48,"hdpi":72,"xhdpi":96,"xxhdpi":144,"xxxhdpi":192}
for density,px in sizes.items():
    dest=app / f"mipmap-{density}"
    dest.mkdir(parents=True, exist_ok=True)
    data=cairosvg.svg2png(bytestring=source,output_width=px,output_height=px)
    image=Image.open(BytesIO(data)).convert("RGBA")
    for filename in ("ic_launcher.png","ic_launcher_round.png","ic_launcher_foreground.png"):
        image.save(dest / filename,"PNG")
print("Ícones NovaByte Divulga gerados")
