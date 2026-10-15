"""Build an HTML/native review gallery from untouched Simulator/HTML PNGs."""
from pathlib import Path
import hashlib
import html
import json
import struct

root = Path(__file__).resolve().parent.parent / 'docs/qa/urge-control'
assets = json.loads((root / 'publication-assets.json').read_text())
selection = assets['screenshots']
assert 16 <= len(selection) <= 24
assert len({row['file'] for row in selection}) == len(selection)
images = [root / row['file'] for row in selection]
assert all(file.parent == root and file.suffix == '.png' for file in images)
inventory = []
for file in images:
    raw = file.read_bytes()
    width, height = struct.unpack('>II', raw[16:24])
    inventory.append({'file': file.name, 'width': width, 'height': height, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
(root / 'screenshot-hashes.json').write_text(json.dumps(inventory, indent=2) + '\n')
for row, digest in zip(selection, inventory):
    row.update(bytes=digest['bytes'], sha256=digest['sha256'])
assets['publishedCaptureCount'] = len(selection)
assets['publishedBytes'] = sum(row['bytes'] for row in selection)
(root / 'publication-assets.json').write_text(json.dumps(assets, ensure_ascii=False, indent=2) + '\n')
def figure(name, label):
    return f'<figure><a href="{name}"><img loading="lazy" src="{name}" alt="{html.escape(label)}"></a><figcaption>{html.escape(label)}</figcaption></figure>'
parts = ['''<!doctype html><html lang="tr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bloom · Zor An · Phase 11.8.1</title><style>body{max-width:1200px;margin:auto;padding:24px;background:#080910;color:#eee;font:16px/1.6 system-ui}a{color:#abb5ff}h1{font-size:28px}h2{font-size:21px;margin-top:36px}.pair,.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:20px}.pair{max-width:850px}figure{margin:0;padding:12px;background:#151721;border-radius:18px}img{width:100%;height:auto;display:block}figcaption{padding-top:10px;font-size:13px}</style><h1>Bloom · Native Zor An · Phase 11.8.1</h1><p>HTML kaynak fonksiyonları / gerçek native Simulator karşılaştırması. Piksel içerikleri düzenlenmedi. HTML 390×844 CSS px, 2×; native hedef 402×874 pt, dar ekran 375×812 pt, 3×. Paneller aynı genişlikte gösterilir; pixel-perfect ölçüm değildir. HTML gövde fontu dış fontlar yüklenmediği için fallback olabilir, embedded Archivo korunur. Native Inter kullanır.</p><p>Yayın seçimi: 75 orijinal kareden 22 PNG. Diğer 53 kare yerelde korunur. Yeni Simulator koşusu yapılmadı; onaylı görüntülerin pikselleri değişmedi.</p><p>HTML “Serin 26 gün” ve “Geçti, bitir” metinleri yalnız referanstır. Native sonuç varsaymaz veya kayıt üretmez. Stepper ve alternatif kartlar bu fazda yok; 5/10/15/20 dk açık seçimdir. Yeni Pause, Urge veya Behavior Slip kaydı yoktur.</p><p><a href="../../phase11-8-1-urge-ui-qa.md">QA ve audit</a> · <a href="../../phase11-8-2-urge-integration-proposal.md">11.8.2 önerisi</a> · <a href="manual-inspection.json">Görsel inceleme notları</a> · <a href="test-results.json">Test sonuçları</a> · <a href="screenshot-hashes.json">Boyut/hash envanteri</a> · <a href="publication-assets.json">Seçim gerekçeleri</a> · <a href="publication-scope.md">Yayın kapsamı</a> · <a href="review-files.txt">Dosya listesi</a> · <a href="review-manifest.json">Dosya ve boyut toplamı</a> · <a href="publication-verification.json">Yayın doğrulaması</a></p>''']
for reference, native, label in [('html-ready.png','01-native-ready.png','Süre seçimi / LCD'), ('html-running.png','02-native-running.png','Sayım / nefes rehberi')]:
    parts += [f'<h2>{label}</h2><div class="pair">', figure(reference,'HTML · kaynak tasarım'), figure(native,'Native · geçici QA egzersizi'), '</div>']
shown = {'html-ready.png', 'html-running.png', '01-native-ready.png', '02-native-running.png'}
for group in dict.fromkeys(row['group'] for row in selection):
    rows = [row for row in selection if row['group'] == group and row['file'] not in shown]
    if rows:
        parts.append(f'<h2>{html.escape(group)}</h2><div class="grid">')
        for row in rows:
            parts.append(figure(row['file'], row['reason']))
        parts.append('</div>')
parts.append('</html>')
(root / 'index.html').write_text(''.join(parts))
print(len(images), 'selected, untouched PNGs inventoried; all original captures remain local.')
