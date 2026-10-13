"""Build a local QA gallery and hash manifest; never modify screenshot pixels."""
from pathlib import Path
import hashlib, html, json, struct
root = Path('docs/qa/counter-history')
refs = sorted(root.glob('html-*.png'))
native = sorted((root/'screenshots').glob('*.png'))
previous = sorted((root/'previous-review').glob('*.png'))
images = refs + native + previous
inventory=[]
for file in images:
    data=file.read_bytes(); width,height=struct.unpack('>II',data[16:24])
    inventory.append({'path':file.relative_to(root).as_posix(),'width':width,'height':height,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
(root/'screenshot-hashes.json').write_text(json.dumps(inventory,indent=2)+'\n')

def figure(file, label=None):
    rel=file.relative_to(root).as_posix(); label=label or file.stem.replace('-', ' ')
    if file.name in ['16-native-empty-tracking-history.png','17-native-incomplete-feedback.png','21-native-tracking-preserved.png','04-native-retry-already-saved.png']: label += ' · önceki presentation / veri kanıtı'
    return f'<figure><a href="{html.escape(rel)}"><img loading="lazy" src="{html.escape(rel)}" alt="{html.escape(label)}"></a><figcaption>{html.escape(label)}</figcaption></figure>'
pairs=[('html-counter-top.png','31-native-final-counter-top.png','Sayaç: hedef/toplam fixture yerine gerçek en uzun seri ve başlangıç'),
       ('html-counter-calendar.png','32-native-final-counter-calendar.png','Takvim: örnek renkler yerine gerçek takip süreleri'),
       ('html-counter-stopped.png','12-native-stopped.png','Durdurulan sayaç ve korunan geçmiş'),
       ('html-counter-protection.png','33-native-final-counter-bottom.png','Koruma: native sistem engellemesi kullanılamıyor')]
sections=[]
for ref,shot,label in pairs:
    files=[root/ref,root/'screenshots'/shot]
    if all(f.exists() for f in files): sections.append('<h2>'+html.escape(label)+'</h2><div class="pair">'+''.join(figure(f,'HTML referansı' if i==0 else 'Native · gerçek QA kaydı') for i,f in enumerate(files))+'</div>')
page='''<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bloom 11.6.2 · Sayaç ve geçmiş</title><style>
body{background:#090910;color:#f1f1f7;font:16px/1.6 system-ui;margin:0;padding:24px;max-width:1440px;margin:auto}h1{font-size:28px}h2{font-size:20px;margin-top:36px}a{color:#aab3ff}.grid,.pair{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}.pair{max-width:840px}figure{margin:0;background:#141415;padding:12px;border-radius:18px}img{width:100%;height:auto;display:block;border-radius:10px}figcaption{padding:12px 4px;overflow-wrap:anywhere;font-size:13px}p{max-width:980px}details{margin-top:28px}summary{cursor:pointer;color:#aab3ff}
</style><h1>Bloom · Phase 11.6.2</h1><p>HTML referansı / native sayaç detayı ve gerçek kayıt geçmişi. Screenshot pikselleri düzenlenmedi. HTML sayıları tasarım fixture’ıdır; native kayıtlar yalnız yeni, izole E2E namespace’lerinde gerçek acknowledged işlemlerle oluşturuldu. Metrik tanımları, sürüm/capture sınırları ve test sonuçları <a href="../../phase11-6-2-counter-history-qa.md">QA belgesinde</a>.</p>'''
page+=''.join(sections)
if previous:
    page+='<h2>Final review · en büyük Dynamic Type başlıkları</h2>'
    for name in ['37-native-large-counter-bottom.png','38-native-large-real-quality.png']:
        page+='<div class="pair">'+figure(root/'previous-review'/name,'Önce · kelime bölünmesi')+figure(root/'screenshots'/name,'Sonra · kısaltılmış başlık, tam font scaling')+'</div>'
    page+='<details><summary>Korunan önceki review capture’ları</summary><div class="grid">'+''.join(figure(f,'Önceki review · '+f.stem) for f in previous)+'</div></details>'
page+='<h2>Native akışlar ve erişilebilirlik</h2><div class="grid">'+''.join(figure(f) for f in native)+'</div>'
page+='<details><summary>Tüm HTML referansları</summary><div class="grid">'+''.join(figure(f) for f in refs)+'</div></details></html>'
(root/'index.html').write_text(page)
print(f'Gallery: {len(refs)} HTML + {len(native)} native PNGs + {len(previous)} preserved previous captures; all paths and hashes recorded.')
