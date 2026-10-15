# Practice görsel kabul kapısı

Bu belge gelecek QA koşuları için boş şablondur; mevcut koşunun gerçek sonuçları native-matrix.json ve manual-inspection.json içinde tutulur.

Bu kontrol listesi geçmeden sonraki fazın görsel QA sonucu başarılı yazılmaz. Screenshot varlığı veya SHA-256 doğrulaması yalnız artifact bütünlüğüdür.

- [ ] İzole yeni QA cihazı, port ve her koşuya yeni storage namespace; gerçek/önceki QA payload'ları korunmuş.
- [ ] Hedef ve daha dar desteklenen viewport; varsayılan, orta, maksimum iOS text category; native gerçek width/height/fontScale kaydı.
- [ ] Intro, running, paused, soru 1/2/3, özet/save, saved, history, Reset engeli/Home kartı.
- [ ] Start/exit onayları, boş geçmiş, tekrar tanıtım/ready, hata ve exact retry.
- [ ] Native PNG'leri gerçekten açıp üst/alt scroll karelerini birlikte inceleme; dosya adlarını ve gözlemi manual-inspection kaydına yazma.
- [ ] Türkçe sözcük ortası kırılma, glyph/label clipping, overlap ve safe-area/status-bar ihlali yok.
- [ ] Kritik yönerge/cevap tam; düğme içerik üstüne binmiyor; scroll sonunda bütün eylemler erişilir; modal kaydırılabilir ve kapanabilir.
- [ ] 1–10 değerleri, tam a11y label, minimum touch target ve doğal dikey büyüme korunur.
- [ ] Basış sonrası beklenen ekran; gerçek durable kayıt alanları ve ayrı IDs; Reset ve non-Practice state korunmuş.
- [ ] Typecheck, Practice UI/motion, navigation, persistence/ACK/Reset ve ilgili özellik regresyonları geçti.
- [ ] Başarısız kare/otomasyon denemeleri başarılı kanıtla karıştırılmadı; sınırlamalar ve test edilmeyen fiziksel/VoiceOver/OS motion durumları açık.
- [ ] Normal/maksimum yan yana galeri; hashler ayrı bütünlük kaydı; text-only patch ve diff check güncel.

Otomatik ölçülebilenler: role scaling, container word-fit hesapları, footer/column politikası, gizli ölçümün a11y dışına çıkması, tam string/value/target kuralları, dialog ScrollView yapısı, runtime/cleanup/save guard sonuçları. UIKit satır kırılması, gerçek görsel overlap, glyph clipping ve viewport oranı doğrudan piksel incelemesi gerektirir. Bir source assertion, screenshot hash'i veya galerinin oluşması bunları ispatlamaz.
