# Phase 11.8.2B — Production Urge Exercise QA

15 Ekim 2026. Güncel `flowVersion: 2` Urge event’inin canonical `interrupt`
aşaması mevcut resume route’u içinde native `UrgeExercise` ile değiştirildi.
Yeni route, event, storage key, schema alanı veya kayıt türü eklenmedi.

## Uygulanan sınır

- `bloom.urge.exercise` yalnız doğru current event kimliği ve `interrupt`
  aşamasında render edilir. Legacy ve diğer current aşamalar eski üretim
  ekranlarını kullanır.
- Hazır, running, paused ve completed durumlarında “Durum kontrolüne geç”
  görünür; eylem yalnız mevcut `actions.completeInterrupt` yoluna gider.
- Outcome, accepted değişiklik aynı event için durable olana kadar gösterilmez.
  Pending/failure durumunda status ve mevcut persistence retry erişilebilir
  kalır; retry domain komutunu yeniden çalıştırmaz.
- Onaylanan X/Back çıkışı Home’a döner ve aktif event’i korur. Bekleyen kayıt
  çıkışı engeller. Navigation hatası modalı yeniden kullanılabilir hale getirir
  ve açık retry metni gösterir. iOS geri kaydırma hareketi egzersiz boyunca
  kapalıdır.
- Timer ve preset yalnız component ömründe yaşar. Home’dan yeniden açılan event
  durmuş, 10 dakikalık yeni timer ile başlar.

## Otomatik doğrulama

`npm run verify:urge-integration`, gerçek acknowledged mutation runtime,
controller ve kontrollü production hook/screen wiring’i üzerinden current ve
legacy aşamaları, event identity, double press, accepted/durable ayrımı,
failure/retry, pending exit engeli, event’i koruyan çıkış ve navigation retry
vakalarını çalıştırır. Reusable UI doğrulaması ready/running/completed explicit
evaluation, focus/AppState, disabled recovery, exit retry, Reduced Motion ve
timer izolasyonunu kapsar.

Phase 11.8.2B sonunda typecheck, urge preview, guided flows, navigation,
persistence, persistence acknowledgement, release debug guards, practice,
protection/reset ve diff kontrolleri çalıştırılmıştır.

## Simulator kanıtı

iOS 26.3 üzerinde target ve dar cihazla üretim Home → Panic → current Urge
resume akışı kullanıldı. Normal ve maksimum Dynamic Type, 5/10/15/20 seçimleri,
running/paused, sayacı başlatmadan ve running durumda erken değerlendirme,
çıkış iptali/onayı, event resume ve Reduced Motion kontrol edildi. Gerçek 5
dakikalık production timer fixture veya hızlandırma olmadan tamamlandı; completion
ekranının outcome açmadığı, yalnız açık değerlendirmeden sonra canonical outcome’a
geçtiği doğrulandı. Kanıt seti Phase 11.8.1 galerisinden ayrıdır:

- [Normal ready](qa/urge-control/phase11-8-2b/production-ready-normal.png)
- [Normal running](qa/urge-control/phase11-8-2b/production-running-normal.png)
- [Normal completed](qa/urge-control/phase11-8-2b/production-completed-normal.png)
- [Normal exit confirmation](qa/urge-control/phase11-8-2b/production-exit-normal.png)
- [Target maximum Dynamic Type](qa/urge-control/phase11-8-2b/production-ready-maximum-type.png)
- [Narrow maximum Dynamic Type](qa/urge-control/phase11-8-2b/production-ready-narrow-maximum-type.png)

Pending/error/navigation failure durumları deterministik hook/runtime
doğrulamasında çalıştırıldı; cihazdaki gerçek local storage’a yapay hata modu
veya production’a QA-only persistence kapısı eklenmedi.

## Hedefli navigation inceleme düzeltmesi

Üretim egzersizinde gesture ayarının tek sahibi artık
`usePersistenceNavigationGuard` olur. Current interrupt görünümünde gesture
koşulsuz kapalıdır; reusable egzersiz `manageGestures={false}` ile hiçbir
`setOptions` veya cleanup yazımı yapmaz. Persistence guard'ın hardware Back
dinleyicisi bu görünümde devredilmez; egzersiz Back'i modal ile ele alır ve
pending durumda onaylı çıkış yine kapalı kalır. Legacy/downstream görünümler
guard'ın mevcut varsayılanlarını, isolated preview ise kendi gesture sahibini
korur.

Expo Router'ın kuyruklanan `replace` çağrısı başarı sonucu döndürmediğinden,
onaylı üretim çıkışı mevcut root stack'teki `(tabs)` / `today` hedefine senkron
dispatch yapar. Route anahtarı hâlâ stack'teyse navigation iptal edilmiş kabul
edilir; mevcut false callback yolu modalı, timer kontrollerini ve removal
korumasını geri kurar. Yeni bir başarı bekleme timer'ı eklenmedi.

Birleşik test gerçek uygulama guard'larını, kurulu StackRouter'ı ve React
Navigation'ın gerçek `usePreventRemove` / `shouldPreventRemove` kodunu birlikte
çalıştırır. İki effect sırası, ready/running/paused/completed gesture politikası,
hardware Back, pending write, durable downstream geçişi, root boundary'nin
sessiz reddi, `beforeRemove` iptali ve event'i koruyan retry doğrulanır.
Home senaryolarındaki kullanıcı çıkışları X → modal → onay → Home yoluna
güncellendi. Ayrı `.maestro/urge-navigation-review.yaml` mevcut current event ile
swipe-back ve fresh timer regresyonunu kapsar.

iOS 26.3 target Simulator'da ready/running/paused edge-swipe ekranı terk
ettirmedi; X, iptal, onaylı Home çıkışı ve yeniden açılan 10:00 timer geçti.
Pending testi için yalnız E2E runtime debugger'ında bir sonraki native storage
write'ı açık serbest bırakma callback'ine kadar bekletildi. Saving görünürken
outcome açılmadı, swipe ve modal onayı Home'a geçemedi; write daha sonra serbest
bırakıldı ve orijinal storage metodu geri yüklendi. Uygulama koduna test kapısı
eklenmedi. Isolated 8084 preview'da ready doğrudan kapatma, running çıkış modalı,
iptal → paused, resume ve onaylı kapanış ayrıca geçti. Ham kanıtlar ve test
çıktıları geçici dizinde tutuldu; onaylı galeriler değiştirilmedi.

Hedefli düzeltme sonrasında `typecheck`, `verify:urge-preview`,
`verify:urge-integration`, `verify:navigation`, `verify:persistence`,
`verify:persistence-acknowledgement`, `verify:guided-flows`,
`verify:release-debug-guards` ve `git diff --check` başarılıdır.
