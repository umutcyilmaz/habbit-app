# Phase 11.7.2 — Git için önerilen QA kapsamı

Bu belge önerilen kapsamdır. Dosya stage edilmedi; commit/push yok. Kesin dosya ve boyut toplamı `review-manifest.json`, açık dosya listesi `review-files.txt` içindedir. Boyutlar çalışma ağacındaki byte toplamıdır; Git pack veya ağ aktarım boyutu tahmini değildir.

İki QA klasöründeki 368 ham PNG'nin tamamı yerinde korunur (83.249.883 byte). Git için 60 PNG seçilmiştir: persistence klasöründe 21, typography klasöründe 39; toplam 12.779.072 byte (12,19 MiB). PNG sayısı %83,7, PNG byte toplamı %84,6 azalmıştır. Görseller yeniden boyutlandırılmadı veya sıkıştırılmadı.

Yayınlananlar: temel HTML/native karşılaştırmaları; iki genişlikte normal/orta/maksimum intro; normal/maksimum ana akış ve cevaplar; onaylar, retry, Reset ve Home; dar maksimum paragraf düzeltmesi; iki açıkça reddedilmiş görsel örnek; migration/deletion/fail-closed/preview kanıtı. QA raporu/veri sözleşmesi, test sonuçları, migration/exact retry/veri koruma JSON ve logları, tam tarihsel native matrix ve gerçek inceleme notları korunur.

`publication-assets.json` ve `screenshot-hashes.json` yalnız Git'e önerilen PNG'leri listeler. Galeriler yalnız bu listelerden üretilir. Bir hash, görsel doğruluk onayı değildir. Önceki görsel denetim 12 case, 310 final kare ve 204 açılıp incelenmiş kare kaydını kapsıyordu; galerinin küçültülmesi bu denetimi yeni bir screenshot koşusu olarak sunmaz.

Yerelde kalanlar: 308 tekrar/ara kaydırma PNG'si, iki klasörün `local-raw-screenshots.json` envanterleri, önceki geçici teşhis/capture çıktıları ve `docs/patches/` inceleme yamaları. Klasörlerdeki `.gitignore` yalnız seçilmiş PNG'lere izin verir; tüm ham dosyalar disk üzerinde kalır. Tarihsel `manual-inspection.json` içindeki kare adları yerel tam koşunun kaydıdır; yayınlanmış asset manifesti değildir. Eski inceleme yamaları değiştirilmedi; güncel metin incelemesi ayrı `phase11-7-2-reliability-publication-text-only.patch` dosyasındadır ve Git kapsamı dışındadır.

Önerilen staging komutları yalnız `review-files.txt` listesindeki açık yolları kullanmalıdır. `git add .`, QA klasörünü topluca veya `-f` ile ekleme kullanılmaz. `.local-design/`, `docs/patches/`, geçici dosyalar ve ilgisiz eski QA/log dosyaları bu listeye alınmaz.

Önceki onaylı tipografi mimarisi byte düzeyinde aynı kaldı. Başlatma düzeltmesi yalnız iki ekranın lifecycle el sıkışmasını değiştirir. 375/402 pt × normal/orta/maksimum için 78 sabit rendered-state sözleşmesi eski onaylı kaynak ile aynı metin/stil/yerleşimi verir. Bu test native piksel incelemesi değildir; bu görev yeni native capture veya depolama işlemi yapmadı.
