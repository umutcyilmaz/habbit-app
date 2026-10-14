# Native Practice karşılaştırma galerisi

[Galeriyi aç](index.html). [QA raporu](../../phase11-7-1-practice-ui-qa.md).

Kaynak HTML, supplied `tasarim.html` fonksiyonlarından ayrı headless Chrome
profiliyle çizildi. Dış font linkleri yüklenmedi; embedded Archivo korunur,
gövde fallback fontu olabilir. Native mevcut Bloom Inter fontlarını kullanır.
HTML’deki örnek süre, geçmiş/seri ve “kaydedildi” metinleri yalnız tasarım
referansıdır. Native hiçbir kayıt veya sayaç değişikliği yapmaz.

Native: iPhone 17 Pro / iOS 26.3, 1206×2622 px. HTML: 780×1688 px
(390×844 CSS px, 2x). Galeri aynı panel genişliğinde gösterir; screenshot
pikselleri düzenlenmedi. [Boyut ve SHA-256 envanteri](screenshot-hashes.json).

`01–10`, `06b` normal akış; `11–14` arka plan/duraklama/restart;
`15–23` en büyük erişilebilirlik metin boyutu ve kaydırma kanıtlarıdır.
Normal metin boyutu `large`, büyük boyut
`accessibility-extra-extra-extra-large`. Testten sonra `large` geri yüklenir.

`storage-before.json`, `storage-after.json`, `storage-comparison.json` yalnız
SHA-256 ve dosya sayısı içerir; mevcut kullanıcı kayıt içeriği export edilmez.
PNG’ler/ham Maestro artefact’leri text-only patch’e dahil değildir. Final
automation logları ve test sonuçları QA raporunda adlandırılır. Önceki
başarısız koşu logları tanı içindir; kabul kanıtı değildir.


14 Ekim final görsel review: `01/15` başlık ve `19` uç etiketleri güncellendi;
`06/06b` normal ölçek görünümü yenilendi; `15b` büyük başlığın devamını gösterir.
Galeri 32 güncel PNG ve korunmuş önce/sonra karelerini içerir. Önceki kareler,
hash listesi ve rapor `previous-review-final-visual/` altında korunur.
`final-visual-*` log/hash karşılaştırmaları yalnız bu son iki düzeltmenin kanıtıdır.


Yayın doğrulaması: `publish-test-results.json` ve `publish-*.log` yeniden çalışan
kontrollerin kanıtıdır. `docs/patches/` içindeki review patch’leri, ara/başarısız
koşu logları ve geçici dosyalar yerel kalır; commit’e dahil değildir. Eski QA raporu
arşivde tarihsel belge olarak korunur. Phase 11.7.2 yalnız öneri belgesidir.
