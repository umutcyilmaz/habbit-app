# Bloom — Phase 11.5.2 Settings & Privacy QA

Tarih: 13 Ekim 2026 (Europe/Istanbul). Branch: `feature/product-ui-v1`. Başlangıç ve teslim HEAD: `785d574d025d650783256888f44fef2275013277`. Commit/push yapılmadı.

## Mimari inceleme ve gerçek işlevler

| Kontrol | Önceki durum | Bu fazdaki sonuç |
| --- | --- | --- |
| SettingsHomeScreen | Legacy açık zemin ve İngilizce kart/butonlar; Settings’e tekrar push eden alt ekranlar | Bloom native koyu gruplar, Türkçe açıklamalar; mevcut native Back ve rotalar kullanılır |
| Gizlilik | Eski quiz odaklı açıklama | Güncel yerel kayıtlar ve gerçek koruma sınırları |
| Veri silme | Gerçek `LocalDataLifecycleProvider` → `BloomLocalStateProvider` → persistence coordinator | Aynı command/acknowledgement/settlement ve recovery; yalnızca UI değişti |
| Kişiselleştirme | Demo reducer `TOGGLE_PERSONALIZATION`; persist edilmez | Kalıcı tercih kontrolü kullanılamıyor |
| Bildirim durdurma / gizli metin | Demo reducer `TOGGLE_NOTIFICATION_PREFERENCE`; OS izni/zamanlama yok | Bilgilendirici unavailable satırlar; geçici preference değişimi yok |
| App Lock | Native/biometrik altyapı yok | Açık unavailable ekranı, koruma vaadi yok |
| Abonelik / restore | Geçici mesaj gösteren butonlar; mağaza entegrasyonu yok | Açık unavailable ekranı; üyelik/trial/fiyat uydurulmaz |
| İçeriksiz sayaç | Gerçek Bloom durumu ve acknowledged ürün akışı | Durum `durableState.contentFree.status` üzerinden okunur; mevcut `/bloom/content-free` ekranına bağlantı |
| Protection | Yerel tercihlerin kaydı var; gerçek native sistem engellemesi yok | Gerçek engelleme unavailable; yerel tercih “koruma açık” diye sunulmaz |
| App sürümü | HTML fixture 1.0 | `Constants.nativeAppVersion`, yoksa `Constants.expoConfig.version`; metadata yoksa unavailable |
| SSS | Onaylı uzak destek hedefi yok | Yerel, açılıp kapatılabilen mevcut özellik açıklaması; iletişim kanalı unpublished |
| Export/share, alternatif simge, pratik tanıtımı tekrarı | Ürün/native uygulama yok | Salt okunur unavailable satırlar |

`DemoAppStateProvider` yalnızca `useReducer(demoAppStateReducer, demoInitialState)` kullanır; durable Bloom coordinator’a yazmaz. Settings ekranları artık bu provider’dan ayar okumaz/yazmaz. Mevcut reducer ve diğer ekranların davranışı değiştirilmedi.

## Tasarım ve navigasyon

Gizlilik, Bildirimler, Takip tercihleri, Veriler, Yardım ve destek, Uygulama bilgileri ayrı gruplardır. `v4/AppScreen`, `AppCard`, `AppText`, `AppButton`, mevcut Profile ikon sistemi ve yerel HTML’den native SVG yolları yeniden kullanılır. Siyah canvas, `#141415` kartlar, 26pt grup radius, 16pt yatay boşluk, 38pt ikon alanı, ince ayraç ve Inter fontu kullanılır. Satırlar sabit yükseklik yerine minimum yükseklik, esnek metin ve Dynamic Type içerir. Etkileşimli satırlar/button’lar açıklamalı accessibility label ve en az 44pt hedef kullanır; unavailable alanlar switch veya sahte button değildir.

Root Settings başlıkları mevcut native stack’te kalır; yalnızca siyah başlık/Inter stil ve shadow ayarı uygulanır. Bu ekranlarda `AppScreen.paddingTop=0` ile ikinci safe-area eklenmez; alt inset korunur. Settings status bar açık metindir. Profile → Settings → nested → Back aynı stack üzerinde çalışır. `/settings`, `/settings/privacy`, `/settings/data-controls`, `/settings/notifications`, `/settings/app-lock`, `/settings/subscription` ve alias `SettingsScreen` korunur. Yeni product route yok; dört tab ve guarded navigator kodu değişmedi. Alt ekranların “Back to Settings” ile yeni Settings push etmesi kaldırıldı.

## Silme güvenliği ve kurtarma

Onay önce açılır ve geri alınamaz kapsam ayrıntılı gösterilir. İki saniye hold, kısa dokunuşla silmez. Alternatif erişilebilir yol ayrı native Alert ve “Kalıcı olarak sil” onayıdır. Vazgeç, odak kaybı ve gecikmiş Alert callback’i silme başlatmaz. Ref kilidi render’dan önce gelen yinelenen event’leri engeller; mevcut provider/coordinator promise deduplication korunur. ScrollView’un native responder iptali hold’u keser; yeni timer/native dependency yok.

Ekran command promise’i bitince kendi success üretmez. Yalnızca lifecycle’ın doğrulanmış `success` durumu geçerlidir; gerçek başarıda mevcut `BloomHydrationBoundary` global başarı/recovery görünümünü ve onboarding yönlendirmesini sahiplenir. `deleting` busy/disabled’dır. Watchdog error’ı veya removal error’ı success değildir; hata ve tekrar onayı gösterilir. Yeniden girişte lifecycle hatası otomatik temizlenmez. Geç settlement observer, failed deletion rollback/requeue, hydration recovery, pending retry token’lar, mutation/navigation korumaları değiştirilmedi. Başarılı silme sonrası navigation recovery yalnız `retryBloomLocalDataResetNavigation` çağırır, yeniden silmez.

Kapsam: onboarding/değerlendirme, plan seçimi, Kegel intro kabulü ve seansları, Library okundu/bookmark kimlikleri, Tracking/geri bildirim, içeriksiz sayaç/ihlal/undo, zor an, Reset, legacy check-in/Pause/Arousal/Protection/notlar ve destekleyici zaman/kimlikler. Mevcut koordinatör eski Bloom anahtarlarını ve corrupt backup’ları da kapsar. Şifreleme, bulut veya biyometrik koruma iddiası yok. Yerel silme bir mağaza aboneliğini iptal etmez.

## Otomatik testler

Typecheck ve yeni `npm run verify:settings` geçti. Settings testi gerçek TSX screen fonksiyonlarını kontrollü hook/provider harness ile çalıştırır; mounted React renderer değildir. Kısa hold, iptal, stale callback, blur, synchronous çift event, pending, promise-only success üretmeme, error/retry, navigation recovery ve error revisit doğrulanır. QA adapter testi dev/E2E/bundle/flag/run kapılarını, prefix-filtered key inventory, one-shot removal failure ve retry’ı doğrular. Cihaz storage’ı bu testlerde kullanılmaz.

Aşağıdaki 17 paket geçti; ham çıktı `docs/qa/settings/verify-*.log`, exit kodları `results-*.json` içindedir:

- `verify:navigation`, `verify:persistence`, `verify:persistence-acknowledgement`
- `verify:profile`, `verify:library`, `verify:audio`
- `verify:kegel`, `verify:kegel:persistence`
- `verify:home-ui`, `verify:journey`
- `verify:reset-continuity`, `verify:protection-reset`
- `verify:product-onboarding-ui`, `verify:guided-flows`, `verify:e2e-runtime`
- `verify:release-debug-guards`, `verify:e2e-app-identity`

Persistence/acknowledgement regresyonları deletion invalidation, late settlement watchdog, deletion/hydration timeout, failed-deletion canonical requeue, pending retry token preservation, retry resurrection engeli, navigation ve corrupt-payload recovery’yi içerir. Bloom v8 şeması, v7 migration ve ürün transition dosyaları değiştirilmedi. Testler gerçek coordinator/runtime’ı bellek adapter’inde kullanır.

## Native iOS QA ve izolasyon

Cihaz: iPhone 17 Pro, iOS 26.3, 402×874pt (1206×2622px). Paket: `com.umutcyilmaz.bloom.e2e`, scheme `tms-e2e`. Yeni run: `settings_20261013_1342_a73f`. Normal Bloom açılmadı. Eski kullanıcı/QA verileri seed, replace, reset, clearState veya migration ile değiştirilmedi. Bu fazın silinebilir tek bookmark kaydı gerçek Library UI üzerinden bu yeni namespace içinde oluşturuldu.

```sh
EXPO_PUBLIC_KEGEL_QA_RUN=settings_NEW_UNIQUE_RUN EXPO_PUBLIC_SETTINGS_DELETE_QA=fail-once npm run start:e2e:kegel:persistence
maestro test .maestro/settings.yaml --test-output-dir /private/tmp/settings-ui
maestro test .maestro/settings-deletion.yaml --test-output-dir /private/tmp/settings-delete
```

Silme suite’i yalnızca her test için yeni, özel namespace’te çalıştırılır. `fail-once` yalnız tüm mevcut Kegel QA izolasyon kapıları açıkken namespaced storage adapter’ın ilk remove çağrısını reddeder. Normal/release runtime’a etkisi yok; uygulama yapılandırması veya storage schema değişikliği yok. İlk hata bir anahtarı kaldırmadan oluşur; retry mevcut coordinator’a gider. Debug Kegel route gate ve boş count silme testinden önce kontrol edilir.

Settings üst/alt, privacy/data, app-lock/notifications/subscription unavailable, SSS, kısa dokunuş, cancel, Profile/nested Back ve restart suite’i geçti. Son ikon ve kullanıcı metni düzeltmeleri sonrası Settings üst/data-support/confirmation tekrar yakalanıp iptal doğrulandı. Native başarısız silme ve retry sonuçları teslim doğrulaması bölümünde kayıtlıdır.

İlk silme testinde Maestro `tapOn.duration` şemayı reddetti; uygulamada hiçbir komut çalışmadı. Komut resmi [Maestro longPressOn](https://docs.maestro.dev/reference/commands-available/longpresson) komutuna düzeltildi. İzole run yeniden kullanılmadan temizlenmedi; bu fazdaki test bookmark’ı daha sonra aynı gerçek silme akışında işlendi.

## HTML / native karşılaştırma

[Galeri](qa/settings/index.html) orijinal `settingsHTML`/`wipeSheet`/CSS ile yakalanmış üç HTML görüntüsünü ve native durumları içerir. `extract-settings-reference.cjs` referansın ikon/markup/CSS’ini okur; HTML’deki açık switch/saatler yalnız fixture’dır. Referans 390×844, native 402×874pt. Font renderı, cihaz çerçevesi ve native safe-area farklıdır.

Dürüst unavailable açıklamaları ve gerçek privacy/navigation satırları ekranı HTML’den uzatır; switch’lerin yerinde açıklama bulunur. Grup boşluğu 36pt; referanstaki 56pt üst marj, daha uzun native metne uyarlanmıştır. Sürüm gerçek metadata’dan geldiği için HTML 1.0 fixture’ıyla eşleşmek zorunda değildir. Destructive onay HTML bottom sheet yerine aynı guarded ekran içindeki scroll edilebilir amber paneldir; kapsam daha ayrıntılıdır ve erişilebilir Alert alternatifi vardır. Hold feedback metin/renk değişimidir; HTML soldan dolan animasyon uygulanmadı. Bu sunum mevcut lifecycle/navigation sahipliğini korur. Data Controls koordinatörün İngilizce hata metnini doğrudan göstermez; doğrulanmamış silme ve doğrulanmış silme sonrası navigasyon hatası tek ve farklı Türkçe mesajlarla sunulur. Mevcut global hydration/recovery görünümü ve koordinatör metinleri değiştirilmedi.

Gerçek cihaz VoiceOver, Android hardware Back ve OS Reduce Motion/Dynamic Type ayarları açılarak ayrı native test yapılmadı. Erişilebilirlik metadata ve esnek layout kodla incelendi. OS izinleri, StoreKit veya gerçek native engelleme test edilmedi; bu kabiliyetler unavailable’dır.

## Değişen dosyalar ve teslimatlar

- `src/features/settings/screens/`: altı ekranın native tasarımı ve dürüst capability durumları.
- `src/features/settings/components/SettingsPrimitives.tsx`, `SettingsIcon.tsx`: gruplar, satırlar, safe-area shell ve native ikonlar.
- `app/_layout.tsx`, `src/app/providers/AppProviders.tsx`: mevcut Settings header/status bar stili.
- `src/features/kegel/kegelPersistenceQa.ts`: yalnız guarded izole Settings silme QA’sı için tek removal-failure desteği.
- `scripts/verify-bloom-settings.cjs`, `package.json`: Settings UI ve QA gate testleri.
- `.maestro/settings*.yaml`: izole native testler.
- `scripts/extract-settings-reference.cjs`, `scripts/settings-storage-snapshot.py`: reference rendering ve salt okunur hash kanıtı.
- Bu belge, [kısa checklist](phase11-5-2-settings-checklist.md), [galeri](qa/settings/index.html), `docs/qa/settings/` test/screenshot/hash kanıtı.
- `docs/patches/phase11-5-2-settings-text-only.patch`: bu fazın kaynak, test ve belge diff’i; binary görüntüler ayrı galeride. Önceden var olan `docs/patches/` içeriği değiştirilmedi.

Kalan ürün kararları: native kilit/izin/notification politikaları, simge varlıkları, gerçek subscription ürünleri ve entitlement, export format/kapsam/share, kapsamlı legal metin ve destek kanalı, gerçek sistem engellemesi, tekrar tanıtım ve kalıcı kişiselleştirme tercihi. [Checklist](phase11-5-2-settings-checklist.md) bunları tek tek listeler.


## Teslim doğrulaması

- Native hold sonrası ilk removal hatası geçti (`13`); bookmark korundu (`14`). Hata yeniden girişte korunur. Erişilebilir ayrı Alert retry (`15`) doğrulanmış başarı sonrası onboarding’e döndü (`16`); bookmark kaldırıldı (`17`), restart’ta geri gelmedi (`18`).
- Gerçek sayaç bağlantısı geçti (`19`). Bu mevcut feature ekranının “Kapat” eylemi ana sayfaya döner (`20`); ilk ek test Settings beklediği için assertion’da durdu. Mevcut ürün davranışına uygun Home assertion’ı ile yeniden geçti. Sayaç close davranışı bu fazda değiştirilmedi; nested Settings native Back kontrolleri ayrı suite’te geçti.
- Salt okunur SHA-256 karşılaştırması: normal Bloom’un mevcut **1**, eski E2E/QA’nın mevcut **12** storage anahtarı aynı kaldı; eksik/değişmiş eski anahtar **0**. `storage-before.json`, `storage-after.json`, `storage-preservation.json` kanıttır; gerçek değerler dışarı aktarılmaz. Yeni Settings QA bookmark’ı gerçek koordinatör tarafından silindi, başka namespace silinmedi.
- Galeri **3 HTML + 20 native PNG** içerir. Son ikon/confirmation screenshot’ları final sürümden seçildi. Diğer native durumlar aynı davranış koduyla kaydedildi; son değişiklik yalnız dekoratif ikon ve footer metnidir. Tüm görsel linkleri ve `screenshots-sha256.json` doğrulandı. Bu fazın büyük Maestro trace/cache çıktıları yerine son görüntüler ve kısa sonuç envanteri saklandı.
- Son `typecheck`, `verify:settings`, `git diff --check` geçti. Text-only patch approved HEAD’in `/private/tmp` temiz arşivinde `git apply --check` ile doğrulandı; binary diff içermez. Kayıtlı 17 regresyon paketi başarılıdır.
- QA için başlatılan Metro durduruldu. Commit/push yok. OS uygulama konfigürasyonu, schema/migration ve production runtime değişmedi.


## Final review düzeltmeleri — 13 Ekim 2026

Bu düzeltmede yalnızca Data Controls hata sunumu değişti: doğrulanmamış silmede tek Türkçe açıklama vardır; İngilizce `deletionError` aynen render edilmez. Doğrulanmış silme sonrası navigation error için tek Türkçe mesaj verinin silindiğini açıkça belirtir. Mevcut recovery düğmesi aynı command’i çağırır. `LocalDataLifecycleProvider`, Bloom provider, deletion coordinator, retry, persistence, migration ve guarded QA adapter kodunun hash’leri değişmedi.

`verify:settings` tek hata metnini, ham coordinator metninin görünmemesini, success/navigation-failure ayrımını ve recovery’nin tekrar silme çağırmamasını doğrular. `typecheck`, `verify:settings`, `verify:persistence`, `verify:persistence-acknowledgement` ve `git diff --check` tekrar geçti; son sonuçlar [final-review-results.json](qa/settings/final-review-results.json) içindedir.

İstenen `02-native-app-lock.png` ve `14-native-failure-record-preserved.png` aynı iOS E2E paketinde yeniden çekildi; animasyonun bitmesi beklenip “Refreshing…” görünmediği assertion ve görsel incelemeyle kontrol edildi. İkinci görüntü hâlâ gerçek başarısız silme sonrası korunan bookmark’ı gösterir; test anlamı değiştirilmedi. Yalnız bu iki PNG ve bunların SHA-256 değerleri yenilendi. Galerideki `13` ve `15`, ilk QA koşusunun bu metin düzeltmesinden önceki tarihsel görüntüleridir; bu düzeltmenin güncel tek Türkçe hata görünümü Simulator’da ayrıca kontrol edildi.

Yeni özel run `settings_review_20261013_9c6e` içinde gerçek Library UI ile bir bookmark oluşturuldu. Mevcut guarded `fail-once` adapter ilk removal çağrısını herhangi bir anahtar kaldırmadan reddetti. Retry/başarılı silme/clearState çalıştırılmadı; yeni bookmark da saklandı. Önceden var olan normal Bloom’un 1 ve eski QA’nın 12 storage anahtarı byte düzeyinde aynı kaldı; yeni run’ın tek storage anahtarı eklendi. Mevcut kullanıcı veya QA verisi silinmedi. QA Metro sunucusu iş sonunda durduruldu. Güncel text-only patch binary içermez ve approved HEAD arşivinde apply-check geçti. Commit/push yapılmadı.
