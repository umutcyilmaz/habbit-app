# Phase 11.7.2 — Practice veri modeli önerisi ve ürün kararları

Bu belge öneridir; Phase 11.7.1 hiçbir schema, migration veya Practice kaydı eklemez.
Practice, Masturbation Tracking’den ayrı bir rehberli egzersiz alanıdır. Boşalma ile
bitmesi bile onu otomatik bir MasturbationSession yapmaz. Legacy arousalControl da
bu alanın storage kaynağı değildir.

## Önerilen bağımsız kayıt

| Alan | Öneri / anlam |
| --- | --- |
| `id`, `version`, `source` | Ayrı Practice kimliği; ör. `guided_practice`, version 1 |
| `startedAt`, `completedAt`, `timeZone` | ISO tarih ve zaman bölgesi; trend için yerel gün kuralı ayrıca onaylanmalı |
| `status` | Taslak desteklenirse active / paused / awaitingReflection / completed; taslak yaşam döngüsü ayrı onay |
| `foregroundExerciseMs` | Aktif bölüm + bilinçli duraklamalar; arka plan ve çıkış onayı hariç |
| `activeMs`, `intentionalPauseMs` | Toplamın ayrıştırılmış değerleri; integral ve negatif olmayan |
| `pauses[]` | Egzersiz zaman çizgisinde `atMs`, `durationMs`; sıralı, çakışmayan |
| `suspensions[]` | Gerekirse background / confirmation nedenleri ve gerçek zaman aralıkları; egzersiz duraklamasından ayrı |
| `arousalReports[]` | `atMs`, 1–10 `level`, `source: user_reported`; hiçbir animasyon örneği kaydedilmez |
| `reflection.erectionQuality` | 1–10 kullanıcı beyanı veya skipped; arousal level ile aynı alan değildir |
| `reflection.explicitContent` | yes / no / skipped; başka sayaç değişikliği için tek başına yetki değildir |
| `reflection.ending` | came / stopped / soft / other / skipped |
| `reflection.feelings[]` | Kontrollü / Sakin / Aceleci / Kaygılı / Yorgun; isteğe bağlı çoklu seçim |
| `reflectionRevision`, `updatedAt` | Düzenleme onaylanırsa aynı kayıt revizyonu; yeni oturum yaratmaz |
| `introAcknowledgedVersion` | Kayıttan ayrı tercih; yalnız onaylanırsa saklanır |

Süre ve duraklama toplamları birbirini doğrulamalı; beyan zamanları oturum süresini
aşmamalı. Grafik, çizilmiş animasyondan gerçek seviye çıkaramaz. Eksik cevap ile
olumsuz cevap ayrı tutulmalı. Önizleme özetleri bir kayıt kimliği ya da tarihçe
oluşturmaz. Süre başarı puanı veya klinik ölçüm değildir.

## Phase 11.7.2 karar kontrol listesi

- [ ] Practice hangi program/modlarda açılır? Reset içindeki uygunluk ve giriş kısıtları nedir?
- [ ] Masturbation Tracking izni Practice için gerekli mi? Ayrı izin ve açıklama metni gerekir mi?
- [ ] Taslak yeniden başlatmada sürer mi, yoksa silinir mi? Süre aşımı ve yarım bırakma kuralı nedir?
- [ ] Arka plan süresi hariç tutulur mu? Otomatik dönüş yerine açık devam onayı üretimde de uygulanır mı?
- [ ] Çıkış onayı sırasında zaman durur mu? Kilit ekranı / kesintiler nasıl sınıflanır?
- [ ] Üç soru her zaman mı gösterilir? İçerik sorusu Content-Free açıkken mi görünür?
- [ ] Tüm soruları atlama serbest mi? Bitiş alanı üretimde zorunlu mu?
- [ ] Seviye beyanları hangi sıklıkta tutulur? Tekrarlanan aynı değer birleştirilir mi?
- [ ] “Evet” içerik cevabı ayrı ve açık bir onayla Content-Free olayına bağlanacak mı?
- [ ] Böyle bir bağlantı onaylanırsa sayaç olayı, undo/düzenleme/silme nasıl atomik uzlaştırılır?
- [ ] Practice ile ordinary tracking’e çift kayıt kesin olarak engellenecek mi? Kullanıcının açık ayrı kayıt isteği desteklenir mi?
- [ ] Özet yalnız başarılı durable write sonrasında mı “kaydedildi” der? Kabul edilmiş ama doğrulanmamış yazı için recovery/guard politikası nedir?
- [ ] İlk tanıtım hangi sürümde tekrar gösterilir? Settings bağlantısı ne zaman açılır?
- [ ] Geçmiş/trend karşılaştırması için yeterli örnek sayısı, yerel gün ve süre anlamı nedir?
- [ ] Silme, retention, export, reset, yeniden deneme ve migration kuralları nedir?
- [ ] Nefes 4/4/6 ve 7–10 “Burada dur” rehberi için nihai ürün/metin onayı var mı?
- [ ] Library “Pratik yakında” CTA ve diğer üretim girişlerinin açılma kabul kriterleri nedir?

Onaydan sonra bağımsız domain transitions ve provider acknowledged actions
planlanmalı. Persistence v8 bu fazda korunur; sonraki schema sürümü ve migration
ayrıca gözden geçirilir. Aynı save/navigation guards ve data deletion lifecycle
uygulanmalı; hiçbir tracking transition içine Practice yan etkisi gizlenmemeli.
