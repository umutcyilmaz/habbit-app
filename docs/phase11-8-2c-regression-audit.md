# Phase 11.8.2C — Production Regression & Data Safety Audit

Base: `a977b05cfe57dce920fe2a462d3b6312ec0a8e4b`, branch
`feature/product-ui-v1`. İlk denetim üretim kodunu değiştirmeden durdu. Sonraki
açık düzeltme onayı yalnız legacy interrupt ekranını kapsar; commit/push yapılmaz.

## İlk kapsam matrisi

Başlangıçta mevcut testler okundu; aşağıdaki eşleme yeni test eklenmeden önce
oluşturuldu. Kaynak incelemesi tek başına execution kanıtı kabul edilmez.

| Senaryo | Mevcut test | Mevcut kanıt / kapsam | Boşluk |
| --- | --- | --- | --- |
| Current/legacy komut aşamaları ve kayıt roundtrip | `verifyControllerLifecycles`, `roundTrip` (`verify-bloom-urge-control-feature.ts`) | Gerçek facade, controller, mutation runtime; her aşamada write failure/retry ve serialize/load | Soğuk process ve yeniden kurulmuş production screen birlikte yok |
| Cold restart, aynı ID/startedAt, fresh 10:00 | `verifyEphemeralExerciseLifecycle`, feature roundtrip | Yeni timer varsayılanı ve gerçek serialization ayrı ayrı | Gerçek terminate/relaunch ve kalıcı event ile UI birleşimi gerekli |
| Başarılı / başarısız completeInterrupt sonrası restart | `verifyHookRecovery`, acknowledgement suite | Accepted/durable ayrımı, optimistic outcome engeli | Failure sonrası yalnız durable bytes ile yeni process/feature doğrulaması gerekli |
| Retry, double tap, stale route/controller, cumulative save | `failAndRetry`, `verifyIdentityAndLegacySafety`, `verifyHookRecovery` | Command/clock/ID sayacı; aynı snapshot ve retry token; superseded receipt | Mevcut kapsam yeterli; yeniden çalıştırılacak |
| Navigation cancellation / recovery | `verifyBloomUrgeNavigationGuards` | Gerçek StackRouter + beforeRemove + uygulama guard'ları; sessiz ret ve retry | Mevcut deterministic kapsam yeterli |
| Legacy UI bütün aşamalar | `verifyScreensAndDraft` ve controller lifecycle | Controller bütün legacy aşamaları; UI yalnız technique/trigger seçenekleri | Legacy interrupt ekranındaki kullanıcı ilerleme eylemi doğrudan test edilmiyor |
| Invalid/duplicate/missing/stale event ID | `verifyRouteViews`, `verifyIdentityAndLegacySafety` | Gerçek selector/controller ile no-mutation doğrulaması | Mevcut kapsam yeterli |
| Timer/exit/evaluation/retry domain izolasyonu | Timer/UI harness, `unrelated`, facade suite | Timer mutasyon çağırmaz; Urge işlemleri diğer slice referanslarını korur | Tümünün aynı cold-restart senaryosundaki birleşik kanıtı eksik |
| Panic Urge / Behavior Slip ayrımı | `verifyBloomPanicFeature`, flow-action suite | Gerçek controller, ayrı komutlar, tek mutation ve unrelated slice karşılaştırmaları | Mevcut kapsam yeterli |
| Practice/history, Reset/protection, counter/history | İlgili mevcut npm verify komutları | Bağımsız persistence ve ürün regresyonları | Phase C'de yeniden çalıştırılacak |

## İlk denetimin sonucu: legacy interrupt regresyonu nedeniyle durduruldu

Preflight geçti: doğru branch/HEAD, temiz tracked çalışma ağacı, boş staging,
64 mevcut yerel untracked QA/patch girdisi. Yerel dosyaların başlangıç SHA-256
değerleri yalnız `/tmp/bloom-phase11-8-2c-local-baseline.json` içinde tutuldu.

Mevcut testler değiştirilmeden önce aşağıdaki 13 komutun tamamı exit 0 ile
yeniden çalıştı. Ardından matristeki tek hedefli legacy UI boşluğuna test
eklendi. Yeni test gerçek production TSX render'ında başarısız oldu. Talebin
üretim kusurunda durma kuralı uygulandı; üretim düzeltmesi veya kalan cold-start
/ Simulator senaryoları yürütülmedi. Phase 11.8.2C genel sonucu **Fail / stopped**.

| Senaryo | Test ve execution kanıtı | Sonuç | Kalan risk / sınır |
| --- | --- | --- | --- |
| Her current/legacy controller aşaması, retry ve serialize/load | Değişiklik öncesi `verify:urge-integration` + `verify:persistence`; `verifyControllerLifecycles` her adımda failure/retry/roundtrip çalıştı | Pass | Controller erişilebilirliği UI erişilebilirliğini kanıtlamıyor |
| Accepted/durable, idempotency, double taps, stale route/controller, cumulative save | Başlangıç `verify:urge-integration`, `verify:persistence`, `verify:persistence-acknowledgement` exit 0 | Pass | Failure sonrası yeni process yalnız durable storage'dan kurulmadı |
| Navigation sessiz ret / cancellation / retry / pending exit / preserved event | Başlangıç `verify:urge-integration` içindeki `verifyBloomUrgeNavigationGuards` exit 0 | Pass | Bu fazda yeni cihaz tekrarı yok |
| Invalid/duplicate/missing/stale event ID ve completed ID reddi | Başlangıç selector/controller ve facade testleri, `verify:persistence` exit 0 | Pass | Cihaz deep-link tekrarı yapılmadı |
| Legacy domain progression ve version/field korunması | Başlangıç controller lifecycle; gerçek memory storage roundtrip; `verify:persistence` exit 0 | Pass | Aşağıdaki legacy ekran kusuru kullanıcı ilerlemesini engelliyor |
| Legacy interrupt ekranından technique'e kullanıcı geçişi | Yeni `verifyScreensAndDraft` vakası; `npm run verify:urge-integration` exit 1 | **Fail** | Render'da completeInterrupt CTA yok; yalnız discard var |
| Panic Urge/Behavior Slip ayrımı ve unrelated slice korunması | Başlangıç `verify:persistence` içindeki Panic, flow-action ve `unrelated` karşılaştırmaları exit 0 | Pass | Cold restart ile birleştirilmiş yeni end-to-end durum karşılaştırması yapılmadı |
| Practice/history, Reset/protection, counter/history regresyonları | Aşağıdaki bağımsız komutlar exit 0 | Pass | Bunlar Urge cold-start cihaz senaryosunun yerine geçmez |
| Persisted interrupt → terminate/relaunch → aynı ID/startedAt + stopped 10:00 | Controller roundtrip ve timer fresh-instance testleri ayrı ayrı mevcut; Phase C birleşik cold-start kanıtı yok | **Not Verified** | Warm remount, cold process kanıtı sayılmadı |
| Durable outcome / failed interrupt / completed history sonrası gerçek cold restart | Phase C yeni storage/process harness'i veya cihaz denemesi yapılmadı | **Not Verified** | Başlangıç roundtrip testleri bu birleşik gereksinimi tek başına kapatmıyor |
| İstenen 15 dakika → Home → terminate/relaunch → evaluation → completion cihaz akışı | Üretim kusuru doğrulanınca başlamadan durduruldu | **Not Verified** | Bu fazda Simulator kullanılmadı; önceki B kanıtı C'de yeni sonuç sayılmadı |
| Legacy fixture'ın cihazda geri yüklenmesi | Yapılmadı | **Not Verified** | Gerçek kullanıcı/development storage'ına dokunulmadı |

## Bulguyu yeniden üretme

**C-01 — Legacy interrupt ekranında ilerleme eylemi kaybolmuş.** Kullanıcı
akışını bloke eden bir üretim regresyonudur; bu denetimde veri bozulması veya
otomatik silme gözlenmedi.

1. Mevcut `initial(false)` fixture'ı kullanılır: aktif `urge-feature`, geçerli
   `startedAt`, `flowVersion` ve `interruptCompletedAt` alanları yok.
2. Gerçek `getUrgeControlRouteView` sonucu `kind: legacy`, canonical stage
   `interrupt` olarak doğrulanır.
3. Gerçek `UrgeControlResumeScreen.tsx`, mevcut kontrollü hook/JSX harness'iyle
   `locked: false`, hydrated/saved görünümünde render edilir.
4. Native `UrgeExercise` render edilmediği doğrulanır (beklenen).
5. `actions.completeInterrupt`'a bağlı etkin bir AppButton aranır (kaynak metin
   eşlemesi veya replacement ekran mock'u kullanılmaz).

Beklenen: Kullanıcının mevcut `completeInterrupt` eylemi ile `technique`
aşamasına ilerleyebileceği etkin bir legacy devam düğmesi.

Gerçek: `completeInterrupt` eylemi bulunmuyor. Render edilen tek AppButton:
`bloom.urge.discard`. Testin tam hata mesajı:

```text
Legacy interrupt must expose an enabled completeInterrupt action; rendered actions: bloom.urge.discard.
```

Muhtemel sahibi `src/features/urge-control/screens/UrgeControlResumeScreen.tsx`:
satır 27'de yeni exercise yalnız current interrupt için açılıyor; satır 74'teki
eski ekran aşama başlığından sonra ilk içerik dalı outcome. Legacy interrupt
içeriği/CTA'sı bulunmuyor. Önceki B değişikliği ortak interrupt kartını kaldırıp
yerine current-only exercise koymuş. Controller/facade legacy interrupt
komutunu hâlâ destekliyor; başlangıç testleri bunu yürüttü.

Etki: Persisted legacy event interrupt aşamasındaysa kullanıcı mevcut olayı
normal UI ile sürdüremiyor; yalnız açık discard eylemi kalıyor. Event bu render
nedeniyle değiştirilmez veya current flow'a yükseltilmez. Production fix
ilk denetimde uygulanmadı. Sonraki açık onayla yapılan düzeltme aşağıda kayıtlıdır.

## Komutlar ve gerçek sonuçlar

Yeni testten **önce**, her biri exit 0:

- `npm run typecheck`
- `npm run verify:urge-integration`
- `npm run verify:urge-preview`
- `npm run verify:persistence`
- `npm run verify:persistence-acknowledgement`
- `npm run verify:guided-flows`
- `npm run verify:reset-continuity`
- `npm run verify:protection-reset`
- `npm run verify:practice`
- `npm run verify:practice:persistence`
- `npm run verify:counter-history`
- `npm run verify:navigation`
- `npm run verify:release-debug-guards`

Baseline logları `/tmp/bloom-phase11-8-2c-baseline-*.log` altında yereldir.
Yeni test sonrası `npm run verify:urge-integration` **exit 1**: yukarıdaki C-01
hatası. Log: `/tmp/bloom-phase11-8-2c-legacy-interrupt-regression.log`.
Mevcut persistence suite aynı screen testini çağırdığı için sonraki çalıştırmada
bu regresyonu da yakalayacaktır; yeni test sonrası bu komut yeniden
çalıştırılmış gibi raporlanmamıştır.

Yeni test sonrası `npm run typecheck` ve `git diff --check` tekrar çalıştırıldı;
ikisi de exit 0. Başarısızlık derleme sorunu değil, eksik production eylemini
yakalayan assertion'dır.

## İlk denetimin değişiklik ve veri sınırı

Yalnız `scripts/verify-bloom-urge-control-feature.ts` içindeki mevcut screen
harness'ine eksik legacy interrupt vakası eklendi ve bu rapor oluşturuldu.
Yeni framework, debug route, storage key, schema, migration, domain/controller
veya üretim UI değişikliği yok. Mevcut yeterli retry/navigation/domain testleri
tekrardan yazılmadı. Hassas dump veya yeni screenshot eklenmedi. Commit, push,
merge veya Phase 11.8.2D yapılmadı.

## Onaylı legacy düzeltmesi ve yeniden başlayan denetim

Önce mevcut başarısız test değiştirilmeden tekrar çalıştırıldı:
`npm run verify:urge-integration` exit 1, aynı tam C-01 mesajı.
Yerel log: `/tmp/bloom-legacy-before.log`. Test silinmedi veya zayıflatılmadı.

Kök neden: B fazında ortak interrupt kartı kaldırılırken yeni adapter yalnız
current event için eklenmiş; legacy canonical interrupt eylemsiz kalmış.
Controller'ın legacy geçişi sağlamdı.

Tek üretim değişikliği `UrgeControlResumeScreen.tsx` içindedir:
yalnız `view.kind === "legacy" && view.progress.stage === "interrupt"`
dalında, event ID ile key'lenmiş `LegacyInterrupt` render edilir. `84f102d8`
referansındaki Şunu bitir / Nefes al / Çevrene bak / Devam et içerikleri,
test ID'leri ve iki circle stili geri alındı. Seçim state'i bu legacy child'a
aittir; domain komutu üretmez. Devam et mevcut `actions.completeInterrupt`
handler'ını çağırır ve `disabled={locked}` kullanır.

`verifyIntegrationSources` içindeki global Şunu bitir yasağı kaldırıldı.
Yerine mevcut gerçek TSX render testleri current exercise tek sahipliği,
legacy içerik/CTA, saved/enabled ve pending/disabled durumlarını yürütür.
Aynı renderer tekrar kullanılarak gerçek production hook + controller +
acknowledgement runtime ile tüm legacy ekran adımları yürütüldü. İlk yazma
başarısız kılınıp ekrandaki retry kullanıldı; her eylem iki kez basıldı.
Retry yeni command/time/ID üretmedi; ACK öncesi navigation kilitli kaldı.
Mevcut her-aşama failure/retry/roundtrip testleri tekrar yazılmadı.
Invalid/duplicate/missing/stale ID no-mutation döngüsü legacy'yi de kapsar.

Current exercise/preview, timer, feature hook, controller, domain, storage,
migration ve navigation guard dosyaları HEAD ile birebir aynı:
`git diff --exit-code HEAD -- src/features/urge-control/exercise
src/features/urge-control/preview src/features/urge-control/useUrgeControlFeature.ts
src/features/urge-control/urgeControlController.ts src/domain src/storage
src/shared/navigation` exit 0. Current adapter branch'i de değiştirilmedi.

## Simulator ve gerçek cold restart kanıtı

Cihaz: mevcut disposable **Bloom Practice Typography QA Target**, iOS 26.3,
UDID `3C8CE983-39F5-41A0-B781-2AACDBCD1273`; bundle
`com.umutcyilmaz.bloom.e2e`. APP_VARIANT=e2e, EXPO_PUBLIC_E2E_MODE=1,
EXPO_PUBLIC_PHASE10_QA=1, preview kapalı. Yeni QA namespace'leri:

- `bloom.e2e.home.urgeC_20261015_2128.`: mevcut day10-credit fixture düğmesi
  ile bir kez kuruldu; Panic'in gerçek Urge eylemiyle event oluşturuldu.
- `bloom.e2e.home.urgeC_legacy_20261015_2140.`: boş olduğu getAllKeys ile
  doğrulanıp mevcut `initial(false)` fixture'ı (`createActiveState(true,true)`
  ve aynı legacy event) gerçek `persistBloomLocalState` ile serialize edildi.
  Ayrı QA clock anahtarı kullanıldı. Var olan namespace reseed edilmedi.

Maestro üç akış da exit 0:

1. `/tmp/bloom-C-current-open.yaml`: ready → 15 dakika → running → X →
   confirm → gerçek Home. Çıktı `/tmp/bloom-C-current-open/`.
2. `/tmp/bloom-C-current-restart.yaml`: gerçek simctl terminate/launch
   (PID 4974 → 5076; storage temizlenmedi) ardından aynı event stopped 10:00.
   Mevcut izole QA fail-save düğmesiyle completeInterrupt yazması reddedildi;
   retry görünür, outcome görünmez. Maestro stopApp/launchApp sonrasında aynı
   event tekrar ready 10:00. Timer başlatmadan explicit evaluation → outcome;
   tekrar stopApp/launchApp → doğrudan outcome, exercise yok. Outcome unchanged
   → trigger skip → explicit complete → Home → stopApp/launchApp. Eski ID
   deep link'i unavailable; active event geri gelmedi. Çıktı
   `/tmp/bloom-C-current-restart/`.
3. `/tmp/bloom-C-legacy.yaml`: yeni namespace'e gerçek terminate/launch ile
   geçildi (PID 5537). Production Home'dan legacy ekran açıldı: Şunu bitir ve
   CTA görünür, yeni exercise yok. Nefes/çevre seçimleri → Devam et →
   urgeSurfing → phoneAway start/end → reduced → stress → explicit complete.
   StopApp/launchApp sonrası eski ID unavailable. Çıktı `/tmp/bloom-C-legacy/`.

Debugger yalnız bu iki synthetic namespace'i okudu; before/after karşılaştırması
yerel Python assert'larıyla yapıldı. Current event ID
`urge-control-event-20261010T100000250Z-1t67361`, startedAt
`2026-10-10T10:00:00.250Z` değişmedi; completed records tam bir, active null.
Persisted interrupt event'inde yalnız id/flowVersion/status/startedAt vardı;
preset, elapsed, paused veya breathing state yoktu. Legacy event `urge-feature`,
startedAt `2026-11-01T12:00:00.000Z` korundu; flowVersion/triggers eklenmedi;
technique/outcome/trigger ve canonical timestamp alanları doğrulandı.
Her iki akışta Urge dışındaki **tüm** state slice'ları önce/sonra eşitti.
Raw synthetic payload'lar yalnız `/tmp` altında; repo'ya eklenmedi.

## Güncel sonuç matrisi

| Senaryo | Sonuç | Execution kanıtı |
| --- | --- | --- |
| Önce başarısız legacy interrupt CTA | Pass | Korunan assertion + gerçek TSX render; integration exit 0 |
| Current-only native exercise / legacy-only eski UI | Pass | Render assertions + iki ayrı production Simulator akışı |
| Legacy bütün adımlar ve completion | Pass | Gerçek ekran/hook/runtime testi + Simulator + durable record karşılaştırması |
| Pending/failed legacy action, retry, double press | Pass | Ekran zinciri testi; tüm aşamalar için mevcut controller failure/retry suite |
| Legacy ID/start/version/semantik/timestamp korunması | Pass | Her-aşama serialize/load; gerçek device cold restart snapshot karşılaştırması |
| Current 15 dakika → Home → terminate/relaunch → fresh stopped 10:00 | Pass | Maestro + simctl yeni process; aynı ID/start ve timer alanı içermeyen bytes |
| Failed completeInterrupt restart'ta saved outcome göstermez | Pass | Gerçek QA write failure → retry → stopApp/launchApp → interrupt |
| Durable completeInterrupt restart'ta outcome gösterir | Pass | Explicit evaluation → outcome → stopApp/launchApp → outcome |
| Completed event records'da kalır, active olmaz | Pass | Current ve legacy restart + eski ID unavailable + storage assertions |
| Exit active event'i korur; explicit discard ayrı kalır | Pass | Device Home/reopen; mevcut discard/controller ve combined navigation testleri |
| Invalid/duplicate/missing/stale ID | Pass | Current + legacy no-mutation selector/controller döngüleri |
| Navigation cancellation/recovery ve pending protection | Pass | Gerçek StackRouter/beforeRemove + iki guard, her iki effect sırası |
| Cumulative ACK, stale controller, retry idempotency | Pass | Mevcut hook/acknowledgement suite yeniden çalıştı |
| Panic/Slip ayrımı ve unrelated domain izolasyonu | Pass | Mevcut facade/Panic testleri + tüm slice'ların iki device snapshot'ında eşitliği |
| Practice/history, Reset/protection, counter/history | Pass | İstenen bağımsız verify komutları exit 0 |
| Ayrıntılı Dynamic Type/Reduced Motion/narrow visual galerisi | Not Verified (C'de tekrar edilmedi) | Ayrı D fazına ait; önceki B görsel kanıtı yeni C execution sayılmadı |

İstenen 13 npm komutunun tamamı son test düzenlemesinden sonra **exit 0**.
Son loglar `/tmp/bloom-legacy-final-*.log`, sonuç listesi
`/tmp/bloom-legacy-final-results.json`. `git diff --check` exit 0.
İlk yeni test denemesindeki ES2020 `.at` derleme hatası index erişimiyle
düzeltildi; bu hata üretim davranışı veya gizlenen test hatası değildi.

C-01 giderildi; C'nin gerekli blocking/durable/device senaryoları doğrulandı.
Yeni üretim kusuru bulunmadı. Fiziksel cihaz ve D görsel matrisi için yeni
doğrulama iddiası yok. İnceleme için duruldu; commit/push/merge yapılmadı.

Son kapsam: üç modified tracked dosya (screen ve iki mevcut verification
script'i), bu untracked rapor. Staging boş. Başlangıçtaki 64 untracked QA/patch
girdisinin 80 dosyası SHA-256 ile değişmeden korundu. Yerel screenshot veya
QA dosyası silinmedi; meaningful kullanıcı storage'ı okunmadı/temizlenmedi.
