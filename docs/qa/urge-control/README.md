# Zor An — native görsel karşılaştırma

[Galeriyi aç](index.html) · [Audit ve QA](../../phase11-8-1-urge-ui-qa.md) ·
[11.8.2 entegrasyon önerisi](../../phase11-8-2-urge-integration-proposal.md).

Galeri 75 orijinal kareden seçilmiş 22 gerçek Simulator/HTML PNG’sini yayımlar.
Diğer 53 PNG aynı klasörde ignored olarak korunur.

Galeri gerçek Simulator PNG’leri ile kaynak HTML fonksiyonlarından çizilen iki
referansı içerir. PNG’ler kırpılmadı veya düzenlenmedi. Hedef 402×874 pt, dar
375×812 pt; HTML 390×844 CSS px. Görseller eşit panel genişliğinde gösterilir.
HTML’nin dış font bağlantıları yüklenmedi; embedded Archivo korunur. Native
Inter ve React Native SVG kullanır; WebView yoktur.

`manual-inspection.json` gerçek piksel inceleme notlarını, `test-results.json`
koşuları, `storage-preservation.json` yalnız hash tabanlı veri koruma sonucunu
içerir. Hashler görsel doğruluk ölçütü değildir.

[Yayın kapsamı](publication-scope.md), [seçim listesi](publication-assets.json),
[önerilen Git dosyaları](review-files.txt) ve [dosya/boyut toplamı](review-manifest.json)
yayın seçimidir. Galeri yalnız bu 22 kareyi referans verir.

Ham/başarısız ara koşular `/tmp/bloom-urge-1181/` altında tutulur. Tam önceki envanterler `local-archive/` altında yerelde korunur.
`docs/patches/` altındaki text-only patch yerel önceki review içindir; Git yayın
listesi `review-files.txt` dosyasıdır. Commit/push yapılmadı.
