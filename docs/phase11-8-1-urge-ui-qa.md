# Bloom — Phase 11.8.1 Native Zor An UI / QA

15 Ekim 2026, Europe/Istanbul. Dal: `feature/product-ui-v1`.
Onaylı başlangıç ve değişmeyen HEAD: `4d46ce3c8db13cc750fc2f386f0d03b32fe0f806`.
Commit veya push yapılmadı. Başlangıçta bulunan başka fazlara ait untracked QA
logları ve `docs/patches/` içerikleri korunur; bu fazın patch’ine alınmaz.

[HTML/native galeri](qa/urge-control/index.html) ·
[11.8.2 entegrasyon önerisi](phase11-8-2-urge-integration-proposal.md) ·
[Git yayın kapsamı](qa/urge-control/publication-scope.md).
Yerel önceki review patch’i `docs/patches/phase11-8-1-urge-ui-review.patch`
altında korunur ve Git yayın kapsamına alınmaz.

## Sonuç ve kapsam

React Native ekranı; native SVG LCD, koyu atmosfer/mavi sis, 5/10/15/20 dk
seçimi, açık Başlat, kalan süre, 4–4–6 örnek ritmi, duraklat/devam, serbest
çıkış ve nötr bitiş durumunu içerir. WebView veya yeni paket yoktur.

Bu ekran yalnız QA önizlemesidir. Üretim Panic/Urge Control ekranlarına
bağlanmadı. Sayaç bitişi bir outcome değildir; otomatik kayıt veya “dürtü
azaldı” beyanı yoktur. Başlangıç, bitiş ve erken çıkış Tracking, Content-Free,
Reset, Behavior Slip, Urge Control veya legacy Pause’a komut göndermez.

## Audit: ürün, legacy Pause ve HTML farkları

İncelenen kaynaklar: `PanicScreen`, `usePanicFeature`, `panicController`,
`UrgeControlResumeScreen`, `useUrgeControlFeature`, `urgeControlController`,
`UrgeControlEvent/State`, `getUrgeControlProgress`,
`bloomUrgeControlTransitions`, `PauseTimerScreen`, `pauseTimerState`,
`bloomStateSchema/bloomStatePersistence`, `PracticePreviewScreen`,
`PracticeText/practiceTypography`, `PracticeVisuals`, `HomeAtmosphere`,
Kegel görselleri, iki HTML dosyasının `timerHTML`, `runHTML`, `run/endRun`
fonksiyonları ve uygulama planının “Zor an (öneri)” bölümü.

| Konu | Mevcut ürün / eski akış | HTML deneyimi | Phase 11.8.1 kararı |
| --- | --- | --- | --- |
| Panic dalları | “Şu an tetiklendim” start/resume Urge; “Seriyi bozdum” neden/etki önizlemesi ve açık Behavior Slip onayı. Ayrı facade/controller komutları. | Tek zamanlayıcı görünümü; bu iki dalı temsil etmiyor. | Dalları birleştirmeyen, ayrı debug route. Üretim komutları değişmedi. |
| Güncel Urge | `flowVersion:2`, interrupt → outcome → optional çoklu triggers → explicit completion. Süre hedefi yok. | 10 dk varsayılan; preset/stepper; tam ekran sayım. | Geçici süre ve ritim, domain’in dışında. Domain timer’ı veya aşama geçişi değil. |
| Outcome | Dört kullanıcı yanıtı; `reduced/stillStrong/stronger/unchanged`. | Sıfırda veya “Geçti, bitir” basılınca `endRun(true)` → “Atlattın” toast’ı. | “Süre doldu”, “Nasıl hissettiğine sen karar verirsin”; sonuç yok. |
| Triggers | `explicitContentCue` gözlemdir; slip veya sayaç ihlali değildir. `[]` açık atlama. | Triggers adımı yok. | Üretim semantiği ve kayıtları aynen korunur. |
| Legacy Urge | Versiyon eklenmeden teknik, phone-away, outcome, tek trigger aşamaları; zaman/kimlik guard’ları. | Tek nefes rehberi. | Eski olaylar dönüştürülmez; bu fazda teknik enum’u eklenmez. |
| Legacy Pause | Configured/elapsed süreleri, active session id ve immutable records; timer geçişi/check-in gerçek state’i günceller. UI countdown ve uzatma/reconcile yardımcıları var. | `setInterval` ile `left--`, bağımsız timeout nefes döngüsü. Pause/foreground politikası yok. | İkisi de kopyalanmadı. Pure monotonic aktif süre, tek UI interval ve açık foreground devamı. Pause kayıtlarına erişim yok. |
| Başlatma | Urge event’i gerçek facade start eylemi yaratır. | Preset seçimi tek başına başlatmaz; alternatif kart basışı direkt `run()` çağırır. | Yalnız açık Başlat; karttan otomatik başlangıç yok. |
| Görseller | Practice/Kegel Reanimated ve SVG; Home atmosferinde odak/background ve motion guard’ları. | CSS/canvas fog, plastik LCD iç gölge, 14 sn halo, blink colon. | Hafif native SVG + Reanimated opacity/scale. Sis ekran kenarlarının dışına taşarak keskin kutu sınırını önler. Blink yok. |
| Tipografi | Practice’in karmaşık native kelime/paragraf ölçümü önceki somut sorunlar içindi. | Sabit telefon ve CSS font ölçüleri. | Ölçüm ağacı kopyalanmadı. Kontrol/başlıklar `sqrt(fontScale)` kadar büyür; açıklamalar tam native ölçeklenir. Sabit text yüksekliği/truncation yok. |
| Persistence | Güncel gerçek sürüm **v9**, anahtar `bloom.localState.v9`; bazı eski README’lerde v7 bilgisi tarihsel kalmış. | Kalıcı gerçek kayıt sözleşmesi yok. | Schema, versiyon, anahtar ve migration değişmedi. |

## İzolasyon ve giriş

`npm run start:e2e:urge-preview` → Metro `8084`.
E2E dev-client bu Metro’ya bağlandıktan sonra:

- `tms-e2e:///debug/urge-control`: normal süre seçimi.
- `tms-e2e:///debug/urge-control?fixture=completion`: açıkça etiketli 2 saniyelik QA bitiş denemesi. Açık Başlat gerekir; kullanıcı presetine veya kalıcı olaya dönüşmez.

Gate aynı anda development, E2E mode, `com.umutcyilmaz.bloom.e2e` bundle ve
`EXPO_PUBLIC_URGE_PREVIEW=1` ister. Normal ürün menülerinde bağlantı yoktur.
Flag kapalı veya release ortamında route `/` adresine yönlendirir.

Preview flag’i açıkken kök `AppProviders`, navigation boyunca sabit kalan yeni
bir memory runtime kullanır. Canonical veya eski QA verisi hydrate/migrate
edilmez. `save` durable başarı vermez; retained bir üretim route’u cihaz kaydı
başarısı gösteremez. Preview ekranı domain/provider mutation API’si import etmez.
Üretim regresyonu ayrı Metro ve yeni namespace ile sınanır; preview runtime’ı
üzerinden gerçek akışı tamamlamaya çalışılmaz.

## Sayaç / nefes / erişilebilirlik sözleşmesi

`createUrgePreviewTimer` React, scheduler, storage ve domain’den bağımsızdır.
Enjekte edilen `performance.now()` saatinden anchor + accumulated aktif süre
hesaplanır. Tick sayısı, render sıklığı, duvar saati ve saat dilimi süreyi
belirlemez. Geç kalan tick doğru konuma sıçrar; sıfır altına inmez. Gerçek
5/10/15/20 dk sınırları fake monotonic saatle sınanır.

| Durum | Süre / etkileşim |
| --- | --- |
| Hazır | Süre işlemez; seçim yalnız ready durumunda. Başlat ayrı eylemdir. |
| Çalışıyor | Tek 100 ms UI örnekleyici; doğruluk örnekleyiciye bağlı değildir. |
| Duraklat | Gerçek basış anına kadar aktif süre alınır, sonra donar. Tekrar basış anchor’ı değiştirmez. |
| Arka plan / inactive / odak kaybı | Sayaç paused olur; süre işlemez. Foreground otomatik resume etmez. |
| Çıkış diyaloğu | Süre ve hareket durur. “Burada kal” paused halde bırakır; Devam et açık eylemdir. |
| Erken çıkış | Süre bekleme şartı yoktur. Guard önce serbest bırakılır, sonra Home’a gidilir. Çifte onay çift navigation yaratmaz. |
| Süre doldu | Geçici completed ekranı; interval kapanır. Outcome veya event completion komutu yoktur. |
| Unmount / restart | Interval, AppState/BackHandler/motion listener ve animasyonlar temizlenir. Yeni process/ekran hazır durumdan başlar. Strict Mode replay aradaki zamanı saymaz. |

4 sn al / 4 sn tut / 6 sn ver metni ve halo aynı `elapsedMs % 14000`
çerçevesini kullanır. Tween yalnız faz sınırı veya pause/resume sırasında kalan
faz süresiyle kurulur; bağımsız nefes interval’i yoktur. Reduced Motion’da halo
sabittir ve modal fade kapanır. Native ayar değişikliği canlı dinlenir; geç
çözülen ilk async okuma yeni ayarı ezemez.

Timer tek accessibility öğesidir; dakika/saniye tam etiketi ve sorgulanabilir
değeri vardır. Canlı saniye anonsu yoktur. Başlat/durakla/bitiş durumları anons
edilir; her nefes fazı veya saniye otomatik okunmaz. Dialog native modal, başlık,
açılış anonsu ve birlikte kaydırılan eylemler kullanır. Kapat simgesi dekoratif
olduğu için yalnız o glyph’in scaling’i kapalıdır; button etiketi tamdır.
Global font scaling kapatılmadı. Tüm ana kontroller min. 44/56 pt ve içerikle
büyüyen yüksekliktedir; sabit footer yoktur. Üst durum alanı safe-area içindedir.

## QA ve kanıt

Kontrollü hook/clock testleri gerçek TS/TSX fonksiyonlarını çalıştırır; yalnız
source string kontrolüne dayanmaz. Gerçek native piksel incelemesi ayrı yapılır.

Otomatik kontroller: `typecheck`, `verify:urge-preview`, `verify:persistence`,
`verify:persistence-acknowledgement`, `verify:reset-continuity`,
`verify:protection-reset`, `verify:navigation`, `verify:practice`,
`verify:guided-flows`, `verify:release-debug-guards`, `verify:e2e-runtime`,
`verify:e2e-app-identity`. Sonuçlar ve log yolları [test-results.json](qa/urge-control/test-results.json) içindedir.

Native test envanteri: [.maestro/urge-preview.yaml](../.maestro/urge-preview.yaml),
[tipografi](../.maestro/urge-preview-typography.yaml),
[Reduced Motion](../.maestro/urge-preview-reduced-motion.yaml),
[son görsel/restart](../.maestro/urge-preview-gallery.yaml),
[üretim dalları](../.maestro/urge-preview-production-regression.yaml).

Native: iOS 26.3, iPhone 17 Pro (402×874 pt) ve iPhone 13 mini
(375×812 pt); her iki cihazda normal `large`, orta `extra-extra-extra-large`,
maksimum `accessibility-extra-extra-extra-large` koşuları geçti. Native lifecycle,
restart, Reduced Motion ve ayrı üretim regresyonu da geçti. Sonuçlar
`test-results.json` / `manual-inspection.json` ile raporlanır. İlk denemelerde üç QA sorunu ayrıştırıldı: SVG stop değerinde
başında sıfır olmayan kesir uyarısı; maksimum metinde uzun kelime bölünmesi;
Maestro’nun retained scroll konumu ve tek ekranı aşan paragrafa %100 görünürlük
istemesi. Gradyan değerleri ve sis sınırı düzeltildi; modal metni kısaltıldı;
testler yeni ekran açıp büyük açıklamayı kaydırarak yakalar. Dev-client menüsünde
kalan ilk Reduced Motion denemesi kabul kanıtı değildir; explicit Metro bağlantılı
son koşu kullanılır. Dar maksimum koşusundaki tek karşılık bulmayan otomasyon dokunuşu son koşuda
paused durumunu açıkça doğrulayan ve gerekirse aynı idempotent Pause eylemini
tekrarlayan testle yeniden sınandı. Ara/başarısız koşular final PASS diye sunulmaz.

Veri koruma: [storage-preservation.json](qa/urge-control/storage-preservation.json).
Preview sonrasında hedefte 34/34, dar cihazda 45/45 anahtar ve değer hashleri
aynıdır. Ayrı üretim regresyonu yalnız `bloom.e2e.home.urge1181_prod_20261015_01.`
altında iki yeni anahtar ekledi; mevcut 34 değer değişmedi. Sentetik v9 kaydında
tek explicit `unchanged` Urge sonucu ve `explicitContentCue` gözlemi, ardından
ayrı slip onayıyla bir manual Reset + bağlı Content-Free ihlali doğrulandı.
[Üretim kanıtı](qa/urge-control/production-regression-evidence.json) ve
[değişmeyen kaynaklar](qa/urge-control/production-source-preservation.json).
Yalnız hash ve anahtar sayıları alınır; kullanıcı kayıt içerikleri export edilmez.
Hiçbir kullanıcı/QA verisi resetlenmedi veya silinmedi. İki mevcut QA Simulator
sırayla kullanılır; aynı anda bir tanesi açık tutulur. Metin/motion ayarları ve
başlangıçtaki booted cihaz durumu test sonunda geri yüklenir.

## Değişen dosyalar ve görsel sınırlar

- `app/debug/urge-control.tsx`: korumalı, etiketli QA route ve completion fixture.
- `src/features/urge-control/preview/*`: geçici timer/model, ekran, native SVG/animasyon, runtime gate/memory ve canlı Reduced Motion hook’u.
- `src/app/providers/AppProviders.tsx`: opt-in build izolasyonu ve QA route’un açık status bar’ı.
- `package.json`: önizleme başlatma ve test komutları; yeni dependency yok.
- `.maestro/urge-preview*.yaml`, `scripts/*urge*`: deterministik UI/animation testleri, native akışlar, salt-okunur storage hash ve kaynak/galeri üretimi.
- Bu rapor, entegrasyon önerisi, `docs/qa/urge-control/*` galeri/kanıtları ve text-only patch.

Normal tasarım LCD oranı/segment geometrisi, mavi vurgu, koyu sayım yüzeyi ve
nefes odağıyla HTML’ye yakındır. Native iç gölgeler, plastik kenar ve cam parlaması
CSS kadar ayrıntılı değildir; Inter fontu farklıdır. Safe-area ve QA etiketi
üst boşluğu artırır. Native açık pause/resume ve nötr bitiş ekler. HTML stepper’ı
5–60 dk aralığına, alternatif kartları 2 dk soğuk su/15 dk yürüyüşe gider; bu
fazın 5/10/15/20 dk kapsamına alınmadı. Üç alternatif kart yerine kısa, kayıtsız
kılavuz kartı vardır. HTML seri sayıları ve başarı iddiası taşınmadı.

## Kalan kararlar / riskler

Üretime bağlama bu teslimatın parçası değildir. [11.8.2 önerisi](phase11-8-2-urge-integration-proposal.md)
preset/rehberi interrupt içinde isteğe bağlı bir alt görünüm olarak konumlar;
mevcut outcome → triggers → completion komutları ve kayıt anlamları korunur.
Varsayılan 10 dk, süre hedefi olmayan akışla dil uyumu, ek alternatif içerikler
ve olası süre tercihi persistence’i ürün review’ı ister.

Gerçek cihazda VoiceOver focus/okuma ergonomisi ve uzun süreli enerji profili
ayrıca değerlendirilmeli. Bu rapor Simulator ve kontrollü animasyon testlerini
fiziksel cihaz performans ölçümü olarak sunmaz. Nefes örneği klinik tedavi veya
garanti iddiası içermez. Review bekleniyor; 11.8.2 uygulanmadı.

## Son yayın hazırlığı

Onaylı 75 orijinal PNG yerelde korundu; Git için 22 temsilî kare seçildi.
Galeri ve screenshot hash envanteri yalnız bu açık seçimi içerir. Yayın kapsamı
[review-files.txt](qa/urge-control/review-files.txt) ve
[review-manifest.json](qa/urge-control/review-manifest.json) ile belirlenir.
Görüntü boyutu 110.180.646 byte’tan 27.686.366 byte’a düştü (%74,87 azalma);
bu pikselleri değiştiren bir işlem değildir.

Bu hazırlıkta runtime/deterministik test kaynakları ve 11.8.2 önerisi byte
düzeyinde korundu. Yeni Simulator görsel testi koşulmadı. Typecheck, mevcut
urge-preview doğrulaması, yayın bağlantı/hash/kapsam denetimi ve diff check
sonuçları [publication-verification.json](qa/urge-control/publication-verification.json)
içindedir. Stage, commit veya push yapılmadı.
