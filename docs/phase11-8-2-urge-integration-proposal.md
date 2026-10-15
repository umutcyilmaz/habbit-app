# Phase 11.8.2 — Doğrudan Zor An entegrasyon sözleşmesi

15 Ekim 2026. Phase 11.8.2A reusable egzersiz sınırını hazırlar; üretim
bağlantısı Phase 11.8.2B incelemesinden sonra yapılacaktır.

## Onaylanan ürün akışı

Güncel `flowVersion: 2` olayının kalıcı aşamaları değişmez:
`interrupt → outcome → triggers → completion`. Panic ekranındaki “Şu an
tetiklendim” eylemi mevcut acknowledged event başlangıç/devam davranışını
korur. Phase 11.8.2B’de bu olay `interrupt` aşamasındayken üretim resume route’u
doğrudan yeni Zor An egzersizini gösterecektir; araya eski “Şunu bitir” kartı
veya isteğe bağlı bir alt ekran konmayacaktır.

Sayaç yalnız kullanıcının açık “Başlat” eylemiyle çalışır. Kullanıcı sayacı hiç
başlatmadan, çalışırken erken bitirerek veya süre dolduktan sonra açıkça “Durum
kontrolüne geç” eylemini seçebilir. Bu eylem mevcut `completeInterrupt`
komutunun tek üretim sahibidir. Sürenin dolması callback, outcome veya kayıt
üretmez; `reduced`, `stillStrong`, `stronger` ya da `unchanged` sonuçlarından
hiçbiri varsayılmaz. Outcome yalnız sonraki ekrandaki kullanıcı yanıtıyla
`recordOutcome` üzerinden kaydedilir.

X, platform Back ve geri kaydırma hareketi çıkış onayı ister. Onaylanan çıkış
yalnız egzersiz ekranından Home’a döner; aktif Urge Control olayı korunur ve
`discardActive` çağrılmaz. “Egzersizden çık” ile “olayı bırak” iki ayrı
eylemdir. Kullanıcı aktif olayı yeniden açtığında canonical aşama hâlâ
`interrupt` olur ve egzersiz yeni, durmuş, varsayılan 10 dakikalık sayaçla
başlar.

## Legacy olayların korunması

Eski Urge Control olayları mevcut technique → phone-away → outcome →
singular-trigger akışlarını sürdürür. Doğrudan Zor An ekranı yalnız güncel
`flowVersion: 2` olayının `interrupt` aşamasına uygulanacaktır. Legacy selector,
komut, süre gösterimi, event kimliği ve devam davranışı yeniden yorumlanmaz.
Güncel bir olay outcome, triggers veya completion aşamasına geçtiyse egzersiz
onu `interrupt` aşamasına geri taşıyamaz.

Panic’in “Seriyi bozdum” dalı Behavior Slip olarak ayrı kalır. Nefes
egzersizinin başlangıcı, bitişi, süresinin dolması veya çıkışı Behavior Slip,
Masturbation Tracking ya da Content-Free kaydı oluşturmaz.

## Phase 11.8.2A’da hazırlanan sınır

`src/features/urge-control/exercise/` aşağıdaki reusable parçaların sahibidir:

- Tek monotonic, geçici timer modeli ve 5/10/15/20 dakikalık seçimler.
- Native LCD, mavi sis, 4-4-6 nefes fazı ve aynı elapsed-time kaynağına bağlı
  animasyon.
- AppState, ekran odağı, pause/resume, çıkış diyaloğu, Reduced Motion ve
  responsive typography yaşam döngüsü.
- Adapter tarafından sağlanan açık çıkış callback’i.
- İleride hazır, çalışan, durmuş veya tamamlanmış egzersizden açık değerlendirme
  eylemi sunabilen callback; callback verilmezse Phase 11.8.1 preview davranışı
  aynen sürer.
- Hazır/tamamlanmış durumda da çıkış onayı isteyebilmek için adapter ayarı.

Reusable katman production controller, flow action, persistence, route veya
event modeli import etmez. Callback’i neyin kalıcı komuta çevireceğine karar
vermez. Timer tamamlandığında değerlendirme callback’ini otomatik çağırmaz.

`src/features/urge-control/preview/UrgePreviewScreen.tsx` yalnız gated QA
fixture’ını, QA metinlerini, mevcut Maestro test kimliklerini ve preview kapanış
yönlendirmesini sağlar. Preview memory runtime ve release gate değişmez. Eski
preview timer/visual/hook modül yolları uyumluluk adaptörüdür; ikinci bir timer
veya görsel uygulaması içermez.

Phase 11.8.2A üretim `UrgeControlResumeScreen`, `useUrgeControlFeature`,
`urgeControlController`, Panic navigation veya domain komutlarını bağlamaz ve
değiştirmez.

## Phase 11.8.2B bağlantısı

Phase 11.8.2B yalnız güncel event’in `interrupt` görünümünde reusable egzersizi
render etmelidir. Adapter şu sorumlulukları taşımalıdır:

1. “Durum kontrolüne geç” eylemini mevcut `actions.completeInterrupt` yoluna
   bağlamak ve acknowledged persistence tamamlanmadan sonraki aşamayı güvenli
   kabul etmemek.
2. Exit onayında event’i mutasyona uğratmadan, bekleyen/unconfirmed kayıt
   korumasını aşmadan Home’a dönmek.
3. Üretim test kimlikleri ve üretime uygun çıkış/kayıt metinlerini sağlamak;
   QA “kaydedilmez” metinlerini taşımamak.
4. Legacy ve interrupt dışındaki güncel aşamalarda mevcut üretim ekranını aynen
   kullanmak.

Kayıt retry’si komutu yeniden uygulamamalı; mevcut accepted/durable slice ve
receipt kuralları geçerli kalmalıdır. Event discard yalnız mevcut açık
`discardActive` eyleminden yapılmalıdır.

## Persistence ve veri sınırı

Egzersiz süresi, seçilen preset, pause durumu ve nefes fazı process-local UI
durumudur. Uygulama kapanması, ekranın unmount olması veya aktif event’in tekrar
açılması bunları geri yüklemez. Yeni event/session tablosu, alan, preference,
schema sürümü veya migration eklenmez. v9 persistence, event identity,
`startedAt`, outcome, triggers ve completion alanlarının anlamı değişmez.

Üretim domain mutasyonlarının sahibi mevcut controller/facade olmaya devam
eder. `completeInterrupt`, `recordOutcome`, `recordTriggers`, `complete` ve
`discardActive` komutları aynı validation ve persistence acknowledgement
sınırından geçer.

## Phase 11.8.2B kabul denetimleri

Güncel ve legacy olaylar; sayaçsız erken değerlendirme; çalışan egzersizden
erken değerlendirme; süre dolduktan sonra açık değerlendirme; egzersiz çıkışı
ve ayrı event discard; bekleyen/başarısız persistence ve retry; geçersiz derin
link; uygulama kapanıp yeniden açılma ayrı test edilmelidir. Normal ve maksimum
Dynamic Type, dar ekran, running/paused/completed, çıkış diyaloğu ve Reduced
Motion üretim adapter’ıyla yeniden görsel olarak incelenmelidir. Preview gate’in
geçmesi üretim entegrasyon onayı sayılmaz.
