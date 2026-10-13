# Bloom — Phase 11.6.1 Home Dashboard QA

Tarih: 13 Ekim 2026 (Europe/Istanbul). Branch: `feature/product-ui-v1`. Başlangıç/teslim HEAD: `a0a3a9220683748257d3bcefb57086ce17ccbe5b`. Commit/push yapılmadı.

## Mimari inceleme ve uygulama

`BloomHomeScreen`, `useBloomHomeFeature`, `getBloomHomeReadModel`, Home presentation, Tracking activation controller, canonical flow/route mapping ve guarded Stack/Tabs incelendi. Home domain bileşimi değiştirilmedi: unfinished Tracking session, pending feedback, active Urge, elapsed Reset/completion, baseline, active Reset, onboarding/Reset önerileri ve continuation öncelikleri aynı seçicide kalır. Yeni screen bu semantic action’ları mevcut adapter’a verir. Tracking enable ve retry mevcut acknowledged controller’a aittir.

Nighttime sky, SVG radial blue fog, büyük gerçek süre sayacı, bağlı yuvarlak kapsüller, Content-Free kartı, Reset hero ve restrained Tracking kartı native React Native ile uygulandı. `v4/AppScreen`, `AppCard`, `AppText`, `AppButton` kullanılır. WebView, yeni native dependency, OS izni veya app config değişikliği yok. Dört tab ve mevcut detail/Urge rotaları korunur.

Reset hero’dan sonra Tracking restriction ve Content-Free kartı gelir; bu kart sırası HTML’nin frozen-track kompozisyonuna uyar. Action önceliği kart sırasından bağımsızdır: tamamlanmamış işler için en üstte existing semantic CTA vardır. Enabled Tracking hero normal Home’da ilk sıradadır; yalnız Content-Free aktif ve Tracking kapalıyken mevcut Content-Free önceliği korunur. Her iki takip kapalıysa isteğe bağlı Tracking başlangıcı ve ayrı Content-Free kartı gösterilir. Aktif/elapsed Reset’te izinsiz Tracking aktivasyonu veya yeni oturum butonu yoktur.

## Gerçek veri ve tanımlar

| Görünüm | Kaynak / anlam |
| --- | --- |
| Son tamamlanan oturumdan beri | `durableState.masturbationTracking.sessions`; completed ve `endedAt <= observationTime` olan en son END timestamp. Draft, active, awaiting-feedback ve gelecekte biten kayıt anchor olmaz. Yeni salt okunur `getHomeTrackingElapsedSeconds` bunu hesaplar. |
| Ortalama aralık / kalite | Mevcut `getTrackingSummary`. Aralık completed oturumların startedAt farklarının ortalamasıdır; iki kayıt olmadan `—`. Kalite saved completed kayıtların mevcut ortalamasıdır. |
| Tüm zamanlar kapsülü | Aynı mevcut summary’nin observed completed session count’u. HTML “Bu ay” fixture sayısı veya yeni aylık hesaplama kullanılmaz. |
| İçeriksiz gün / en uzun seri | Mevcut `getContentFreeProgress`: tamamlanan 24 saatler, effective best ve earned Reset credit dahil. Kapalı durumda mevcut seri `—`; tarihsel best varsa korunur. |
| Yeni Content-Free seri | Mevcut active tracker’da completed gün 0 ve recorded violation varsa açıklama; kendisi yeni violation üretmez. Sıfırlama Home’da doğrudan yapılmaz, mevcut ayrıntı/explicit confirmation ekranına gider. |
| Reset geçen süre | Mevcut `getResetProgress` remainingSeconds üzerinden 15 günlük süreden geçen kısım. Live presentation 15 günde cap edilir; state completion transition’ı kendi kendine uygulanmaz. |
| Reset gün/kalan/bitiş | Aynı progress currentDay/remainingDays; observedAt + gerçek remainingSeconds ile takvim bitişi. currentDay ile completedDays farklı kavramlardır. |
| Öneri/resume/continuation | Mevcut Home read model, canonical action intent ve durable Reset continuation offer. Pending completion, fake saved/offer olarak gösterilmez. |

İsim kaynağı yok; “Merhaba” kullanılır. Eksik kayıt/geçersiz model/hydration tamamlanmaması sıfır başarıya dönüştürülmez. Kayıt yoksa hero `—`, iki ortalama `—` ve gerçek completed count 0’dır. Native “Bu sayaç içerik engellemez” der; Protection preference native permission olarak yorumlanmaz. Reddit, klinik yüzde, sample trend ve hedef sayısı gösterilmez.

## Animasyon, saat ve erişilebilirlik

Fog’un opacity/translate hareketi Reanimated native animasyonudur; sürekli JS frame loop yoktur. Reduced Motion’da hareket ve giriş FadeIn/FadeInDown kapanır. Priority resume/recommendation/Reset focus’unda viewport animasyonsuz en üste gelir; diğer durumlarda browsing position korunur. Shared AppScreen yalnız optional ref forwarding kazanır. Fog tab focus kaybında, app background’da ve unmount’ta iptal edilir. Gün değeri yalnız gerçek değere geçer; kurmaca ara sayılarla count-up yapılmaz.

Hero’nun saniye text refresh’i sadece focused foreground’da tek 1s interval kullanır. Değer her render’da provider’ın scoped `now()` saatinden okunur; eski local clock snapshot’ı foreground/QA saat sıçramasında yeni verified değerleri geri saydırmaz. Home domain/summary gözlemi mevcut 60s periyotla, artık yalnız focus/foreground’da yenilenir; focus/foreground ve ilgili durable slice değişiminde anında refresh vardır. Sayaçlar veya türetilmiş sayılar persist edilmez.

Mevcut AppScreen safe-area ve tab-clearance kullanılır. En az 44pt hedefler, açık button/heading etiketleri, birleşik kapsül/süre accessibility label’ları ve gerçek Reset progressbar metadata vardır. Sayaç test ID’si native accessibility’nin gördüğü gruba verilir. Büyük yazıda hero gün/birim ve üç kapsül dikey düzene geçer; doğal metin ölçeklemesi korunur. Dekoratif sky/iconlar erişilebilirlik ağacından çıkarılır.

## Otomatik doğrulama

`typecheck`, `verify:home-ui` (screen composition + native animation/clock harness), `verify:persistence`, `verify:persistence-acknowledgement`, `verify:navigation`, `verify:profile`, `verify:library`, `verify:audio`, `verify:kegel`, `verify:kegel:persistence`, `verify:journey`, `verify:reset-continuity`, `verify:protection-reset`, `verify:guided-flows`, `verify:product-onboarding-ui`, `verify:e2e-runtime`, `verify:release-debug-guards` geçti. Ham loglar ve `results-*.json` [QA klasöründe](qa/home-dashboard/) bulunur.

Home testleri gerçek screen fonksiyonları ve seçicilerle boş/hatalı, aktivasyon pending/failed/retry, ordinary start, active/feedback/Urge resume identity, Reset restriction, elapsed completion, onboarding recommendation, optional Reset advice, continuation routing ve kart sırasını doğrular. Yeni testler future completion exclusion, end-timestamp anchor, gerçek live time ve all-time count’u kapsar. Controlled hooks harness mounted React renderer değildir. Focus testi priority’nin yalnız viewport scroll’u yaptığını, session mutation veya navigation çağırmadığını ve ordinary Home’un scroll konumunu koruduğunu doğrular.

Animation harness gerçek component koduyla scoped-clock cap, invalid/future clock, tek interval, blur/background cleanup, native-loop pause ve Reduced Motion’ı denetler. Persistence suite gerçek coordinator/runtime’ı bellek adapter’inde çalıştırır; Home role/intent purity ve round-trip yanında Tracking/Content-Free/Reset/Urge, acknowledgement ve retry/deletion regressions içerir. Cihaz verileri bu testlerde kullanılmaz.

Release-guard testi ilk kez yeni optional namespace argument yüzünden eski exact source-string kontrolünde durdu. Aynı DEV + E2E + flag + bundle koşulunu ve guarded provider initializer’ı yeni signature ile doğrulayacak şekilde güncellendi; son test geçti. Guard gevşetilmedi. `results-2.json` ilk çıkışı ve başarılı son çıkışı kaydeder.

## iOS izolasyonu

Simulator: iPhone 17 Pro, iOS 26.3, 402×874pt. Paket `com.umutcyilmaz.bloom.e2e`, scheme `tms-e2e`; normal Bloom açılmaz. Önceki kullanıcı/QA anahtarlarının salt okunur SHA-256 envanteri QA’dan önce alınır. Bu faz `EXPO_PUBLIC_HOME_QA_RUN` ile her run’a yeni `bloom.e2e.home.<run>.` prefix verir. Geçersiz verilen run veya prefix canonical/önceki namespace’e fallback yapmaz, hata verir. DEV/E2E/bundle/Phase10 flag korumaları aynıdır.

Existing Phase10 scenario engine ve production acknowledged coordinator kullanılır. Legacy Phase10 default namespace davranışı korunur. Bu fazın Home debug menüsüne eklenen 3 günlük advance sadece private clock anahtarını persist eder; device Date/time değiştirilmez. Clock restart’ta restore edilir. Prefix-filtered enumeration/load/save/remove ve old/canonical sentinel korunması bellek testinde doğrulanır. Yeni QA dışında fixture hazırlama, seed, replace, clearState veya deletion yapılmaz.

```sh
EXPO_PUBLIC_HOME_QA_RUN=home_FRESH_NEW_UNIQUE_RUN npm run start:e2e:phase10
maestro test .maestro/home-dashboard.yaml -e HOME_QA_RUN=home_FRESH_NEW_UNIQUE_RUN
maestro test .maestro/home-dashboard-history.yaml -e HOME_QA_RUN=home_FRESH_NEW_UNIQUE_RUN
```

Reset active ve completion/continuation için ayrı NEW run’da `.maestro/home-dashboard-reset-active.yaml` / `.maestro/home-dashboard-continuation.yaml` çalıştırılır. Home namespace’inde mevcut v8 kayıt varsa scenario hazırlama reddedilir. Scenario hazırlama o yeni boş run’da bir kere yapılır; eski QA veya fresh-history run’ı üzerine uygulanmaz. Fresh gerçek Tracking, Content-Free ve Urge kayıtları UI ve mevcut acknowledged actions üzerinden oluşturulur; bu yeni kayıtlar da iş sonunda saklanır.

Native sonuçlar ve preservation hash karşılaştırması teslim doğrulaması bölümündedir. Bazı ilk native assertion’lar saved text’in ekran dışına kayması, feedback’in mevcut Devam et adımları veya mevcut otomatik Home dönüşünü varsaymaması nedeniyle durdu. Testler bu gerçek akışlara göre düzeltildi; önceki başarılı mutasyonlar replay edilmeden kalan aşamalardan devam edildi. Live counter’ın accessibility ID’si native static-text grubuna taşındı. Üstteki hedefler için zorunlu scroll merkezlemesi kaldırıldı. SVG stop offset’leri sayısal verilerek warning düzeltildi. Bu düzeltmelerde workflow/controller/state transition kodu değiştirilmedi. Gözlenen korunmuş Home scroll konumu nedeniyle pending/resume ve active Reset odaklandığında viewport, animasyonsuz biçimde en üste getirilir; ordinary Home scroll konumu korunur. Bunun için AppScreen’e yalnız optional scrollRef eklendi.

## HTML / native karşılaştırma ve kapsam

[Galeri](qa/home-dashboard/index.html), yerel HTML’nin gerçek homeHTML/trackHero/resetHero markup ve CSS’inden yakalanan PNG’leri native durumlarla eşleştirir. `extract-home-reference.cjs` orijinal fixture’ları yalnız render amaçlı okur. Mert, 26 gün, aylık 9, kalite artış grafiği ve Reddit referans verileridir; native’e taşınmaz.

Native Inter, HTML Archivo/font-stretch’ten farklıdır. Siyah/gece canvas, blue radial fog, 76pt hero sayı/birim, outlined capsules/connector, 30pt card radius ve 16pt horizontal space eşleştirildi. Native sky analitik SVG glow/stars ve native drift kullanır; HTML CSS dawn gradient kompozisyonunun birebir fiziksel renderı değildir. Sky brightness bir sağlık/streak başarısı iddiasına bağlanmaz. Numaralar, fontlar ve native safe areas yüzünden birebir pixel match beklenmez.

Urgent-entry kırmızısı beyaz yazının kontrastı için HTML’den daha koyudur. Native enabled Tracking CTA “Oturum başlat/İlk kaydını ekle”dir; HTML’nin ayrı Practice özelliğiyle karışmaması için mevcut Tracking terminolojisi korunur. “Bu ay” yerine gerçek all-time count kullanılır. Reset frozen restriction mevcut izin gerçeğini anlatır; henüz kapalı Tracking’i enabled/frozen diye sunmaz. Reset devamı/unfinished work için ek attention CTA’lar HTML sample happy-path’inden daha çok alan kaplar. Counter/detail shortcut mevcut yönetim ekranına gider; yeni history chart veya Home’dan destructive-reset shortcut yoktur.

[Erteleme ve ürün kararları](phase11-6-1-home-deferred.md): Phase 11.6.2 detaylar/chart definitions, Reddit gerçek entegrasyonu, doğrulanmış native blocking, profil adı kaynağı, hedef/total-content-free gün tanımları ve otomatik yeniden ölçüm/klinik sonuç iddiaları.

## Dosyalar

- `src/features/home/screens/BloomHomeScreen.tsx`: dashboard kompozisyonu ve semantic CTA’lar.
- `src/shared/components/v4/AppScreen.tsx`: Home’un priority viewport’u için optional scrollRef; diğer çağrılar aynı şekilde render edilir.
- `src/features/home/components/HomeAtmosphere.tsx`, `HomeCounter.tsx`, `HomeStatusCapsules.tsx`, `HomeIcon.tsx`: native sky, gerçek süre, capsules ve native SVG.
- `src/features/home/homePresentation.ts`, `useBloomHomeFeature.ts`: readonly elapsed anchor, mevcut progress ve focus/foreground refresh; business actions/controller aynı.
- `src/features/debug/phase10/phase10QaSession.ts`, `Phase10QaProvider.tsx`, `Phase10QaScreen.tsx`: yeni run izolasyonu ve private-clock QA; production runtime değişmez.
- `scripts/verify-bloom-home-ui.ts`, `verify-bloom-home-animation.cjs`, `run-bloom-home-ui-verification.cjs`, `verify-bloom-phase10-qa.ts`, `verify-bloom-release-debug-guards.cjs`: presentation, timers/Reduce Motion ve isolation guards.
- `.maestro/home-dashboard*.yaml`, `scripts/extract-home-reference.cjs`: native QA ve orijinal HTML render kaynağı.
- Bu QA belgesi, deferred listesi, `docs/qa/home-dashboard/` galeri/screenshot/test/preservation kanıtı.
- `docs/patches/phase11-6-1-home-text-only.patch`: bu fazın text-only review diff’i; PNG/binary görüntüler ayrı galeride. Önceden mevcut patch dosyaları değiştirilmez.

Home domain, Tracking/Content-Free/Reset/Urge transitions/controller’ları, v8 schema, v7 migration, Bloom providers/coordinator, audio, Library ve Kegel davranışı değiştirilmedi. Navigasyon guard’ları ve dört tab değişmedi. Commit/push yok.

## Teslim doğrulaması

| İstenen iOS durumu | Sonuç / ekran |
| --- | --- |
| Fresh / kapalı Tracking | Geçti. 01; isim ve streak uydurulmaz, iki bağımsız takip seçeneği. |
| Tracking açık | Geçti. 04 boş aktif takip; 11 gerçek tamamlanan kayıttan üç gün, kalite 7/10, count 1, aralık `—`. |
| Content-Free kapalı / aktif | Geçti. 02, 05–07; aktifleştirme mevcut acknowledged action üzerinden. |
| Yeni Content-Free streak | Geçti. 08; mevcut confirmation akışında izole violation kaydı, yeni seri 0 ve best 3 korunur. |
| Aktif Reset | Geçti. 15–18; dokuz completed gün / current 10/15; yeni Tracking/oturum engelli, Content-Free earned credit 9. |
| Reset completion / continuation | Geçti. 19–22; 15 günün dolması explicit result action ister, offer pending CTA’dır; kabul sonrası gerçek earned 15 gün. |
| Başarısız persistence / recovery | Geçti. 03; save failure doğrulanmış aktivasyon sayılmaz, retry mevcut coordinator’da; başarısız kayıt sırasında Library tab guard’ı etkili. |
| Urge dönüşü / öncelik | Geçti. 12–13, 23; açık event devam CTA’sı, tamamlandığında normal Home. Scrolled Home’a dönüşte priority görünür. |
| Restart | Geçti. 06, 14, 18; takip/gerçek geçmiş/Reset/izole clock tekrar okunur. |
| Önceki kullanıcı ve QA kayıtları | Başlangıçtaki 14 anahtarın tamamı aynı SHA-256 ile korundu (normal Bloom 1/1, eski E2E 13/13); yalnız dört yeni Home namespace’inde 7 anahtar eklendi. Sonuç [storage-preservation.json](qa/home-dashboard/storage-preservation.json). Hiçbir eski kayıt değişmez veya silinmez. |

Run’lar: `home_fresh_20261013_a81d` (gerçek history), `home_reset_20261013_c49a` (aktif Reset), `home_completion_20261013_d7b2` (completion/continuation), `home_final_20261013_f83e` (son presentation ile fresh/failure/retry/smoke). Her run boş namespace ile başlamıştır. Reset son captures mevcut aynı namespace’i yalnız okuyarak yenilendi; fixture tekrar uygulanmadı. Native fresh ve active Reset flow’ları bütün olarak geçti. History ve completion akışları yukarıda açıklanan assertion düzeltmelerinden sonra, başarılı state mutation’ları tekrarlamadan segmentler halinde tamamlandı. Bu, düzeltilmiş tüm YAML’ların tek parça fresh rerun yaptığı iddiası değildir. [Native sonuç envanteri](qa/home-dashboard/native-results.json).

Profile, Library ve Kegel native smoke geçti (24–26); Kegel seansı veya Library ses kaydı değiştirilmedi. Audio ve diğer kapsamlı davranış kontrolleri otomatik regresyonlarla doğrulandı. En büyük Simulator Dynamic Type (`accessibility-extra-extra-extra-large`) üst/alt testi geçti (27–28). Bu ölçekte doğal metinler çok satıra yayılır ve daha fazla kaydırma gerekir; testin scroll timeout’u artırıldı, font ölçeği kapatılmadı. Simulator başlangıç ayarı `large` geri yüklendi. Gerçek cihaz VoiceOver, Android ve OS Reduced Motion toggle bu fazda test edilmedi; Reduced Motion davranışı component harness’te doğrulandı.

İlk teslimin son kod değişikliğinden sonra typecheck, Home UI, persistence, acknowledgement, navigation, release guards, Profile, Library, audio ve iki Kegel suite tekrar geçti (`final-checks-0.json`, `final-checks-1.json`). Journey, Reset continuity/protection, guided flows, onboarding UI ve E2E runtime kontrolleri de bu fazda geçti. `git diff --check` geçti. Review patch’i bağımsız HEAD arşivinde `git apply --check --whitespace=error` ile geçti; binary diff içermez. Galeri bağlantıları doğrulandı. İlk teslimde 5 HTML referansı + 28 ham native PNG vardı; final visual güncellemesi 35 native PNG’ye çıkarır; [screenshot-hashes.json](qa/home-dashboard/screenshot-hashes.json) boyut ve SHA-256 envanteridir. İlk teslimde 01–06, 15–18 ve 23–28 o teslimin son koduyla çekildi; diğerleri önceki gerçek akış captures’ıydı. Final visual sonrası güncel liste 01–06, 09, 11, 15–18 ve 27–35’tir. Kalan captures tarihsel presentation’ı gösterir. Workflow/veri anlamları aynıdır. Screenshot’larda Expo “Refreshing…” overlay’i kullanılmadı.

Açık ürün kararları deferred listesinde; bu fazdaki gerçek Home işlevinde açık blocker yok. En büyük yazı boyutundaki çok uzun metinlerin daha kısa kopyayla iyileştirilmesi, gerçek cihaz erişilebilirlik incelemesinde değerlendirilebilir. Bu iyileştirme font ölçeklemesini devre dışı bırakmayı gerektirmez.

## Final Visual QA düzeltmeleri

Bu bölüm ilk teslimden sonra istenen iki presentation düzeltmesinin kanıtıdır; önceki test/capture kayıtları tarihsel kalır.

**Status alanı:** ScrollView’in style padding’i içerik için başlangıç boşluğu oluşturuyor, fakat kaydırılan içerik/fog’un o alandan geçmesini engellemiyordu. Yalnız `BloomHomeScreen` içinde üst safe-area inset sabit opak root’a taşındı. İçteki Home ScrollView top padding’i 0 ve overflow’u hidden olur; aynı inset iki kez uygulanmaz. Body/fog viewport’u status alanının altında başlar ve kaydırma/bounce sırasında orada kırpılır. Bottom/left/right safe areas, scrollRef ve mevcut priority focus callback korunur. Loading/unavailable ekranları kendi mevcut AppScreen safe area’sını kullanır. Shared AppScreen, navigasyon ve diğer tab’lar bu düzeltmede değiştirilmedi.

**Urge etiketi:** Yalnız Home’daki loading durumuna ihtiyaç duymayan entry, native Pressable + mevcut AppText kullanır. İki boş indicator slot’u yerine tüm genişlik ve 8pt yan boşluk etikete ayrılır. Aynı tam label, button accessibility role, onPress route ve görünür keyboard focus ring korunur; pressed feedback vardır. Font ölçekleme, point size, tam metin ve accessibility label kısıtlanmaz; ellipsis/numberOfLines/auto-shrink eklenmez. En büyük iOS Dynamic Type capture 28’de “Şu an” ve “zorlanıyorum” iki tam satırdır.

**Yeniden doğrulama:** Typecheck, Home UI/animation/clock, navigation, persistence, acknowledgement, Reset continuity ve protection/Reset testleri geçti. Home harness status inset’in scroll viewport’u dışında olduğunu, tam Urge label/role’unu, unfinished resume scroll-to-top’u ve pending/failed activation’da mevcut retry viewport’unun korunmasını doğrular. Domain/action/persistence değişikliği yok. `final-visual-checks.json` ve `final-visual-*.log` bu tekrarın sonuçlarıdır.

Native Tracking üst/orta/alt/üste dönüş (11, 29–31), aktif Reset üst/orta/alt/üste dönüş ve restart (15–18, 32–34), en büyük yazı üst/alt (27–28) yeniden çekildi. Mevcut saved Tracking/Reset run’ları yalnız okunur; clock advance veya scenario preparation kullanılmaz. Fresh/save failure/retry/guard ve unfinished-session focus kontrolü için yalnız yeni `home_visual_20261013_b29f` namespace’i kullanılır. Önceki namespace’ler temizlenmez/değiştirilmez. Kaydırılmış Home’dan Profile ve Home tab’larıyla dönünce unfinished CTA, ek kaydırma olmadan görünür (35). Pending-save Library tab guard’ı ve mevcut retry doğrulanır; yeni QA oturumu kaydedilmiş halde bırakılır.

[Final visual native sonuçları](qa/home-dashboard/final-visual-native-results.json), [status alanı pixel kontrolü](qa/home-dashboard/final-visual-status-area.json) ve [önceki tüm kullanıcı/QA anahtarlarının korunması](qa/home-dashboard/final-visual-storage-preservation.json) teslim kanıtlarıdır. Status alanı native ham PNG’lerde incelenir; bu kontrol UI screenshot düzenlemesi yapmaz. Normal ve Reset kaydırma durumlarında içerik ve kırmızı düğme sistem saatinin altında kırpılır, status arkasına geçmez. Simulator yazı ayarı `large` geri yüklendi. Başlangıçtaki 21 kullanıcı/QA anahtarının tamamı aynı SHA-256 ile korundu; yalnız yeni visual QA namespace’inde bir v8 anahtarı eklendi. Kontrol edilen 21 güncel capture’ın tüm 62pt status şeridi aynı raw pixel hash’ini verir; glyph/island dışındaki alan tamamen opak `#010208`’dir. Galeri şimdi 5 HTML + 35 native PNG içerir; tüm SHA-256’lar yeniden üretildi. Native testlerde silme/reset/reseed yoktur.

Bu düzeltmenin değişen dosyaları: `BloomHomeScreen.tsx`, `scripts/verify-bloom-home-ui.ts`, üç `.maestro/home-dashboard-visual-*.yaml`, bu QA belgesi, QA capture/hash/galeri/sonuç dosyaları ve güncellenmiş text-only review patch’i. Önceki uygulama ve deferred listesi korunur. `git diff --check` ve temiz HEAD arşivinde text-only patch whitespace/uygulanabilirlik kontrolü geçti. Galeri bağlantıları doğrulandı. Commit/push yapılmadı.
