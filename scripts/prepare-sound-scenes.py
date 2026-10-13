"""Split the source SVG into native independently animated layers."""
import json, sys, re
import xml.etree.ElementTree as ET
from pathlib import Path
scenes = json.loads(Path(sys.argv[1], 'scenes.json').read_text())
output = {}
for name in ['ocean','fire','forest']:
    text = re.sub(r' rgba', ' rgba', scenes[name])
    root = ET.fromstring(text)
    defs = ET.tostring(root.find('defs'), encoding='unicode')
    # SVG turbulence, displacement and blur are browser-only effects.
    defs = re.sub(r'<filter\b.*?</filter>', '', defs, flags=re.S)
    base, layers, front = [], [], []
    for e in list(root)[1:]:
        cls = e.attrib.get('class', '')
        markup = ET.tostring(e, encoding='unicode')
        markup = re.sub(r' filter="[^"]*"| style="[^"]*"', '', markup)
        if cls in ['refl','mist','ffly','embers'] or cls.startswith(('wv ','row ')):
            layers.append({'kind':cls.split()[0], 'xml':markup})
        elif cls=='flames':
            for flame in e:
                layers.append({'kind':'flame','xml':ET.tostring(flame,encoding='unicode')})
        elif name=='fire' and e.tag in ['g','ellipse'] and not cls:
            front.append(markup)
        else: base.append(markup)
    def wrap(x): return '<svg xmlns="http://www.w3.org/2000/svg" width="390" height="520" viewBox="0 0 390 520" preserveAspectRatio="xMidYMid slice">'+defs+x+'</svg>'
    output[name]={'base':wrap(''.join(base)), 'layers':[dict(kind=l['kind'], xml=wrap(l['xml'])) for l in layers], 'front':wrap(''.join(front))}
# Rain is DOM/CSS in the source; express its deterministic layout as native SVG.
grad = '<defs><linearGradient id="sky" x2="0" y2="1"><stop stop-color="#0a0d1f"/><stop offset=".6" stop-color="#151a36"/><stop offset="1" stop-color="#22162e"/></linearGradient><radialGradient id="drop" cx=".35" cy=".3"><stop stop-color="#fff" stop-opacity=".75"/><stop offset=".45" stop-color="#fff" stop-opacity=".08"/><stop offset=".9" stop-color="#000" stop-opacity=".25"/></radialGradient>' + ''.join('<radialGradient id="light'+str(i)+'"><stop stop-color="'+c+'" stop-opacity=".5"/><stop offset="1" stop-color="'+c+'" stop-opacity="0"/></radialGradient>' for i,c in enumerate(['#ffb46b','#3a4bff','#e5484d','#aab3ff','#5ad0a0','#ffd27a']))+'</defs>'
def wrap(x): return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 390 520" preserveAspectRatio="xMidYMid slice">'+grad+x+'</svg>'
base='<rect width="390" height="520" fill="url(#sky)"/>' + ''.join(f'<circle cx="{(i*29)%100*3.9}" cy="{(45+(i*17)%45)*5.2}" r="{34+(i*23)%60}" fill="url(#light{i%6})"/>' for i in range(16))
drops=''.join(f'<ellipse cx="{(i*53)%96*3.9}" cy="{(i*31)%92*5.2}" rx="{(4+(i*7)%9)/2}" ry="{(4+(i*7)%9)*.575}" fill="url(#drop)"/>' for i in range(34))
streaks=''.join(f'<path d="M{(i*37)%100*3.9} {(i*73)%520}l-8 55" stroke="#d2dcff" stroke-opacity="{.18+(i%4)*.08}" stroke-width="1.4"/>' for i in range(44))
slides=''.join(f'<path d="M{39+i*62.4} {30+i*58}v60" stroke="#d2dcff" stroke-opacity=".16" stroke-width="3"/><ellipse cx="{39+i*62.4}" cy="{90+i*58}" rx="4.5" ry="5.5" fill="url(#drop)"/>' for i in range(6))
output['rain']={'base':wrap(base), 'layers':[{'kind':'rainfall','xml':wrap(streaks)},{'kind':'droplets','xml':wrap(slides)}], 'front':wrap(drops)}
Path('src/features/relaxing-sounds/soundSceneLayers.json').write_text(json.dumps(output,indent=2)+'\n')
