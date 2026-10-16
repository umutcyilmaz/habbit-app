# Phase 11.8.2D — D-01 / D-02 targeted Dynamic Type fix

Base/HEAD: `643d081d9bec3f6e2dca38207c492107a7a0e023`, branch
`feature/product-ui-v1`. Yalnız iki Major düzeltmesi için inceleme adayıdır.
Phase 11.8.2D tamamlandı ilan edilmez; commit/push/merge yapılmadı.

## Başlangıç ve korunmuş kanıt

Branch/HEAD doğrulandı; tracked çalışma ağacı ve staging başlangıçta temizdi.
64 mevcut yerel QA/patch girdisinin 80 dosya hash'i doğrulandı. Orijinal
[D audit belgesinin](phase11-8-2d-final-qa.md) orijinal metni birebir başlangıç metni olarak
korundu; sonuna yeni hedefli düzeltme bölümü eklendi. 10 orijinal screenshot
byte-byte korundu; tarihsel Fail sonuçları üzerine yazılmadı. Başlangıç manifesti:
`/tmp/bloom-D-fix-baseline.json`.

İncelenen önceki hatalar:
[D-01](qa/urge-control/phase11-8-2d/06-narrow-summary-maximum.png),
[D-02](qa/urge-control/phase11-8-2d/10-narrow-legacy-label-clipping-maximum.png).
AppButton, AppText, typography/spacing token'ları ve mevcut screen harness'i
okundu. Paylaşılan component veya token değişikliği gerekmedi.

## Kök neden ve yerel düzeltme

**D-01:** Summary'nin iki büyüyen Text'i yatay row'da kalıyor; sonuç değerine
daralma alanı verilmediği için metin sağ ekran kenarını aşıyordu. Yerel
`OutcomeSummary`, native `fontScale >= 1.35` olduğunda label/değeri dikey
yerleştirir. Değer doğal wrap için `flexShrink: 1, minWidth: 0` alır. Normal
metinde mevcut row kalır. Current/legacy aynı summary parçasını kullanır;
outcome label eşlemesi ve mevcut completion eylemi değişmedi.

**D-02:** Legacy circleButton'ın maxWidth 116/aspectRatio 1 sınırları ile
AppButton'ın padding/indicator slot'ları büyük metni ilk harfe kadar sıkıştırıyordu.
Yalnız LegacyInterrupt'ta `fontScale >= 1.35` için seçenekler dikey ve standart
AppButton'ın tam genişlik / içerikle büyüyen yüksekliğini kullanır. Sabit daire
stili bu dalda uygulanmaz. Normal metinde önceki daire geometrisi korunur.
Yerel touched seçimi, aynı event key'i, test ID'leri, accessibility label'ları,
Devam et `disabled={locked}` ve mevcut `onComplete` yolu korunur.

Eşik mevcut exercise'in büyük metin yerleşiminde kullandığı 1.35 ile tutarlı,
ancak exercise koduna bağlantı/refactor eklenmedi. Font küçültme, scaling
kapatma, maxFontSizeMultiplier, numberOfLines/ellipsis veya ölçüm framework'ü
eklenmedi. Global AppButton/AppText davranışı değiştirilmedi.

## Cihaz doğrulaması

Tam iki cihaz × iki metin boyutu sonuçları ve gerçek etkileşim matrisi
[güncellenen audit ek bölümündedir](phase11-8-2d-final-qa.md#d-01--d-02-hedefli-düzeltme-sonrası--2026-10-16).

Mevcut **Bloom Practice Typography QA Narrow**, iPhone 13 mini / iPhone14,4,
UDID `890ADA65-17D8-4EEC-AFDE-853AEE570448`, iOS 26.3, portrait,
375×812 pt @3×. Normal `large` / fontScale 1; maksimum
`accessibility-extra-extra-extra-large` / native fontScale **3.571**.
Target **iPhone 17 Pro / iPhone18,1**, UDID
`3C8CE983-39F5-41A0-B781-2AACDBCD1273`, iOS 26.3, 402×874 pt @3×
aynı normal/maksimum native fontScale değerleriyle tekrarlandı.
Light appearance, Increase Contrast disabled, Reduce Motion disabled.
Preview kapalı; disposable `com.umutcyilmaz.bloom.e2e` + mevcut Phase10 QA
namespacing kullanıldı. Canonical kullanıcı storage'ı temizlenmedi.

| Senaryo | Sonuç | Gerçek kanıt / sınır |
| --- | --- | --- |
| D-01 maksimum, aynı persisted current summary event'i | Pass | Şu an ve Daha güçlü ayrı satırlarda, değer bütünüyle okunur; clipping yok |
| Summary final action maksimum | Pass | Home’a dön tam görünür ve scroll ile erişilir; bu test event'i tamamlamadı |
| Summary normal | Pass | Önceki yatay label/değer görünümü ve final action korunur |
| D-02 normal | Pass | Daireler ve tüm harfler görünür; önceki kelime bölünmesi bu kapsamda değiştirilmedi |
| D-02 maksimum, mounted font değişimi | Pass | İki tam etiket, doğal yükseklik; önceki yerel seçim korunur |
| D-02 maksimum, yeni process ile tekrar | Pass | Büyük prose/diğer metinlerle aynı cold-mounted koşulda iki etiket de tam okunur |
| Legacy Devam et maksimum | Pass | Görünür; gerçek eylem sonrası ACK edilmiş technique ekranına geçildi |
| Current/legacy dört outcome label'ı, normal/max | Pass (executable render) | Gerçek TSX, 4 semantic değer, iki sürüm; bu kısım native pixel layout testi değildir |
| Locked CTA / no domain facts / retry/navigation | Pass (mevcut executable tests) | Mevcut screen/controller/runtime/guard vakaları geçer; davranış değiştirilmedi |
| İki cihazda legacy summary normal/max | Pass | Tam Hâlâ güçlü; final CTA scroll ile erişilir |
| Target current summary normal/max | Pass | Tam Daha güçlü; normal row / maksimum column |
| Target legacy düğmeler normal/max | Pass | İki tam label, her ikisine gerçek dokunuş; maksimumda Continue → technique |
| Gerçek VoiceOver | Not Verified | Önceki Simulator kısıtı geçerli; kaynak/test ID, gerçek VO Pass sayılmadı |

Summary için önceki `urgeD_20261015_final` namespace'inin aynı current
readyToComplete event'i okundu; reseed veya completion yapılmadı.
Legacy için yeni ve boş olduğu doğrulanan
`bloom.e2e.home.urgeD_fix_legacy_20261015.` namespace'ine mevcut C
`initial(false)` synthetic fixture'ı gerçek serialization ile yazıldı.

Yerel attention basışları sonrası kalıcı legacy event yalnız id/status/startedAt
içeriyordu: `urge-feature`, `2026-11-01T12:00:00.000Z`, active; records boş.
Devam et sonrası aynı ID/start ile yalnız mevcut interruptCompletedAt alanı
ACK edilerek oluştu; flowVersion 2 eklenmedi. Technique ekranda görüldü.
Eski QA event'leri veya eski kanıt görüntüleri üzerine yazılmadı.

Maestro current/legacy summary ve legacy düğme koşulları iki cihazın normal
ve maksimum boyutlarında tekrarlandı. Dar cihaz ve target'ta maksimum
Devam et → technique ve mevcut downstream progression gerçek eylemlerle geçti.
Target normal current 10:00 ready/start/pause/X/modal cancel/evaluate de geçti.
Ham YAML/log/capture'lar `/tmp/bloom-D-fix-*` altında; başarılı son Target
legacy summary koşuları `target-legacy-summary-max` ve
`target-legacy-summary-normal` altındadır. Ara harness başarısızlıkları
[ana audit'te](phase11-8-2d-final-qa.md) ayrı kaydedildi; Pass sayılmadı.
Yeni process kontrolünde storage temizlenmedi. Final summary CTA'sına
kaydırıldı, evidence event'lerini tamamlamamak için CTA basılmadı.

## Yeni görüntüler

Yeni görüntüler ayrı alt dizinde; orijinal 10 PNG korunur:

- [Summary maximum](qa/urge-control/phase11-8-2d/dynamic-type-fix/summary-narrow-maximum.png)
- [Summary final action maximum](qa/urge-control/phase11-8-2d/dynamic-type-fix/summary-final-action-narrow-maximum.png)
- [Summary normal](qa/urge-control/phase11-8-2d/dynamic-type-fix/summary-narrow-normal.png)
- [Legacy normal](qa/urge-control/phase11-8-2d/dynamic-type-fix/legacy-narrow-normal.png)
- [Legacy full labels maximum — cold-mounted](qa/urge-control/phase11-8-2d/dynamic-type-fix/legacy-labels-narrow-maximum.png)
- [Legacy Continue maximum](qa/urge-control/phase11-8-2d/dynamic-type-fix/legacy-continue-narrow-maximum.png)
- [Narrow legacy summary maximum](qa/urge-control/phase11-8-2d/dynamic-type-fix/narrow-legacy-summary-maximum.png)
- [Target current summary maximum](qa/urge-control/phase11-8-2d/dynamic-type-fix/target-current-summary-maximum.png)
- [Target legacy labels maximum](qa/urge-control/phase11-8-2d/dynamic-type-fix/target-legacy-labels-maximum.png)
- [Target legacy summary maximum](qa/urge-control/phase11-8-2d/dynamic-type-fix/target-legacy-summary-maximum.png)

10 PNG, toplam 1,769,530 byte. Kaynak/hash manifesti yalnız
`/tmp/bloom-D-fix-evidence-manifest.json` altında. Görüntüler kırpılmadı veya
yeniden tasarlanmadı.

## Otomatik kontroller ve kapsam sınırı

Aşağıdakilerin tamamı exit 0:

- `npm run typecheck`
- `npm run verify:urge-integration`
- `npm run verify:urge-preview`
- `npm run verify:navigation`
- `npm run verify:release-debug-guards`
- `npm run verify:persistence`
- `npm run verify:persistence-acknowledgement`
- `npm run verify:guided-flows`
- `git diff --check`

Yeni render vakası canlı font değişiminde yerel selection/label korunmasını,
büyük metinde fixed legacy bounds kaldırılmasını, normal daire geometrisini
ve current/legacy dört outcome label'ını sınar. Gerçek piksel fit'inin yerine
geçmez; yukarıdaki Simulator karşılaştırması bunu tamamlar. Mevcut testler
silinmedi/zayıflatılmadı. İlk yeni assertion summary'nin ancestor View'ını
seçtiği için bir kez başarısız oldu; doğrudan çocukları arayan selector ile
düzeltildi. Bunun için üretim düzeltmesi değiştirilmedi. Son sekiz npm komutunun
exit kodları `/tmp/bloom-D-fix-full-results.json`, loglar
`/tmp/bloom-D-fix-full-*.log` altındadır.

Tracked değişiklikler yalnız:

1. `src/features/urge-control/screens/UrgeControlResumeScreen.tsx`
2. `scripts/verify-bloom-urge-control-feature.ts`

Bu not ve 10 yeni screenshot ek kanıttır. Orijinal D audit metni
korunarak sonuna düzeltme bölümü eklendi; 10 orijinal screenshot değişmedi.
Shared components/tokens, UrgeExercise ve preview,
timer, controller, navigation guards, domain, schema/migrations, storage ve
persistence kodları HEAD ile aynı. Current interrupt adapter branch'i aynı.
D-03 trigger yerleşimi, D-04 scroll davranışı ve copy önerisi değiştirilmedi.

**İnceleme sonucu:** D-01/D-02 için hedefli düzeltme adayları iki cihazın normal
ve maksimum metin koşullarında doğrulandı. Bu, Phase 11.8.2D tamamlandı veya
yayına hazır onayı değildir. Commit/push/merge yok; staging boş bırakılır.
