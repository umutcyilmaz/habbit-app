#!/usr/bin/env python3
"""Curated publication gallery. Raw PNGs stay untouched, local and git-ignored."""
from pathlib import Path
import hashlib,html,json,struct
root=Path(__file__).resolve().parent.parent/'docs/qa/practice-typography'
assets=json.loads((root/'publication-assets.json').read_text());notes=json.loads((root/'manual-inspection.json').read_text())
assert len(notes)==12 and all(x.get('reviewed') for x in notes.values())
reviewed={case.removeprefix('camera-')+'-'+frame+'.png' for case,entry in notes.items() for frame in entry['reviewed']}
reviewed.update(json.loads((root.parent/'practice-persistence/reliability-results.json').read_text())['retainedCaptureReinspection']['files'])
selected={x['file']:x for x in assets['screenshots']};entries=[]
for name,row in sorted(selected.items()):
 data=(root/name).read_bytes();assert hashlib.sha256(data).hexdigest()==row['sha256'];w,h=struct.unpack('>II',data[16:24]);entries.append({**row,'width':w,'height':h,'visualCorrectnessEstablishedByHash':False,'explicitPixelInspectionRecorded':name in reviewed or name.startswith('rejected-'),'rejectedCandidate':name.startswith('rejected-')})
(root/'screenshot-hashes.json').write_text(json.dumps(entries,indent=2)+'\n')
def figure(name,label):
 assert name in selected,name
 label+=' · REDDEDİLEN ADAY' if name.startswith('rejected-') else ' · piksel inceleme notu var' if name in reviewed else ' · ek bağlam; bağımsız görsel geçiş iddiası yok'
 return '<figure><a href="'+html.escape(name)+'"><img loading="lazy" src="'+html.escape(name)+'" alt="'+html.escape(label)+'"></a><figcaption>'+html.escape(label)+'</figcaption></figure>'
parts=['''<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Practice · Typography QA</title><style>body{margin:auto;padding:24px;max-width:1200px;background:#09090d;color:#eee;font:16px/1.6 system-ui}a{color:#acb4ff}.row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}figure{margin:0;padding:10px;background:#17171b;border-radius:14px}img{width:100%;height:auto;display:block}figcaption{font-size:13px;margin-top:10px}h2{margin-top:42px}@media(max-width:700px){.row,.pair{grid-template-columns:1fr}}</style><h1>Bloom · Practice responsive typography</h1><p>Git için seçilmiş, düzenlenmemiş native PNG'ler. İki cihaz × üç kategori × fresh/Reset matrisinin 12 koşusu ve 204 gerçek piksel inceleme kaydı korunur. Yüzlerce ara kaydırma karesi yerelde kalır; galeride yalnız temsilî örnekler yayımlanır. Hashler dosya bütünlüğüdür, görsel doğruluk kanıtı değildir.</p><p><a href="../../phase11-7-2-practice-persistence-qa.md">QA raporu</a> · <a href="manual-inspection.json">Piksel inceleme notları</a> · <a href="native-matrix.json">Native matris / gerçek ölçekler</a> · <a href="publication-assets.json">Git screenshot manifesti</a> · <a href="screenshot-hashes.json">Ölçüler ve hashler</a> · <a href="../practice-persistence/publication-scope.md">Git / yerel arşiv ayrımı</a></p><p>Son lifecycle düzeltmesi metin, stil, tipografi veya yerleşimi değiştirmez. Bu kareler önceki onaylı native koşulardan korunur; yeni screenshot koşusu olarak sunulmaz. Geçici süreler gerçek QA egzersizine, Reset kayıtları sentetik fixture'a aittir.</p>''']
parts.append('<h2>Bulunan ve düzeltilen gerçek kırpılma</h2><div class="pair">'+figure('rejected-narrow-maximum-paragraph.png','Başarısız dar AX5 · sözcük sonu kesiliyor')+figure('narrow-maximum-question-2-warning.png','Onaylı düzeltme · takibini / değiştirmez. tam')+'</div>')
for device,label in [('target','iPhone 17 Pro · 402×874 pt'),('narrow','iPhone 13 mini · 375×812 pt')]:
 parts.append('<h2>'+label+' · normal / orta / maksimum</h2><div class="row">'+''.join(figure(f'{device}-{size}-intro.png',caption) for size,caption in [('default','Varsayılan · 1.0'),('moderate','Orta · 1.353'),('maximum','Maksimum · 3.571')])+'</div>')
parts.append('<h2>Normal / maksimum · tam akışın temsilî durumları</h2>')
for state,label in [('running','Egzersiz'),('paused-actions','Duraklama'),('question-1-endpoints','1/3 · 1–10 uç etiketleri'),('question-2-warning','2/3 · domain ayrımı'),('question-3-feelings','3/3 · yanıtlar ve hisler'),('summary-actions','Özet / açık kaydetme'),('saved-actions','Durable onay'),('history-answers','Geçmiş cevapları'),('save-retry','Hata / exact retry')]:
 parts.append('<h3>'+label+'</h3><div class="pair">'+figure('target-default-'+state+'.png','Normal')+figure('target-maximum-'+state+'.png','Maksimum')+'</div>')
parts.append('<h2>HTML / onaylı normal native</h2>')
for ref,state in [('intro','intro'),('practice','running'),('pause','paused-actions')]:
 path='../practice-persistence/html-'+ref+'.png';assert (root/path).exists()
 parts.append('<div class="pair"><figure><a href="'+path+'"><img loading="lazy" src="'+path+'" alt="HTML tasarım örneği"></a><figcaption>HTML · tasarım örneği</figcaption></figure>'+figure('target-default-'+state+'.png','Native · normal')+'</div>')
parts.append('<h2>Onaylar, Reset, Home ve dar ekran ayrıntıları</h2><div class="row">')
for name in sorted(selected):
 if name in {'rejected-narrow-maximum-paragraph.png'} or name.endswith('-intro.png') or any(name==f'target-{size}-{state}.png' for size in ['default','maximum'] for state in ['running','paused-actions','question-1-endpoints','question-2-warning','question-3-feelings','summary-actions','saved-actions','history-answers','save-retry']):continue
 parts.append(figure(name,name.removesuffix('.png')))
parts.append('</div></html>');(root/'index.html').write_text(''.join(parts)+'\n');print('Typography gallery:',len(selected),'published PNGs; raw archive unchanged')
