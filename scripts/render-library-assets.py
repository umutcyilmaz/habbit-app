"""Offline rasterization of the exact SVG geometry extracted from tasarim.html.
Requires CairoSVG/Pillow in a temporary venv; no mobile dependency or WebView.
"""
from pathlib import Path
import io, re, math
import cairosvg
from PIL import Image
root=Path(__file__).resolve().parents[1]
assets=root/'src/features/library/assets'
for path in assets.glob('*.svg'):
    raw=path.read_text()
    # Pelvic cover combines the reference sky and its existing muscle SVG.
    sky=raw.split('</svg>')[0]+'</svg>'
    sky=sky.replace('<svg ', '<svg width="900" height="600" ',1)
    sky=sky.replace('<defs>', '<style>.tw{fill:white}</style><defs>',1)
    if path.stem=='moon':
        # CairoSVG uses alpha masks, whereas the reference uses a luminance mask.
        # Express the exact two-circle subtraction as arcs to preserve the crescent.
        dx,dy,r1,r2=18,-12,36,32
        distance=math.hypot(dx,dy)
        a=(r1*r1-r2*r2+distance*distance)/(2*distance)
        h=math.sqrt(r1*r1-a*a)
        midx,midy=150+a*dx/distance,84+a*dy/distance
        low=(midx-dy*h/distance,midy+dx*h/distance)
        high=(midx+dy*h/distance,midy-dx*h/distance)
        crescent=f'M{high[0]} {high[1]}A36 36 0 1 0 {low[0]} {low[1]}A32 32 0 0 1 {high[0]} {high[1]}Z'
        sky=re.sub(r'<circle cx="150" cy="84" r="36" fill="#eef0ff" mask="[^"]+"/>',f'<path fill="#eef0ff" d="{crescent}"/>',sky)

    png=cairosvg.svg2png(bytestring=sky.encode(),output_width=900,output_height=600)
    image=Image.open(io.BytesIO(png)).convert('RGBA')
    if path.stem=='pelvic':
        # Same anatomy geometry and native layers already used by Kegel.
        for layer in ['bones','bladder','muscle']:
            anatomy=Image.open(root/f'src/features/kegel/assets/{layer}.png').convert('RGBA').resize((540,405))
            image.alpha_composite(anatomy,(180,97))
    image.save(path.with_suffix('.png'))
bookmark='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 2.5h12A1.5 1.5 0 0 1 19.5 4v17.5L12 17l-7.5 4.5V4A1.5 1.5 0 0 1 6 2.5z" fill="white"/></svg>'
assets.joinpath('bookmark.svg').write_text(bookmark)
outline=bookmark.replace('fill="white"','fill="none" stroke="white" stroke-width="2"')
assets.joinpath('bookmark-outline.svg').write_text(outline)
cairosvg.svg2png(bytestring=outline.encode(),output_width=72,output_height=72,write_to=str(assets/'bookmark-outline.png'))
cairosvg.svg2png(bytestring=bookmark.encode(),output_width=72,output_height=72,write_to=str(assets/'bookmark.png'))
# Exact hero fade from .ahero::after, rendered as a reusable alpha overlay.
fade=Image.new('RGBA',(2,990))
for y in range(990):
    f=y/989
    alpha=.35*(1-f/.3) if f<.3 else 0 if f<.6 else (f-.6)/.4
    for x in range(2):fade.putpixel((x,y),(0,0,0,round(255*alpha)))
fade.save(assets/'hero-fade.png')

# Source .topfade: black at 75% opacity fading to transparent over 64 CSS px.
status_fade=Image.new('RGBA',(2,192))
for y in range(192):
    for x in range(2):status_fade.putpixel((x,y),(0,0,0,round(255*.75*(1-y/191))))
status_fade.save(assets/'status-fade.png')
