# Phase 11.8.2D — Final UI & Accessibility QA

15 Ekim 2026, Europe/Istanbul. Base/HEAD:
`643d081d9bec3f6e2dca38207c492107a7a0e023`, branch
`feature/product-ui-v1`. Audit-only; üretim dosyası değiştirilmez.
Commit/push/merge yok; bağımsız inceleme için hazırlanır.

## Preflight ve kanıt sınırı

Doğru branch/HEAD, temiz tracked çalışma ağacı ve boş staging doğrulandı.
Başlangıçtaki 64 untracked QA/patch girdisi içindeki 80 dosyanın SHA-256
değerleri C başlangıç manifestiyle aynı. D manifesti yalnız
`/tmp/bloom-D-baseline.json` altında.

Okunan kanıtlar: [11.8.1 QA](phase11-8-1-urge-ui-qa.md),
[B QA](phase11-8-2b-urge-integration-qa.md),
[C audit](phase11-8-2c-regression-audit.md), önceki gallery/README,
B normal ready/exit ve narrow maximum görüntüleri. Exercise, visuals,
Reduced Motion hook, production resume screen, AppButton/AppText ve mevcut
Maestro/verification script'leri incelendi.

| Konu | Önceki kanıt | D'deki yeni ihtiyaç |
| --- | --- | --- |
| Timer state'leri / expiry / preset | 1 ve B gerçek timer + executable tests | Güncel production normal smoke ve nötr completion |
| Exit / ACK / retry / cold restart / event identity | B combined guards ve C gerçek device restart | Görünür saving/error/retry ergonomisi; domain suite tekrarı yok |
| Ready/exit maximum typography | B iki cihaz screenshot'ı | Narrow action reachability; downstream maximum ekranlar |
| Legacy lifecycle | C gerçek production UI ve persistence | Maximum metinde eski kart ve Devam et erişimi |
| Reduced Motion | 1/B device + native event hook testleri | D'de gerçek ayarı değiştirme, mounted UI/pause/resume |
| VoiceOver | Önceki kaynak/otomasyon; gerçek VO pass yok | Gerçek destek araştırması; destek yoksa dynamic Not Verified |

## Cihazlar ve izolasyon

| Cihaz | UDID / model | Native viewport | Metin |
| --- | --- | --- | --- |
| Bloom Practice Typography QA Target | `3C8CE983-39F5-41A0-B781-2AACDBCD1273`, iPhone18,1 (17 Pro) | 402 × 874 pt, 3× | Başlangıç `large`, fontScale 1 |
| Bloom Practice Typography QA Narrow | `890ADA65-17D8-4EEC-AFDE-853AEE570448`, iPhone14,4 (13 mini) | 375 × 812 pt, 3× | `large`; D ana matrisi `accessibility-extra-extra-extra-large`, fontScale 3.571 |

İkisi iOS 26.3; portrait/light appearance, Increase Contrast kapalı.
Başlangıç ReduceMotionEnabled=0; narrow başlangıçta shutdown, target booted.
Native boyut/fontScale debugger `Dimensions` üzerinden salt okunur doğrulandı.
Bundle `com.umutcyilmaz.bloom.e2e`, APP_VARIANT=e2e,
EXPO_PUBLIC_E2E_MODE=1, EXPO_PUBLIC_PHASE10_QA=1,
EXPO_PUBLIC_URGE_PREVIEW=0. İki ayrı cihazın yeni
`bloom.e2e.home.urgeD_20261015_final.` namespace'i bir kez mevcut day10-credit
fixture düğmesiyle kuruldu. Panic → Şu an tetiklendim → gerçek production
exercise kullanıldı. Canonical kullanıcı storage'ı temizlenmedi veya reseed edilmedi.

## VoiceOver yöntemi ve sınırlamalar

Gerçek Simulator Settings → Accessibility ekranı CUA ile açıldı. Vision
grubunda Hover Text, Display & Text Size, Motion ve Spoken Content var;
VoiceOver seçeneği yok. Simulator Features menüsünde de VoiceOver yok.
Bağlı disposable fiziksel cihaz sağlanmadı. Spoken Content veya host macOS
VoiceOver, iOS VoiceOver testi yerine kullanılmadı.

Bu nedenle gerçek ekran girişi/okuma sırası, spoken selected/disabled states,
saniye anons davranışı, modal odak transferi/geri dönüşü ve modal arkasına
screen-reader erişimi **Not Verified**. Screenshot, test ID veya AX ağacı
bu dinamik davranışlar için Pass kanıtı sayılmadı.

Statik/native AX incelemesi: başlıklar header; duration radio/checked;
start/pause/resume/evaluate button ve disabled state; LCD tek timer öğesi,
tam dakika/saniye label + mm:ss value, liveRegion none; SVG/atmosfer
accessibilityElementsHidden/no-hide-descendants. Anons effect'i phase
değişimine bağlı, her tick'e değil. Native Modal ve accessibilityViewIsModal,
başlık ve açılış anonsu var; açık setAccessibilityFocus/restore çağrısı yok.
Outcome radio eylemleri hemen ilerler; trigger checkbox'ları checked state
taşır. Save state polite, failure alert, retry açık düğme. Bunlar gerçek
VoiceOver ergonomisi için yalnız ön incelemedir.

## Sonuç matrisi

T=Target, N=Narrow; normal=`large`/1, max=`accessibility-extra-extra-extra-large`/3.571.
"AX/statik" sütunu VoiceOver execution anlamına gelmez. Tüm dinamik iOS
VoiceOver senaryoları yukarıdaki sınırlama nedeniyle Not Verified'dır.

| Ekran / durum | Cihaz / metin | Görsel / kullanılabilirlik | AX/statik erişilebilirlik | Sonuç / önem | Kanıt |
| --- | --- | --- | --- | --- | --- |
| Ready, stopped 10:00 | T normal; N max | LCD açık; süreler seçili sınırla ayrışıyor; max eylemler scroll ile erişilir | Header, timer label/value, radio checked | Pass | B normal ready + yeni 01; `/tmp/bloom-D-target-normal/` |
| 5/10/15/20 seçimi | T normal | 20/15 LCD değeri, 10/5 seçimleri ve açık start yürütüldü | Radio semantics mevcut | Pass | `bloom-D-target-normal.yaml` |
| Running | T normal | LCD/ritim/iki ana eylem görünür; nefes metni nötr | Dekoratif görseller AX dışı; non-live timer | Pass | Yerel target-running-normal capture |
| Running → paused → resume | N max | Ana eylemler scroll ile tam erişilir, overlap yok | Buton adları ve disabled state kaynakta | Pass | 02 + narrow-exercise exit 0 |
| Completed (gerçek 5 dakika) | T normal | 00:00, nötr açıklama, evaluate/reset görünür; outcome kendiliğinden açılmaz | Completion heading/phase announcement kaynakta | Pass | Yerel target-completed-normal capture; target-normal exit 0 |
| Exit modal / iptal / onay | N max | Başlık ve prose kaydırılır; iki eylem erişilir; cancel paused, confirm Home | Native Modal/accessibilityViewIsModal; odak davranışı NV | Pass (visual/touch) | 03 + narrow-exercise exit 0 |
| Outcome | N max | Seçenekler okunur ve scroll ile erişilir; stronger seçildi | Dört radio eylemi, mevcut semantic değer | Pass | 04 + downstream execution |
| Triggers / çoklu seçim | N max | Stres/Yalnızlık seçildi, Save erişilir; kelimeler çok parçalanıyor | Native checkbox checked; persisted summary iki seçimi gösterdi | Pass with Minor D-03 | 05 + 06 |
| readyToComplete summary | N max | Sonuç değeri sağdan kesiliyor; dikey scroll çözmüyor | AX tam Daha güçlü metnini içeriyor; visual erişim Fail | **Fail / Major D-01** | 06 |
| Final Home action | N max | Düğmenin tamamına scroll ile ulaşıldı; safe-area üzerinde | Button label mevcut | Pass (reachability only) | 07; major görüldükten sonra action basılmadı |
| Saving / disabled | T max | Kaydediliyor görünür; preset/start disabled; outcome açılmaz | State label; disabled props mevcut | Pass | Yerel saving-maximum + error-maximum flow |
| Error / retry | T max | Açık hata metni ve Yeniden kaydet scroll ile erişilir; retry sonrası outcome açılır | Alert + retry; actual VO feedback NV | Pass | 09; error-maximum exit 0 |
| Legacy interrupt rehber seçenekleri | N max | Dairelerde yalnız N ve Ç görünür; anlam kaybı | Tam accessibilityLabel kaynakta var, VO execution yok | **Fail / Major D-02** | 10 |
| Legacy Devam et / technique | N max | CTA görünür ve basılarak canonical technique'e geçildi; yeni exercise yok | Eski CTA ve native button label mevcut | Pass (progression smoke) | 08; legacy-maximum exit 0 |
| Reduced Motion / mounted change | T normal | Gerçek ayar ON/OFF, background pause, resume, timer ve modal yürütüldü; fazlar arasında ON statik, OFF hareketli | Native ayar ve mevcut hook testleri ayrı kanıt | Pass (visual/touch) | Aşağıdaki motion kaydı |
| Gerçek VoiceOver | Simulator | Gerçek VO bulunamadı | Kaynak/AX incelemesi mevcut | **Not Verified** | Settings → Accessibility incelemesi |

Bu matriste Pass yalnız belirtilen device/state ve visual/touch sınırı içindir.
Normal downstream yeni D görsel matrisi veya her kombinasyonun tam çapraz
ürünü çalıştırılmış sayılmadı. C'nin geçmiş domain/persistence testleri tekrar
edilmedi. Ayrı bir D PASS veya yayın onayı verilmedi.

## Bulgular — önem sırası

### D-01 — Major: kayıt özetinin sonuç değeri yatay kesiliyor

Repro: N 375×812 pt, max fontScale 3.571. Gerçek Panic/current exercise →
explicit evaluate → **Daha güçlü** → triggers Stres + Yalnızlık → Kaydet →
kayıt özetine scroll. [06](qa/urge-control/phase11-8-2d/06-narrow-summary-maximum.png).
Kayıt özeti tekrar Home'dan açıldığında da aynı durum görüldü; yalnız retained
scroll'a bağlı değil.

Beklenen: Şu an ve Daha güçlü bütünüyle okunabilmeli; gerekirse dikey
yerleşim/scroll ile. Gerçek: Şu an ve sonuç aynı satırda; Daha güçlü sağ ekran
kenarında kesiliyor, yatay scroll yok. Dikey kaydırma eksik kısmı geri getirmiyor.
Etki: Kullanıcı tamamlamadan önce temel sonuç alanını görsel olarak doğrulayamıyor.
AX ağacında tam metnin bulunması bu görsel kusuru gidermez.
Muhtemel sahibi: `UrgeControlResumeScreen.tsx` summaryRow (satır 131/230),
row layout ve iki AppText için responsive shrink/wrap sınırının olmaması.
Current üzerinde reproduce edildi; ortak legacy summary dalı için risk kaynak
incelemesinden çıkarımdır, ayrı legacy completion cihaz deneyi yapılmadı.
Bu yol durduruldu; final action yalnız görünürlük kanıtından sonra basılmadı.
Üretim düzeltmesi yapılmadı; ayrı hedefli inceleme kararı gerekir.

### D-02 — Major: legacy yerel rehber düğmeleri ilk harfe kadar kesiliyor

Repro: Ayrı boş QA namespace'e mevcut C `initial(false)` fixture'ını gerçek
serialization ile yükle → N max → Home primary → legacy interrupt → rehber
dairelerine scroll. [10](qa/urge-control/phase11-8-2d/10-narrow-legacy-label-clipping-maximum.png).

Beklenen: Nefes al / Çevrene bak adları okunmalı ve eylem anlaşılmalı.
Gerçek: Sabit dairelerde yalnız **N** ve **Ç** görünüyor. Dikey scroll kelimelerin
kalanını açmıyor. Tam accessibilityLabel kaynakta bulunsa da görsel kullanıcı
hangi seçeneğin ne yaptığını tahmin etmek zorunda. Devam et ana eylemi ayrı ve
erişilebilir; technique smoke geçti. Veri/progression kaybı gözlenmedi.
Muhtemel sahibi: `LegacyInterrupt` circleButton, maxWidth 116/aspectRatio 1
(satır 174–175/224), AppButton iç padding/indicator slot'ları ve native font
scaling birleşimi. Rehber seçenekleri için denetim durduruldu; kod değiştirilmedi.

### D-03 — Minor: maksimum metinde iki kolonlu trigger etiketleri parçalanıyor

Repro: N max → trigger seçimi. [05](qa/urge-control/phase11-8-2d/05-narrow-triggers-multiple-maximum.png).
Beklenen: Seçenek adı kelime olarak kolay taranabilmeli. Gerçek: Stres bile
Str/es; Can sıkıntısı birkaç çok kısa satıra bölünüyor. Kart/row ekranı
aşabiliyor. Seçimler, checked görünümü ve Save yine çalışıyor; inaccessible
action gözlenmedi. Bu bulgu yalnız yoğun scroll miktarı için verilmedi,
kelime parçalanmasının taramayı zorlaştırması içindir.
Muhtemel sahibi: triggerGrid/triggerChoice (satır 201/227–228) + AppButton
padding/indicator slot'ları. Geniş metinde tek kolon değerlendirmesi önerilir;
bu fazda uygulanmadı.

### D-04 — Minor: aşama değişiminde eski scroll konumu korunabiliyor

Repro: Max trigger ekranının altındaki Save → summary. Beklenen: Yeni aşamanın
başlığı/bağlamı ilk görünümde anlaşılmalı. Gerçek: summary alt bölümünden
başlanabiliyor, başlık için yukarı scroll gerekiyor. Başlık/final action
kaydırmayla erişilir; kilit veya veri sorunu yok. Mevcut AppScreen ScrollView
ve stage değişiminde scroll/focus yönetimi muhtemel sahibi. Yeni girişten
summary kontrolü ayrıca çalıştı. Kaynak veya navigation değişikliği yapılmadı.

Blocker bulunmadı. Ayrı Cosmetic bulgusu yok. Copy için bağlayıcı olmayan öneri:
production exit açıklamasındaki Urge Control/oturum yerine kullanıcıya dönük
Türkçe ad tercih edilebilir. Mevcut açıklama event'in korunacağını söylüyor;
bu öneri davranış kusuru değildir ve metin değiştirilmedi.

## Interaction, copy ve kontrast

Süre dolması dürtünün azaldığını iddia etmiyor; tamamlanan timer outcome'a
otomatik geçmedi. Erken değerlendirme yürütüldü. X → onay → Home, event'i
yeniden açma ve açık discard farklı. Optional nefes rehberi doğal nefese
dönülebileceğini ve süreyi bekleme zorunluluğu olmadığını söylüyor. Failure
aynı değişikliği yeniden kaydetmeyi öneriyor; gerçek retry düğmesi erişildi.

Kaynak renklerinden sRGB luminance hesabı (tam ekran uygunluk sertifikası
değil): beyaz/#3a4bff 5.78:1; prose #b9bdd0/#171925 9.36:1;
LCD #0c0f1e/en koyu LCD stop #8790b4 6.06:1;
beyaz/secondary #1b1c25 16.94:1. Önemli enabled metin/eylemler okunur;
disabled kontroller soluk ve disabled state ile eşleşir. Seçili duration
yalnız renk değil outline da kullanır. Trigger'ın native checked state'i var;
VoiceOver'da nasıl söylendiği doğrulanmadı.

## Screenshot kanıt seti

Yeni set **10 PNG**; 5,776,113 byte (~5.51 MiB). Normal ready/running/completed
yeniden yayımlanmadı; B galerisi korunur. D seti max typography ve yeni
bulgulara odaklanır. Hiçbir görüntü kırpılmadı/yeniden tasarlanmadı.

1. [Narrow ready maximum](qa/urge-control/phase11-8-2d/01-narrow-ready-maximum.png)
2. [Narrow paused actions maximum](qa/urge-control/phase11-8-2d/02-narrow-paused-actions-maximum.png)
3. [Narrow exit actions maximum](qa/urge-control/phase11-8-2d/03-narrow-exit-actions-maximum.png)
4. [Narrow outcome maximum](qa/urge-control/phase11-8-2d/04-narrow-outcome-maximum.png)
5. [Multiple selected triggers maximum](qa/urge-control/phase11-8-2d/05-narrow-triggers-multiple-maximum.png)
6. [Summary clipping — Major](qa/urge-control/phase11-8-2d/06-narrow-summary-maximum.png)
7. [Final action reachable](qa/urge-control/phase11-8-2d/07-narrow-complete-action-maximum.png)
8. [Legacy Continue reachable](qa/urge-control/phase11-8-2d/08-narrow-legacy-continue-maximum.png)
9. [Target error/retry maximum](qa/urge-control/phase11-8-2d/09-target-error-retry-maximum.png)
10. [Legacy guide label clipping — Major](qa/urge-control/phase11-8-2d/10-narrow-legacy-label-clipping-maximum.png)

Ham capture'lar, Maestro YAML/commands/hierarchy/logları `/tmp/bloom-D-*`
altında korunur. Kaynak/hash/byte manifesti yalnız
`/tmp/bloom-D-evidence-manifest.json` içindedir. Screenshot/test ID yalnız
görsel/touch kanıtıdır, gerçek screen-reader execution kanıtı değildir.

## Çalıştırılan testler ve gerçek başarısız denemeler

Maestro exit 0: target-normal (gerçek 5 dakika), narrow-setup,
narrow-exercise, narrow-summary, motion-settings, motion-on,
motion-off-recovery, error-maximum, legacy-maximum, motion-cycle-recovery ve
motion-cycle-off.

Üç ara Maestro akışı exit 1 olarak kaydedildi, gizlenmedi:

- narrow-downstream: stress kartına %100 visibility isteyen scrollUntilVisible
  başarısız. Çok büyük row/kart ekranı aşabiliyor; %30 visibility ile gerçek
  seçim ve Save geçti. D-03 ayrıca görsel olarak kaydedildi.
- narrow-downstream-recovery: Save sonrası yalnız DOWN araması Kayıt özeti'ni
  bulamadı. Üstte kalan başlık yeni girişten/yönlü scroll ile bulundu. D-04
  olarak kaydedildi; ardından summary'nin gerçek D-01 kusuru ayrıştırıldı.
- motion-cycle: beklenen cue yanlışlıkla Nefes ver yazılmıştı; gerçek mevcut
  etiket Yavaşça ver. Bekleme bu yüzden başarısız oldu. Üretim değişmedi;
  doğru label ile recovery/cycle-off exit 0, exhale → inhale gözlemi geçti.

Bu harness hataları production visual Fail'lerini gizlemek için Pass'e
dönüştürülmedi. Summary reachability smoke exit 0 olsa da content **Fail**.
Pillow ile isteğe bağlı pixel karşılaştırması ModuleNotFoundError verdi;
paket eklenmedi, repoda mevcut pngjs ile karşılaştırma yapıldı.

## Reduced Motion cihaz kanıtı

Settings → Accessibility → Motion → Reduce Motion gerçek switch'i CUA ile
0 → 1 → 0 değiştirildi. İlk production event mounted kaldı; Settings'e
geçişte background pause, foreground'da açık resume, paused iptal ve kullanılabilir
modal doğrulandı. Ayar açıkken LCD 09:56 → 09:55 ilerlerken atmosfer sabitti.

İlk iki capture Tut fazında olduğundan bu çifti tek başına motion kanıtı
saymadık. Faz değişimini ayrıca doğrulamak için target'ta yeni
`bloom.e2e.home.urgeD_motion_final.` namespace'i mevcut day10-credit → gerçek
Panic/Urge ile bir kez kuruldu. `Yavaşça ver` ve sonraki `Nefes al` gerçek
fazları beklenerek capture alındı. Sonra aynı mounted egzersiz background'da
paused iken gerçek ayar kapatıldı, foreground/resume ile aynı faz kontrolü
tekrarlandı. Timer veya nefes saati hızlandırılmadı.

Mevcut repo pngjs ile atmosferin sabit `[50,300,1150,600]` piksel bölgesi
karşılaştırıldı (LCD/metin/status bar dışı): ON exhale → inhale **0/330000**
piksel değişimi; OFF exhale → inhale **330000/330000** değişim. Bu ölçüm
motion'un native ayar değişince geri döndüğünü ayırır; sadece hold fazının
statik olmasına dayanmaz. Yerel ölçüm: `/tmp/bloom-D-motion-measurement.json`.
Pause/background/resume sırasında kontrolsüz hareket restart'ı gözlenmedi;
frame-by-frame tüm yaşam döngüsü/enerji profili ölçülmedi. Hook'un stale async
read/unmount ve tween cancellation vakaları mevcut executable suite'te geçti.

## Final verification, koruma ve karar

Aşağıdakiler exit 0:

- `npm run typecheck`
- `npm run verify:urge-integration`
- `npm run verify:urge-preview`
- `npm run verify:navigation`
- `npm run verify:release-debug-guards`
- `git diff --check`

Son npm logları `/tmp/bloom-D-final-*.log`, exit kodları
`/tmp/bloom-D-final-results.json`. Bu testlerin Pass olması iki gerçek görsel
Major kusurunu geçersiz kılmaz. Tüm rapor linkleri, 10 PNG ve yerel manifest
hash'leri doğrulandı. Yeni markdown trailing whitespace kontrolü ayrıca yapıldı.

İki cihazda final native değerleri large, light, Increase Contrast disabled,
ReduceMotionEnabled=0 olarak doğrulandı. Narrow başlangıçtaki shutdown durumuna
geri alındı; target booted kaldı. Test E2E process'i ve yalnız bu audit'in Metro
sunucusu kapatıldı. Namespace'ler/capture'lar silinmedi. Kullanıcı canonical
storage'ı temizlenmedi. Yeni legacy namespace yalnız narrow'da boşluk guard'ı
ile, C'nin mevcut synthetic fixture'ından serialize edildi; önceki current
summary event'i kendi namespace'inde tutuldu.

Git: HEAD/branch değişmedi; tracked diff ve staging boş. Yeni dosyalar yalnız
bu rapor ve `docs/qa/urge-control/phase11-8-2d/` içindeki 10 PNG'dir.
Başlangıçtaki 64 QA/patch girdisi ve 80 dosya hash'i değişmedi. Üretim UI,
typography, timer, navigation, controller, domain, storage ve persistence
dosyaları değiştirilmedi. Commit/push/merge yapılmadı.

**Öneri: CHANGES REQUESTED.** D-01 ve D-02 için ayrı hedefli düzeltme kararı
gerekir; dinamik iOS VoiceOver ayrıca Not Verified. Phase 11.8.2D tamamlandı
veya yayına hazır ilan edilmez. Bağımsız inceleme için durulur.


## D-01 / D-02 hedefli düzeltme sonrası — 2026-10-16

Bu bölüm yalnız iki Major bulgu için yeni düzeltme kanıtıdır. Yukarıdaki
orijinal audit, Fail bulguları ve 10 PNG aynen korunmuştur. Phase 11.8.2D
**tamamlandı ilan edilmez**; düzeltme bağımsız inceleme bekler. Branch
`feature/product-ui-v1`, HEAD `643d081d9bec3f6e2dca38207c492107a7a0e023`.
İlk preflight'ta tracked çalışma ağacı ve staging temizdi.

### Kök neden ve tam düzeltme

- **Major D-01:** İki büyüyen Text yatay `summaryRow` içinde kalıyor, outcome
  genişliği sınırlandırılmadığı için sağdan taşıyordu. Yerel `OutcomeSummary`,
  `useWindowDimensions().fontScale >= 1.35` olduğunda label/değeri dikey dizer.
  Değer `flexShrink: 1, minWidth: 0` ile doğal wrap yapabilir. Normal metinde
  yatay row korunur. Current/legacy aynı bileşeni ve aynı dört outcome
  eşlemesini kullanır; label veya completion eylemi değişmedi.
- **Major D-02:** Legacy düğmelerin `maxWidth: 116`, `aspectRatio: 1` ve yatay
  yerleşimi büyük yazıyı padding/indicator alanları arasında sıkıştırıyordu.
  Yalnız `LegacyInterrupt` büyük yazıda seçenekleri dikey dizer ve daire
  stilini kaldırarak mevcut AppButton'ın tam genişlik/doğal yüksekliğini
  kullanır. Normal boyutta daireler korunur. Tam etiketler, accessibilityLabel,
  yerel touched seçimi, testID, `onComplete` ve `disabled={locked}` aynıdır.

1.35 eşiği mevcut exercise responsive düzeniyle tutarlıdır. Font scaling,
typography token'ları ve metinler korunur; ellipsis, fixed text height,
`numberOfLines`, maxFontSizeMultiplier veya font küçültme eklenmedi.

### Önce / sonra

| Bulgu | Önce — orijinal kanıt | Sonra — gerçek Simulator capture |
| --- | --- | --- |
| D-01 dar cihaz / current | [Kırpılmış Daha güçlü](qa/urge-control/phase11-8-2d/06-narrow-summary-maximum.png) | [Tam Daha güçlü](qa/urge-control/phase11-8-2d/dynamic-type-fix/summary-narrow-maximum.png) |
| D-02 dar cihaz / legacy | [N ve Ç](qa/urge-control/phase11-8-2d/10-narrow-legacy-label-clipping-maximum.png) | [Tam iki etiket](qa/urge-control/phase11-8-2d/dynamic-type-fix/legacy-labels-narrow-maximum.png) |
| Legacy summary / dar cihaz | Orijinal D-01 ortak summary yerleşimi | [Tam Hâlâ güçlü](qa/urge-control/phase11-8-2d/dynamic-type-fix/narrow-legacy-summary-maximum.png) |
| Current summary / target | Aynı responsive düzeltme | [Tam Daha güçlü](qa/urge-control/phase11-8-2d/dynamic-type-fix/target-current-summary-maximum.png) |
| Legacy interrupt / target | Aynı responsive düzeltme | [Tam iki etiket](qa/urge-control/phase11-8-2d/dynamic-type-fix/target-legacy-labels-maximum.png) |
| Legacy summary / target | Aynı responsive düzeltme | [Tam Hâlâ güçlü](qa/urge-control/phase11-8-2d/dynamic-type-fix/target-legacy-summary-maximum.png) |

Normal ve CTA kanıtları dahil [10 yeni PNG'nin tam listesi](phase11-8-2d-dynamic-type-fix.md)
ayrı `dynamic-type-fix/` alt dizinindedir; toplam **1,769,530 byte**.
Capture'lar değiştirilmedi/kırpılmadı. Kaynak/byte/SHA256 manifesti:
`/tmp/bloom-D-fix-evidence-manifest.json`.

### İki cihazda gerçek UI matrisi

iOS 26.3 disposable `com.umutcyilmaz.bloom.e2e` kullanıldı. iPhone 17 Pro
(iPhone18,1) **402×874 pt @3×**, UDID
`3C8CE983-39F5-41A0-B781-2AACDBCD1273`; iPhone 13 mini (iPhone14,4)
**375×812 pt @3×**, UDID `890ADA65-17D8-4EEC-AFDE-853AEE570448`.
Normal `large` native fontScale **1**; maksimum
`accessibility-extra-extra-extra-large` native fontScale **3.571**.
Light appearance / Increase Contrast disabled / Reduce Motion disabled;
preview kapalı. Maksimum koşullar yeni process ile de doğrulandı.

| Gerçek ekran / etkileşim | 13 mini normal | 13 mini maksimum | 17 Pro normal | 17 Pro maksimum |
| --- | --- | --- | --- | --- |
| Current summary — Daha güçlü | Pass | Pass | Pass | Pass |
| Legacy summary — Hâlâ güçlü | Pass | Pass | Pass | Pass |
| Legacy iki tam etiket; her ikisine dokunma | Pass | Pass | Pass | Pass |
| Summary boyunca scroll, final CTA görünür/erişilir | Pass | Pass | Pass | Pass |

Normalde yatay summary ve daire geometrisi, maksimumda dikey summary ve tam
genişlik düğmeler görüldü. Bu hedefli ekranlarda yatay clipping, label
truncation, yatay scroll veya örtüşme gözlenmedi. Büyük metinde legacy
**Devam et → technique** gerçek dokunuşla iki cihazda geçti; mevcut teknik /
phone-away / outcome / trigger eylemleriyle legacy summary'ye ulaşıldı.
Son Home’a dön CTA'sına kadar kaydırıldı; kanıt event'lerini korumak için bu
summary koşularında final completion basılmadı.

17 Pro normal current akışta 10:00 ready, start, pause, X, modal cancel,
paused'a dönüş ve mevcut evaluate → outcome → summary yolu da geçti.
Current native exercise adapter'ı değişmedi. Bu smoke kontrolü tam timer /
VoiceOver yeniden-auditi değildir.

### Test yöntemi ve sınırlamalar

Current dar cihazda önceki `urgeD_20261015_final` summary event'i reseed
edilmeden okundu. Legacy için yalnız boşluğu doğrulanan yeni
`urgeD_fix_legacy_20261015` ve `urgeD_fix_target_legacy_20261015` synthetic
namespace'leri, mevcut C `initial(false)` fixture'ı ve gerçek serializer ile
kuruldu. Target current `urgeD_fix_target_current_20261015`, mevcut day10 QA
ve gerçek Panic girişinden oluşturuldu. Canonical kullanıcı storage'ı,
önceki namespace'ler ve screenshot'lar temizlenmedi/üzerine yazılmadı.
Legacy progression aynı `urge-feature` kimliği/start ile ACK edildi;
flowVersion 2'ye çevrilmedi, records boş kaldı.

Ham YAML/log/capture'lar `/tmp/bloom-D-fix-*` altındadır. Target maksimum
legacy progression'ın ilk koşusunda kısmen görünür tetikleyici dokunuşu ACK
olmadı; sonra tam görünür dokunuşla kayıt ilerledi. Ara iki deneme uygulama
foreground/Home resume başlangıcı eksik olduğu için, bir sonraki assertion
ise summary aşağıdayken UP aradığı için başarısız oldu. Son doğrulama
foreground → Home resume → doğru scroll yönü ile geçti; bu başarısız
koşular saklandı ve Pass sayılmadı. Üretim kodu bunları geçirmek için
ayrıca değiştirilmedi.

Mevcut executable screen harness'ine canlı font değişimi, yerel selection
korunması, normal horizontal/büyük font column, fixed circle sınırlarının
kaldırılması ve current/legacy dört outcome'un tamamı eklendi. Mevcut
locked CTA, action, persistence ACK/retry ve birleşik navigation guard
vakaları korunur. JSX vakaları native piksel veya VoiceOver testi sayılmaz.
İlk yeni assertion ancestor View seçtiği için düzeltildi; üretim düzeltmesi
bunun için değiştirilmedi.

Aşağıdaki sekiz npm kontrolü exit **0**:

- `npm run typecheck`
- `npm run verify:urge-integration`
- `npm run verify:urge-preview`
- `npm run verify:navigation`
- `npm run verify:persistence`
- `npm run verify:persistence-acknowledgement`
- `npm run verify:guided-flows`
- `npm run verify:release-debug-guards`

Sonuçlar `/tmp/bloom-D-fix-full-results.json`; loglar
`/tmp/bloom-D-fix-full-*.log`. `git diff --check` ve yeni Markdown/link/hash
kontrolleri ayrıca geçer.

**Kalan bulgular:** Minor D-03 trigger-label word breaking ve Minor D-04
canonical stage değişiminde scroll-position retention bu kapsamda
çözülmedi. Gerçek **VoiceOver Not Verified**; eski Simulator kısıtı sürer.
Yeni bir Major/blocker doğrulanmadı. Bu sonuç bütün accessibility alanları
veya Phase 11.8.2D için tam Pass anlamına gelmez.

### Kapsam, koruma ve inceleme kararı

Tracked diff yalnız `UrgeControlResumeScreen.tsx` ve odaklı
`verify-bloom-urge-control-feature.ts`: **66 ekleme / 12 silme**.
Bu mevcut untracked audit'e yalnız ek bölüm yazıldı; ayrı düzeltme notu ve
10 yeni PNG eklendi. Orijinal audit'in önceki metni ve 10 orijinal PNG
korundu. Başlangıçtaki 64 QA/patch girdisinin 80 dosya hash'i aynıdır.

Shared AppButton/AppText, global typography, UrgeExercise/visuals/timer,
controller, navigation guard, domain, storage/persistence, migrations,
Panic/Slip/Practice kodları değişmedi. Current interrupt adapter branch'i
HEAD ile aynıdır. Staging boş; branch/HEAD aynı; commit/push/merge yok.
Cihaz metin ayarları başlangıç `large` değerine döndürüldü; narrow başlangıç
shutdown durumunda bırakıldı. Bu işin E2E process'i/Metro'su kapatıldı.
Yerel fixture/QA/capture dosyaları silinmez.

**Karar: D-01/D-02 hedefli düzeltmesi bağımsız incelemeye hazır adaydır.**
Phase 11.8.2D tamamlandı veya yayına hazır ilan edilmez; başka faz başlatılmaz.
