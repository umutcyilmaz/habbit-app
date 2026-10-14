"""Build local QA gallery. Screenshot pixels remain unchanged."""
from pathlib import Path
import hashlib,html,json,struct
root=Path('docs/qa/practice')
images=sorted(root.glob('*.png'))
inventory=[]
for file in images:
 data=file.read_bytes();w,h=struct.unpack('>II',data[16:24]);inventory.append({'path':file.name,'width':w,'height':h,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
(root/'screenshot-hashes.json').write_text(json.dumps(inventory,indent=2)+'\n')
def figure(name,label):
 return f'<figure><a href="{name}"><img loading="lazy" src="{name}" alt="{html.escape(label)}"></a><figcaption>{html.escape(label)}</figcaption></figure>'
page='''<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bloom · Practice 11.7.1</title><style>body{background:#090910;color:#f1f1f7;font:16px/1.6 system-ui;max-width:1300px;margin:auto;padding:24px}a{color:#aab3ff}h1{font-size:28px}h2{font-size:20px;margin-top:36px}.pair,.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}.pair{max-width:840px}figure{margin:0;background:#141415;padding:12px;border-radius:18px}img{width:100%;height:auto;display:block;border-radius:10px}figcaption{font-size:13px;padding:12px 4px}p{max-width:980px}summary{cursor:pointer;color:#aab3ff}</style><h1>Bloom · Native Practice · Phase 11.7.1</h1><p>Kaynak HTML / native Simulator karşılaştırması. HTML sayıları ve geçmişi tasarım örneğidir; native yalnız bu gerçek QA egzersizinin geçici süre ve kullanıcı beyanlarını gösterir. Native kaydetmez veya herhangi bir sayacı değiştirmez. Screenshot pikselleri düzenlenmedi. Native Inter, kaynak embedded Archivo ve dış font linkleri yüklenmediği için body fallback fontu kullanır. Normal native 402×874 pt / HTML 390×844 CSS px; aynı panel genişliğinde gösterim pixel-perfect ölçüm değildir.</p><p><a href="../../phase11-7-1-practice-ui-qa.md">QA raporu</a> · <a href="../../phase11-7-2-practice-persistence-proposal.md">11.7.2 model ve kararlar</a> · <a href="screenshot-hashes.json">PNG boyut/hash envanteri</a></p>'''
pairs=[('html-intro.png','01-native-intro.png','Tanıtım ve dört ilke'),('html-practice.png','03-native-practice.png','Pratik — dekoratif eğri ile açık ölçüm ayrımı'),('html-pause.png','04-native-pause.png','Duraklama — nefes küresi ve gerçek süre'),('html-question-1.png','06b-native-question-1-selected.png','Soru 1/3 — kullanıcı beyanı'),('html-question-2.png','07-native-question-2-yes.png','Soru 2/3 — amber seçimi; native sayaç sıfırlamaz'),('html-question-3.png','08-native-question-3.png','Soru 3/3 — bitiş ve hisler'),('html-summary.png','09-native-summary.png','Özet — native tamamlandı, kaydedilmedi')]
for ref,shot,label in pairs:
 if (root/ref).exists() and (root/shot).exists():page+='<h2>'+html.escape(label)+'</h2><div class="pair">'+figure(ref,'HTML · kaynak tasarım örneği')+figure(shot,'Native · gerçek geçici egzersiz')+'</div>'
page+='<h2>Akış, arka plan, restart ve en büyük metin</h2><div class="grid">'
for file in images:
 if not file.name.startswith('html-'):page+=figure(file.name,file.stem.replace('-',' '))
page+='</div>'
archive=root/'previous-review-final-visual'
if archive.exists():
 page+='<h2>14 Ekim 2026 · Son görsel düzeltmeler</h2><p>Normal başlıkta “fark et” birlikte kalır. Büyük metinde “Artışı” kelimesi bölünmez; erişilebilir başlık aynı anlamı korur. Ölçek uçları büyük metinde alt alta yerleşir. Eski QA kareleri korunur; 15b başlığın doğal kaydırmayla görülen devamıdır.</p>'
 for name,label in [('01-native-intro.png','Normal başlık'),('15-native-large-intro.png','En büyük metinde başlık'),('19-native-large-question-1.png','En büyük metinde uç etiketleri')]:
  page+='<h2>'+label+'</h2><div class="pair">'+figure('previous-review-final-visual/'+name,'Önce · korunmuş QA karesi')+figure(name,'Sonra · final native karesi')+'</div>'
page+='</html>'
(root/'index.html').write_text(page)
print(f'{len(images)} PNGs inventoried; gallery generated.')
