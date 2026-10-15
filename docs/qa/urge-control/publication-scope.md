# Phase 11.8.1 — Git yayın kapsamı

Bu bir yayın önerisidir; stage, commit veya push yapılmadı. Kesin liste
[review-files.txt](review-files.txt), dosya sayıları ve çalışma ağacı byte toplamı
[review-manifest.json](review-manifest.json) içindedir. Git pack/transfer veya ZIP
boyutu tahmini değildir.

75 orijinal PNG (110.180.646 byte; 105,08 MiB) yerinde korunur. Yayına 22 PNG
(27.686.366 byte; 26,40 MiB) seçildi. PNG byte toplamı %74,87, kare sayısı
%70,67 azaldı. Hiçbir görüntü silinmedi, yeniden boyutlandırılmadı veya sıkıştırılmadı.

Seçim HTML ready/running; native normal ready/running/paused/completed/çıkış,
arka plan/restart; orta Dynamic Type; hedef ve dar maksimum Dynamic Type;
dar çıkış eylemleri; Reduced Motion ve üretim Panic/Urge/Slip dallarını kapsar.
[publication-assets.json](publication-assets.json) her karenin seçim gerekçesini,
[screenshot-hashes.json](screenshot-hashes.json) yalnız bu 22 dosyanın hash ve
ölçülerini tutar. Galeri bu açık listeden üretilir; klasördeki tüm PNG’ler taranmaz.

Diğer 53 PNG aynı klasörde yerel ve ignored kalır. Tam önceki screenshot ve
inceleme envanterleri `local-archive/` altında yerelde korunur. Klasörün
`.gitignore` dosyası yalnız seçilmiş PNG’lere izin verir. Yerel per-key storage
hash dökümleri yayın dışındadır; özet veri koruma ve üretim kaynak/kayıt kanıtları
korunur. Ham storage payload’ları ve sırlar yayın listesine alınmaz.

Audit/QA raporu, deterministik testler, ilgili önceki test logları, üretim
preservation kanıtları ve 11.8.2 entegrasyon önerisi korunur. Tam tarihsel native
koşu sonuçları yeniden çalıştırılmış gibi sunulmaz; yayınlanan inceleme notları
seçilmiş karelerin önceki onaylı incelemesinden alınmıştır. Bu görev Simulator’a
başvurmaz ve runtime, tipografi, sayaç, persistence veya navigasyon dosyalarını
değiştirmez.

Yayın doğrulaması: `npm run typecheck`, `npm run verify:urge-preview`,
`python3 scripts/verify-urge-preview-publication.py` ve `git diff --check`.
[Doğrulama sonucu](publication-verification.json).

Gelecekte stage işlemi yalnız açık dosya listesindeki yollarla yapılmalı.
`git add .`, klasörü topluca ekleme veya `-f` kullanılmamalı. `docs/patches/`,
`.local-design/`, `local-archive/`, seçilmeyen PNG’ler, yerel storage dökümleri,
sırlar ve ilgisiz eski dosya/loglar kapsam dışındadır. Önceki yerel review patch’i
korunur; bu yayın seçiminin dosya listesi olarak kullanılmaz.
