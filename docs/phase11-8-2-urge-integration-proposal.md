# Phase 11.8.2 — Zor An entegrasyon önerisi

15 Ekim 2026. Yalnız öneri; Phase 11.8.1 üretim akışını değiştirmez.

## Korunacak sözleşme

Panic’in “Şu an tetiklendim” dalı yalnız Urge Control başlatır veya mevcut olaya döner. “Seriyi bozdum” dalı neden seçimi, gerçek etki önizlemesi ve açık onay sonrasında yalnız Behavior Slip kaydeder. Bu iki dalın CTA’ları, komutları ve kayıt sahipliği ayrı kalmalı. Nefes egzersizinin bitmesi, iptali veya süre aşımı ikinci dalı çağırmamalı.

Güncel `flowVersion: 2` akışı `interrupt → outcome → triggers → completion` olarak kalır. Eski olaylar kendi technique → phone-away → outcome → singular-trigger akışını sürdürür. Yeni bir nefes tekniği enum’u, `selectedTechnique` alanı, süre alanı, başlangıç/bitiriş olayı veya migration eklenmesi önerilmiyor. v9 anahtarı, mevcut kayıtlar ve eski Pause kayıtları değişmez.

## Süre ve nefes rehberi nasıl eklenebilir?

| Aşama | Önerilen davranış | Mevcut komut / kayıt anlamı |
| --- | --- | --- |
| Panic / tetiklendim | Mevcut acknowledged start/resume devam eder. | Tek gerçek olay, mevcut facade zamanı ve kimliği. Önizleme sayacı olay yaratmaz. |
| Interrupt | İsteğe bağlı “Nefes ritmini dene” alt görünümü açılır. 5/10/15/20 dk yalnız geçici ekran tercihidir; Başlat açık eylemdir. Rehbersiz kısa ara ve doğrudan Devam et korunur. | Preset seçimi, sayaç başlatma/duraklatma/bitirme hiçbir domain komutu çağırmaz. |
| Alt görünümden erken dönüş | İstediğin an bitir / çık, interrupt ekranına döner; istenirse buradan açık “Durum kontrolüne geç” seçilir. | Egzersizden çıkış `discardActive` anlamına gelmez. Kullanıcı olayı bırakmayı ayrıca seçerse mevcut açık discard eylemi çalışır. |
| Süre doldu | “Süre doldu” ve “Nasıl hissediyorsun?” geçiş düğmesi; otomatik geçiş/kayıt yok. | `reduced`, `interruptCompletedAt`, `completedAt` veya triggers varsayılmaz. |
| Interrupt’tan Devam | Kullanıcı açıkça devam eder; mevcut `completeInterrupt` tek kez, doğru event kimliği ve güncel accepted slice ile çalışır. | Sonraki aşamaya geçmeden mevcut persistence receipt doğrulanır; retry komutu yeniden uygulamaz. |
| Outcome | Mevcut dört yanıt aynen sorulur: Azaldı / Hâlâ güçlü / Daha güçlü / Değişmedi. | Yalnız kullanıcının yanıtı `recordOutcome` ile kaydedilir. Sayaç değeri yanıta çevrilmez. |
| Triggers | Çoklu seçim ve açık atlama (`[]`) korunur. | `explicitContentCue` gözlemdir; Behavior Slip veya tracker ihlali değildir. |
| Completion | Mevcut explicit complete ve durable navigation kullanılır. | Var olan olay tek tamamlanmış kayda dönüşür; nefes sayacı ayrı kayıt üretmez. |

## Yaşam döngüsü ve devam

Sayaç `performance.now()` tabanlı geçici aktif süredir. Arka plana, ekran odağı kaybına ve çıkış diyaloğuna geçince durur; geri dönüşte açık Devam et bekler. Uygulama kapanıp açıldığında süre geri yüklenmez. Üretimde mevcut olay, mevcut selector’ın gösterdiği gerçek aşamadan devam eder. Interrupt içinde açılan nefes alt görünümü yeni ve başlamamış durumda olur. Bu sıfırlama, event’in `startedAt` zamanını veya olayın elapsed selector’ını değiştirmez; bunlar nefeste aktif kalınan süre değildir.

Mevcut bir olay outcome/triggers aşamasına geçmişse nefes alt görünümü açılışı domain’i geriye taşıyamaz. Eski olaylar bu alt görünüm için yeniden biçimlendirilmez. Geçerli kimlik, hydration/deletion engelleri ve accepted/durable state kontrolleri üretim controller’ında kalır. Bekleyen kayıt varken alt görünüm navigasyonu persistence guard’ını aşamaz.

## Review gerektiren kararlar

- Süreler isteğe bağlıdır; varsayılan 10 dk seçimi ürün kararı olarak onaylanmalı. “Bir süre hedefin yok” metni ile uzun presetlerin birlikte nasıl sunulacağı gözden geçirilmeli.
- 4-4-6 örneği isteğe bağlı kalmalı; doğal nefese dönme ve erken bitirme görünür olmalı. Tedavi veya sonuç garantisi dili kullanılmamalı.
- HTML’nin 5–60 dk stepper’ı ve “Senin için” soğuk su/yürüyüş kartları bu fazda yok. Bunlar için içerik, süre ve navigasyon ayrı onay ister; kart basışı kendiliğinden egzersiz başlatmamalı.
- VoiceOver’da yalnız durum değişimi anons edilir. Her saniye veya nefes fazında otomatik konuşma yok; ritim metni kullanıcı tarafından okunabilir. Gerçek cihazda VoiceOver odak sırası ayrıca denenmeli.
- Süre tercihinin cihazda hatırlanması gerekirse ayrı bir tercih sözleşmesi tasarlanmalı; mevcut event/Pause kayıtlarına alan eklenmemeli. Bu önerinin varsayılanı tercihi kaydetmemektir.

## Entegrasyonun kabul koşulları

Onaydan sonra mevcut controller/facade üzerinden bağlanmalı. Güncel/legacy olay kimliği, açık outcome, optional triggers, geçersiz derin link, kaydetme hatası/tekrar deneme, uygulama kapanması ve Reset/Tracking/Content-Free değişmezliği ayrı test edilmeli. Maksimum metin ve dar ekran denetimleri, alt görünüm ve üretim ekranı arasında da tekrarlanmalı. Phase 11.8.1 preview gate’i entegrasyon onayı sayılmaz.
