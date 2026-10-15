# Phase 11.7.2 — Practice persistence QA

Baseline: `45523f688a123185f3b5504b9eb242ed7d192ad2`. Commit/push yok.

## Uygulama öncesi teknik plan

- Bağımsız `practice: { introduction: { version: 1, acknowledgedAt } | null, sessions: CompletedPracticeSession[] }` alanı. Oturum: `id`, `version: 1`, `source: guided_practice`, `startedAt`, ilk kaydetmede sabitlenen `completedAt`, `timezone: { name, utcOffsetMinutes }`, `foregroundExerciseMs`, `activeMs`, `intentionalPauseMs`, `pauses: { startMs, endMs }[]`, `arousalReports: { atMs, reportedAt, level }[]`, `erectionQuality`, `explicitContent`, `ending`, `feelings`. İlk üç yanıt atlanınca null; seçilmeyen hisler boş dizi. Taslak kalıcı değil.
- Tamamlanan aralıklar ve beyanlar egzersizin yalnız ön planda ilerleyen zaman ekseninde. Toplam aktif + kasıtlı duraklama; arka plan, kilit, çıkış onayı, tanıtım ve sorular hariç. Animasyon kayda girmez. Başlangıç duvar saati açık başlatmada, tamamlanma duvar saati ilk açık kaydetmede sabitlenir; soruların süresi egzersiz metriğine eklenmez.
- `bloom.localState.v9`: v8 doğrulaması eski tüm dilimleri aynen korur, yalnız yeni Practice varsayılanını ekler. v8 ham anahtarı byte düzeyinde korunur; v7 kurtarma kopyası da korunur. v9 varsa bozuk/gelecek sürüm durumunda eski anahtara dönülmez. Mevcut coordinator sırası, generation ve silme bariyerleri korunur; toplu silme v9 ve eski anahtarları kapsar.
- Reset uygunluğu tek saf selector: doğrulanmamış/hydration bekleyen durum kapalı; canonical `baseline_pending`/`active` kapalı (süre dolsa bile), zorunlu tamamlanma kararı bekliyorsa kapalı. Home, Library, doğrudan route, start ve save komutu güncel durable durumu denetler. Geçmiş Reset sırasında okunabilir.
- Tanıtım açık Başlat onayından sonra acknowledged action ile kaydolur. Kaydetmede tek immutable payload/ID oluşturulur; synchronous busy kilidi ikinci komutu engeller. Kabul edilmiş belirsiz kayıtta yalnız aynı retry token; superseded durumunda güncel persistence doğrulanır ve gerçek durable payload eşitliği kontrol edilir. Silme/invalidated receipt kayıt başarı iddiasına dönüşmez. Unmount sonrası geç cevap navigasyon yapmaz.
- Onaylanan native ekran ve geçici runtime ortak kullanılır; QA önizlemesi kayıt işlemi alamaz. Production Home/Library girişi ve durable geçmiş ayrı Practice route'ları; dört tab korunur. Açık içerik yalnız Practice beyanıdır, Tracking/Content-Free/Reset değişmez.
- Native QA yeni guard'lı E2E depolama ad alanında; gerçek ve mevcut QA anahtarları başlangıç/son hashleri karşılaştırılır. v8 fixture migration testleri payload dilimlerini ve kimlikleri karşılaştırır. Tüm sonuçlar ve eksikler aşağıda kaydedilecek.

## Sonuçlar

Uygulama tamamlandı; yayın yapılmadı. `feature/product-ui-v1` ve HEAD `45523f688a123185f3b5504b9eb242ed7d192ad2` korundu. Dört tab aynı. Bağımsız production yolları `/bloom/practice` ve `/bloom/practice/history`; 11.7.1 debug önizlemesi kök provider düzeyinde yalnız process-memory kullanıyor; device save ACK yeteneği yok, production Practice/history yolları bu modda preview’a döner.

### Kod ve veri denetimi

- Runtime `practiceSession.ts` değiştirilmedi. Shared ekran production action alabilir; timer/cleanup/üç soru/duraklama mantığı aynı. Legacy Arousal UI mount edilmedi, record dönüşümü yok.
- `PracticeState`, strict schema, saf transitions, tek uygunluk selector, immutable persistence controller ve durable history eklendi. Yeni version/key: **9 / `bloom.localState.v9`**.
- Provider yalnız Practice için anlık runtime hydration/silme/accepted-durable kontrolü ve read-only `getPracticeAvailability` ekler. React render’ı eski kalsa bile Start ve Save kilidi geçilemez; beginHydration/deletion-before-render segmentleri bunu doğrular. Coordinator'ın sıra/generation/barrier mantığı aynı. v8 + v7 ham kurtarma kaynakları korunur; toplu silme tüm sürümleri kapsar.
- Reset active, elapsed-completion pending, baseline pending ve gereken continuation kararı pending durumlarında giriş kapalı. History açık. Ordinary Tracking kapalıyken Practice açık. Normal Home/Library/reader girişleri ayrı Practice route'u kullanır.
- Tanıtım yalnız açık Başlat onayıyla yazılır. Pozitif farklı sürüm tutulur ve güncel tanıtım tekrar gösterilir. Yönergeleri tekrar okumak kaydı değiştirmez.
- İlk Save ID/payload/timestamp'ı sabitler; çift çağrı aynı işlem. Accepted belirsizlikte exact token retry; superseded'da current persistence confirmation + ID/payload eşitliği. Deletion veya unmount eski egzersizi/kimliği diriltmez. Saved etiketi ancak başarılı current durable onayla görünür. Stale Exit/Edit/Save callback’leri current runtime ve payload kilidini okur; reddedilmiş level input üretim raporuna eklenmez.
- Önceki tipografi değerlendirmesi geri çekildi: kısa history/CTA metinleri ve yalnız fontScale remount yeterli değildi. Güncel feature-local tipografi, tam etiketler ve tek kaydırma akışı aşağıdaki kök neden ekinde açıklanır. Shared AppText scaling açık kalır.

[Veri sözleşmesi, süre tanımları, timezone politikası, göç/rollback ve sonraki ürün kararları](phase11-7-2-practice-data-contract.md).

### Otomatik doğrulama

Önceki Phase 11.7.2 uygulama doğrulamasında 22 komut geçti (bu tipografi görevinin son kaynakla yeniden çalıştırdığı 10 kontrol aşağıda ayrıca listelenir): `typecheck`; `verify:practice`; `verify:practice:persistence`; `verify:persistence`; `verify:persistence-acknowledgement`; `verify:reset-continuity`; `verify:home-ui`; `verify:navigation`; `verify:library`; `verify:kegel:persistence`; `verify:product-onboarding-ui`; `verify:journey`; `verify:protection-reset`; `verify:guided-flows`; `verify:counter-history`; `verify:profile`; `verify:settings`; `verify:kegel`; `verify:audio`; `verify:e2e-runtime`; `verify:e2e-app-identity`; `verify:release-debug-guards`.

`verify:persistence` içindeki Tracking/Content-Free/Reset/urge/onboarding ve 39 acknowledged action regresyonları da geçti. Eski testlerin yalnız current version/key/envelope, legacy anahtar listesi, iki yeni action ve iki yeni route beklentileri güncellendi; legacy göç fixture sürümleri korunur. Strict Practice malformed-history testleri tek kaydı sessiz atmaya izin vermiyor. 108 QA guard kombinasyonu, invalid run fail-closed, namespace sınırı ve deletion sonrası yeniden seed etmeme doğrulandı.

UI/motion testleri gerçek ekran handler'larını kontrollü hook/clock/AppState ile çalıştırır; tam native renderer veya OS Reduced Motion testi diye sunulmaz. Test logları `docs/qa/practice-persistence/verify-*.log`.

### Simulator matrisi

Cihaz: iPhone 17 Pro / iOS 26.3, `com.umutcyilmaz.bloom.e2e`. Yeni run: `practice1172_20261014_8f71`; her fixture ayrı `bloom.e2e.practice.<run>.<fixture>.` alanında. clearState/app uninstall/gerçek veya önceki QA alanı seed/reset yapılmadı. Normal `large`, en büyük `accessibility-extra-extra-extra-large`; sonunda normal ayar geri yüklendi, uygulama ve görev Metro'su durduruldu.

“E2E” aşağıdaki akışın cihazda yürütüldüğünü, “segment” ilgili sözleşmenin ayrı native veya kontrollü runtime adımlarında doğrulandığını belirtir.

| # | Senaryo | Sonuç / kapsam |
|---|---|---|
| 1 | Fresh v8 → v9 | E2E tanıtım → egzersiz → durable kayıt; ham v8 korunmuş. Ayrıca empty migration saf testte tüm eski alanlarla eşit. |
| 2 | Populated v8 → v9 | E2E; 6 Tracking, Kegel, legacy Arousal/Pause ve diğer bütün eski alanlar semantik olarak aynı; v8 bytes aynı. |
| 3 | İlk tanıtım | E2E explicit confirmation → ack → start. Başarısız intro + exact retry ve incompatible-version davranışı runtime segmentinde. |
| 4 | Tam pratik → 3 soru → Save | E2E level 7 → pause/resume → quality 8 → explicit content yes → stopped + Sakin → saved → history. |
| 5 | Soruları atlama | E2E ikinci egzersiz; üç cevap null; failure/retry sonrası history aynı ID. |
| 6 | Mid-session exit / restart | E2E abandon count değiştirmedi; genuine stopApp/launchApp sonrası yeni empty temporary runtime, otomatik timer/kayıt yok. |
| 7 | Background / pause accounting | Native pause → Home → resume → abandon geçti. Exact ms background/exit/reflection dışlama ve pause toplamları runtime segmentlerinde; fiziksel kilit ekranı ölçümü yapılmadı. |
| 8 | Duplicate Save | Kontrollü actual UI handler + controller segmenti: synchronous double taps, tek promise/ID/write; cached success tekrar yazmaz. Native rapid-tap stres koşusu diye sunulmaz. |
| 9 | Failed Save → exact retry | E2E one-shot before-write fault, unsaved/recovery, exact retry, tek durable kayıt. After-write/timeout/late ack/superseded/concurrent/deletion ayrıca runtime segmentleri. |
| 10 | Reset active entry blocked | E2E Home/Library/direct route; timer/intro/save başlamadı; whole state aynı. |
| 11 | Reset completion pending | E2E elapsed canonical active, baseline pending ve completed-required-choice pending; aynı blok ve history erişimi. |
| 12 | Reset sırasında history | E2E dört Reset fixture'ında durable history açık; sentetik fixture kayıtları değişmedi. |
| 13 | Tracking disabled, Practice açık | Fresh E2E iki gerçek QA egzersizi kaydetti; Tracking disabled/null/empty kaldı. |
| 14 | Explicit content CF'yi değiştirmez | Populated E2E yes kaydı; Content-Free/Reset/Tracking/legacy dahil tüm non-Practice alanlar v8 ile aynı. |
| 15 | Önceki normal / largest text koşusu | Akış yürütüldü; önceki largest görsel geçiş değerlendirmesi geçersizdir. Eski kareler hata geçmişi olarak korunur; güncel iki cihaz × üç kategori denetimi aşağıdaki ekte ve yeni galeridedir. |
| 16 | Whole-app delete / rehydrate | E2E Settings accessible confirmation; v9 ve retained v8 silindi, yeniden açılışta history boş; yalnız fixture sentinel kaldı, yeniden seed yok. |
| 17 | Corrupt / unsupported storage | E2E error boundary + restart; ham bozuk/future v9 aynı. Eski v8 varken fallback yapmama ayrıca storage segmentinde doğrulandı. |
| 18 | Legacy kayıtları koruma | Populated E2E tüm non-Practice state ve IDs aynı. Eski gerçek/QA payload hashleri ve anahtar değerleri aşağıdaki denetimde korundu. |

Sekiz fixture batch koşusunun tamamı exit 0. Son production Start → manuel level 5 → skip → Save → history akışı da canlı runtime guard ile exit 0. Process-memory preview → tamamla → restart → direct production/history route redirect testi exit 0; gerçek/QA anahtarlarına erişmeden geçici pratik sıfırlandı. Tam akış, lifecycle, deletion, available entry ve largest history ayrı Maestro koşuları exit 0. Maestro child-button merkezleme yanlış-negatifi gerçek erişilebilirlik hierarchy ile denetlendi; kartı kaydırıp gerçek düğmeye basan final akış geçti. İlk screenshot otomasyon sonuçlarına rağmen history font ölçüsü/gövde clipping görsel incelemede yakalandı; bu eski kareler korunur ancak güncel typography görsel onayı yerine kullanılamaz. Başlangıç guard'ındaki fixture adında rakam eksik regex de native başlamadan düzeltildi; guard testleri tüm izin kombinasyonlarını kapsar.

Kanıtlar: [native migration evidence](qa/practice-persistence/native-migration-evidence.json), [deletion evidence](qa/practice-persistence/native-deletion-evidence.json), `native-*.log`. Sentetik kayıtlar yalnız yeni QA namespace'lerinde; production empty history'ye örnek eklenmez.

### Mevcut veri koruması ve Metro olayı

**İzole QA başlamadan önce açık kalan önceki Metro otomatik refresh yaptı ve canonical E2E alana bir `bloom.localState.v9` göç kopyası ekledi.** Bu sürecin uygulama öncesinde kapatılması gerekirdi. Eski payload'lar yazılmadı/silinmedi; raw v8 ile yeni v9'in bütün non-Practice alanları aynı ve eklenen Practice `{ introduction: null, sessions: [] }`. Bu kopya silinmedi; mevcut veriyi korumak için tutuldu. Tekrarını önlemek üzere visual-preview root runtime artık yalnız bellekte; cihaz save ACK’i vermez ve production Practice yolları preview’a yönlendirilir. [Olay denetimi](qa/practice-persistence/metro-refresh-migration-audit.json).

Önceki onaylı QA envanterindeki 21 payload dosyasının hashleri değişmedi (manifest yalnız yeni key eklenmesiyle değişti). Sonrasında baselined edilen **29 anahtarın tamamı** değer hashleriyle birebir korundu; testlerden gelen **18 yeni anahtarın tamamı** yalnız bu fazın ad alanında. Silme de yalnız o ad alanını etkiledi. Bu nedenle “hiç canonical key eklenmedi” iddiası yapılmaz. [Anahtar bazlı son karşılaştırma](qa/practice-persistence/storage-preservation.json), `storage-before.json` / `storage-after.json`.

### Galeri, patch ve inceleme sınırları

[Seçilmiş tarihsel HTML/native kanıtları](qa/practice-persistence/index.html); [güncel normal/orta/maksimum karşılaştırma](qa/practice-typography/index.html), [PNG ölçü/hashleri](qa/practice-persistence/screenshot-hashes.json). Source HTML kareleri tasarım örneğidir; Native tam akış süreleri actual QA exercise, Reset/eski tarihçe synthetic fixtures. PNG pikselleri değiştirilmedi. 11.7.1 galerisi ve mevcut QA dosyaları korunur.

HTML'nin otomatik kayıt ve örnek karşılaştırmaları alınmadı: açık Save, truthful recovery ve real durable history kullanılır. Native Inter ve önceki onaylı görsel bileşenler korunur. Önceki largest tipografi sonucu bu görevde yeniden denetlendi; güncel sonuçlar aşağıdaki ekte. Manual VoiceOver kullanıcı testi, cihazdaki gerçek OS Reduced Motion anahtarı ve fiziksel lock-screen testi yapılmadı; bu sınırlamalar otomasyon sonucu olarak gizlenmez. Klinik süre/başarı puanı ve otomatik CF reconciliation yok.

Önceki text-only patch yerel arşiv olarak korunur: `docs/patches/phase11-7-2-practice-persistence-text-only.patch`. Güncel güvenilirlik/yayın incelemesi aşağıda. Tam önerilen Git dosya listesi: `docs/qa/practice-persistence/review-files.txt`. `.local-design`, önceki `docs/patches`, counter-history/practice scratch logları ve ilgisiz untracked dosyalar patch'e alınmaz. Staging/commit/push yok; publication için inceleme bekleniyor.

## Tipografi kök neden düzeltmesi — görsel inceleme eki

Bu ek, önceki raporun “largest text görsel olarak geçti” değerlendirmesinin yerine geçer. Önceki PNG ve QA kayıtları silinmedi. Screenshot dosyasının bulunması veya SHA-256 eşitliği görsel doğruluk kanıtı değildir.

### Gerçek nedenler

- `AppText` token rolünü font family/size/lineHeight olarak uygular, TextProps'u aktarır ve doğru biçimde native font scaling'i açık bırakır. Token rolü tek başına responsive yerleşim veya UIKit text-style bazında farklı büyüme sağlamaz. Shared display 24/32 iken Practice `styles.title` 30/34, timer 76/90, modal title 25/31 gibi override'lar kullanıyordu. Bu nominal display boyutlarının tamamı body gibi OS çarpanıyla büyüyordu. Global AppText ve tokenlar değiştirilmedi.
- `PracticeButton`: nominal 18/25, padding 12, minHeight 56, köşe yarıçapı 999; büyümeyi yalnız daha kısa bir label seçerek karşılıyordu. Native lineHeight büyüdükçe düğmenin doğal yüksekliği büyüyor, tam görünen label ise kısalıyordu.
- `PracticePreviewScreen`: safe-area içinde yatay padding 18; header `minHeight:56` yatay close/title, main ScrollView `flex:1`, tüm eylemler ve recovery ScrollView'in dışındaydı. Birden çok yüksek footer kontrolü kaydırılabilir viewport'u ciddi biçimde daraltıyordu. `PracticeFeatureScreen` recovery ek olarak ekranın %45'ine kadar ayrı, iç içe ScrollView kullanıyordu.
- `PracticeRule` ikon 44 + gap 14, intro kart padding 14: 375 pt cihazda metnin kullanabileceği alan 375−36−28−58 = 253 pt idi. Native büyük sözcükler bu satıra sığmayınca UIKit sözcük içinden kırabiliyordu. Hint ikon sütunu, sabit 250 pt pause orb içindeki 220 pt metin alanı, yatay özet satırları ve history header da aynı varsayımı taşıyordu.
- Intro'da `Artışı`, history'de `Geçmiş`, CTA'da `Başla` gibi önceki kısa metinler, footer/column/ölçüm nedenlerini çözmüyordu. Normal ve büyük boyutta artık tam metinler kullanılıyor.

### Sistematik yaklaşım

`practiceTypography.ts` + feature-local `PracticeText` tüm Practice metinlerini ortak kurala alır. Esas içerik native Dynamic Type'ı tam izler. Display ve kontrol etiketleri nominal boyut × √fontScale, büyük sayısal display nominal boyut × fontScale^0.15 olarak büyür. Sabit global max multiplier veya scaling kapatma yoktur; roller büyümeye devam eder. Yalnız dekoratif rehber ekseninin 1–10 minik tick rakamları accessible=false ve sabit boyuttadır; aynı anlam tam ölçeklenen aralık/açıklama metinleri ve gerçek erişilebilir 1–10 manuel seçim kontrolleriyle sunulur. Sayısal timer tek satır fit'ini ve tam erişilebilir değeri korur. Başlık, yönerge ve cevaplarda numberOfLines/ellipsis kullanılmaz.

Bir sözcük/korunan `fark et` grubu gerçekten ayrılan satırdan genişse, registered Inter face/weight/OS scale ile native `onTextLayout` ölçümü yapılır ve yalnız o metnin fontu sözcüğü koruyacak kadar uyarlanır. Bu bir paragrafı sabit yüksekliğe sığdırma değildir; satır sayısı ve dikey büyüme serbesttir. Kısıt, glyph genişliğinden bağımsız View `onLayout` ölçüsüdür; metnin kendi daralan intrinsic genişliği kullanılmaz. Ölçüm elemanı sıfır boyutlu, clipped, pointer-events kapalı ve accessibility'den gizlidir. Tam görünür metin ve a11y label saklanır.

Büyük/orta metinde çoklu eylemler aynı main ScrollView'in sonunda yer alır; recovery tek akışa katılır, nested %45 alan kaldırılır. Kart ikonları/hintler üstte, özet alanları alt alta; 1–10 seçimler 5/3/2 sütuna geçer. Kalite uç etiketleri büyük metinde alt alta. Pause yönergesi büyük metinde 180 pt dekoratif orb'un dışında okunur. History'nin büyük başlığı scroll içerisine alınır; geri kontrolü sabit ve erişilebilir kalır. Scroll/Text ölçüleri width/height/fontScale değişiminde yenilenir; session instance ve timer state aynı root'ta kalır. Modalın body ve bütün eylemleri safe-area içinde birlikte kaydırılır. 44 pt back/link, 48/58 pt seçim, 56 pt primary minimumları korunur.

### QA'da yakalanıp reddedilen adaylar

İlk adayda inline JSX boşluğu native Text uyarısı oluşturdu; kaldırıldı ve ham string regresyonu eklendi. Sonraki glyph-width tabanlı aday kısa guide etiketlerini tekrar tekrar küçültüyordu; constraint View ölçümüne taşındı ve intrinsic-width eşitliği regresyonu eklendi. Normal header wrapper'ının dikey hizası final karşılaştırmada düzeltildi. Bunlar başarılı kare olarak kullanılmaz.

Maestro'nun clipped ScrollView dışındaki child bounds'u görünür sayması, normal 7 seçiminde footer'a yanlış basmasına yol açtı. Normal/orta akış merkezleyerek basar; maksimumda Maestro merkezleme y=621 → y=−17 taşmasına yol açtığı için kontrolün gerçekten görünür olmasını hedefleyen merkezlemesiz arama kullanılır. Her önemli basıştan sonra beklenen phase doğrulanır; son QA record'unda gerçek seçilen level 7 / quality 8 / content true / stopped / Sakin ayrıca kontrol edilir. Büyük içerik için yetersiz 20 saniyelik arama yerine yeterli timeout kullanılır. Bu değişiklikler Practice runtime'a yapılmadı.

### Regresyon önleme ve sonraki QA kapısı

Otomatik testler: rol büyümesi, content scaling'in korunması, gerçek container/word-fit işleyişi, intrinsic-size feedback olmaması, gizli ölçümün a11y'den çıkarılması, tam label/1–10 values/minimum targets, 375/402 ve kısa 320 viewport'ta footer/column policy, scrollable dialog yapısı; actual handlers, background/foreground, rapid press, exact save/retry ve motion cleanup.

Piksel incelemesi gerektirenler: Türkçe satır sınırları, glyph/label clipping, üst üste binme, status bar/safe area, düğmenin viewport'a oranı, metin/eylem erişimi, dialog scroll/dismiss. Unit test veya hash bunları tek başına doğrulamaz.

Gelecek faz için zorunlu kontrol: iki desteklenen genişlik × varsayılan/orta/maksimum text category; 10 durum, start/exit dialog, boş geçmiş, error/retry ve Home/Reset kartı; üst/alt kaydırma karelerini gerçekten açıp inceleme; basış sonrası phase ve durable kayıt içeriğini doğrulama; başarısız kareyi düzeltme veya açıkça başarısız işaretleme. Maksimum Dynamic Type çıktısı incelenmeden “görsel tamamlandı” denemez.

### Sınırlar

Maksimum boyutta uzun yönergeler ve history doğal olarak birden çok viewport'a yayılır; tüm kontroller kaydırmayla erişilir. Native sözcük ölçümü ilk layout geçişinde tamamlandığından yeni metinde kısa reflow mümkündür. Fiziksel cihaz ve bağımsız VoiceOver kullanıcı çalışması bu Simulator matrisinin yerine geçmez. Ortak Bloom tipografisine bu feature-local yaklaşımın yayılması ayrıca ekran bazında QA gerektirir.

Native capture yöntemi: Maestro bazı `takeScreenshot` çağrılarında boş/eksik XCTest kareleri üretti. Bunlar reddedildi. Final runner aynı eylemleri yürütüp yalnız 127.0.0.1 üzerinde, izinli screenshot adı/yeni QA device/outdir için `xcrun simctl io screenshot` çağırır. Native PNG düzenlenmez. HTTP yalnız dosya adı taşır. API: [Maestro resmi HTTP belgesi](https://docs.maestro.dev/maestro-flows/javascript/make-http-requests). Retry sonrası saved etiketi üstte kalabildiği için önce durable-only Done kontrolü, sonra yukarı kaydırılıp etiket doğrulanır.

### Dar AX5 paragrafında ek görsel hata

Dar cihazın final adayında ikinci sorunun açıklaması native son satırda “takibini değişti” olarak sağdan kesildi. Bu akış durduruldu (exit 130); başarılı matrix kanıtı değildir. Native paragrafı yeniden mount etme adayı da aynı kusuru üretti ve reddedildi. QA teşhis kaydında native son satırın `text` alanı tam “takibini değiştirmez.” olmasına rağmen çizilen genişlik 311 pt ile sınırlıydı. Dolayısıyla dosya varlığı/akış exit 0 veya tam accessibility metni görsel doğruluğu kanıtlamıyordu. Düzeltme sonrası dört maksimum case de exit 0; aşağıdaki final matrix ve piksel inceleme kaydı geçerlidir.

FontScale kategorinin cihazdaki native sonucudur: önceki hedef adayında 3.235 görülürken final AX5 koşusunda iki cihazda da **3.571** ölçüldü. Tek bir sabit çarpan varsayılmadı; final metro logları kullanılır. Reset-only akışı QA ölçüm ekranını açmadığından onun viewport bilgisi aynı cihaz/kategorideki final fresh case ölçümüne referans verir; doğrudan Reset ölçümü olarak sunulmaz.

Dar AX5 teşhisinde yeterli native paragraf yüksekliği verildiğinde “takibini” ve “değiştirmez.” iki tam satıra ayrıldı. Bu, yalnız sözcük genişliğini ölçmenin yeterli olmadığını gösterdi. Kalıcı `PracticeText` yaklaşımı word-fit gereken metinde fitted font/gerçek satır genişliğiyle ikinci, gizli native paragraf ölçümü yapar. Ana metne yalnız ölçülen son satırın `y + height` toplamı ve 2 pt rounding payı kadar `minHeight` verir; sabit yüksekliğe sığdırma, line limit veya blanket boyut sınırı yoktur. Ölçüm signature'ı width/font/fit/metin değişiminde geçersizleşir. Ölçüm düğümü clipped ve accessibility dışında kalır; session root/timer state yeniden mount edilmez. Odaklı yeniden koşunun ham native görüntüsü açılıp incelendi: “takibini” ve “değiştirmez.” eksiksiz iki satır; gereksiz büyük boşluk yok. Ardından maksimum boyuttaki dört tam/Reset case yeni namespace ile yeniden yürütüldü ve tamamı geçti. Varsayılan/orta sekiz case önceki responsive matrisinden korunur; ek probe yalnız fit < 1 için devrededir.


### Güncel Simulator sonuçları

| Cihaz | Varsayılan (1.0) | Orta XXXL (1.353) | Maksimum AX5 (3.571) |
|---|---|---|---|
| iPhone 17 Pro · 402×874 pt | Final piksel incelemesi geçti | Final piksel incelemesi geçti | Final piksel incelemesi geçti |
| iPhone 13 mini · 375×812 pt | Final piksel incelemesi geçti | Final piksel incelemesi geçti | Final piksel incelemesi geçti |

Her hücre fresh-v8 tam egzersiz + hata/exact retry + Home ve ayrı reset-active fixture içerir. Sayısal fontScale tahmin edilmedi; native `useWindowDimensions` çıktısı [matrix](qa/practice-typography/native-matrix.json) içinde tutuldu. Varsayılanda onaylı Inter boyutları, illüstrasyon ve normal footer korunur. Orta boyutta ikonlar/özet satırları alt alta ve eylemler scroll içinde; maksimumda 1–10 iki sütun, ölçek uçları ayrı satırlar. Türkçe uzun sözcükler bütün, tam CTA ve yönergeler erişilebilir. Ekranın dışına kaydırılmış önceki satır bir clipping hatası sayılmadı; üst/alt kareler ve gerçek kontrol erişimi birlikte denetlendi.

Final akışlar yalnız görsel değil: kalite 8, açık içerik true, stopped, Sakin, manuel 7 ve bir mola durable kayıttan doğrulandı; ikinci pratikte üç skip null kaldı, kimlikler farklı. Reset fixture'ın tek kaydı değişmedi. Bu denetim timers/domain davranışına değişiklik getirmedi.

### Bu görevde yeniden çalıştırılan kontroller

Typecheck; Practice UI/runtime/motion/responsive; Practice persistence/integration; persistence migration/validation; durable acknowledgement; Reset continuity; navigation/save guard; Home; Library; Kegel persistence: **10/10 exit 0**. Loglar [yeni QA klasöründe](qa/practice-typography/). Reduced Motion branch ve animation cleanup otomatik doğrulandı; cihazdaki gerçek OS Reduced Motion anahtarıyla ayrı kullanıcı testi yapılmadı.

### Değişen görsel kaynaklar

Yeni `PracticeText.tsx` ve `practiceTypography.ts`; `PracticeButton`, `PracticePreviewScreen`, `PracticeVisuals`, `PracticeFeatureScreen`, `PracticeHistoryScreen`, `PracticeEntryCard`; QA viewport çıktısı; Practice UI/integration regresyonları; izole native capture runner, Maestro typography flow, galeri üreticileri ve inceleme belgeleri. Ayrıntılı güncel görsel dosya listesi `qa/practice-typography/visual-files.txt` içinde. Bu liste, önceden bekleyen bütün Phase 11.7.2 dosyalarını içeren `qa/practice-persistence/review-files.txt` listesinden ayrıdır.

İnceleme patch'leri: [yalnız bu tipografi düzeltmesi](patches/phase11-7-2-practice-typography-text-only.patch), [bütün bekleyen Phase 11.7.2](patches/phase11-7-2-practice-persistence-text-only.patch). İkisi de PNG piksellerini taşımaz; galeri PNG'leri ayrı dosyalardır. `.local-design`, geçici dosyalar ve ilgisiz yerel değişiklikler kapsam dışıdır.

### Son tipografi veri ve kanıt denetimi

İki cihaz × üç boyut × fresh/reset = **12 başarılı case**, 310 ham PNG. Her case için gerçek piksel inceleme notu ve toplam 204 incelenmiş kare kaydı tutulur; ek ham karelerin dosya varlığı bağımsız görsel onay sayılmaz. Reddedilen dar AX5 paragraf karesi galeride açıkça başarısız olarak etiketlenir. Son dört AX5 tekrarında doğal paragraf yüksekliği düzeltmesi vardır; sekiz varsayılan/orta case ana responsive düzeltme matrisindendir.

Bu görevin başlangıcındaki mevcut **47 anahtarın tamamı aynı**, eklenen canonical/eski QA anahtarı **0** ([koruma denetimi](qa/practice-typography/storage-preservation-final.json)). Bu görevin yeni cihazlarında 34/45 anahtar yalnız görev typography namespace'lerindedir; canonical key yok ([yeni cihaz denetimi](qa/practice-typography/new-device-storage-audit.json)). Reset'in altı case'inde kaydı içeren tüm state orijinal fixture ile deep-equal ([kanıt](qa/practice-typography/reset-fixture-preservation.json)). Runtime/domain/storage ve ortak/diğer Bloom kaynaklarından başlangıçta hashlenen 18 + 24 dosya bu görevde byte düzeyinde aynı kalmıştır. Önceki fazın bekleyen persistence uygulaması korunmuştur; bu ek o değişikliklerin yeniden uygulanması değildir.

Göreve ait Metro 8083 ve capture 8084 durduruldu; önceki Metro/E2E ortamı kullanılmadı. İki yeni cihazın yazı boyutu varsayılana döndürüldü; app data ve teşhis namespace'leri korundu. Gerçek kullanıcı/QA kaydı, migration backup veya ilgisiz dosya silinmedi.


## Son güvenilirlik ve QA yayın düzeltmesi

### Başlatma yarışının kesin çözümü

Önceki parent `start()` tanıtım onayından sonra `run.startedAt` ve `started=true` oluşturuyor; preview ise Promise'in sonraki `.then()` adımında `session.start()` çağırıyordu. İki adım arasında inactive olduğunda preview başlamıyor, parent'ın started kilidi yeni girişimi reddediyordu. Bu gerçek lifecycle ayrışmasıydı; timeout ile çözülmedi.

`PracticeProductionControls.onStart` artık senkron `startSession: () => boolean` callback'i alır. Parent durable tanıtım onayı, güncel AppState/mounted/epoch/availability kontrollerinden sonra aynı JS adımında callback'i çağırır. Preview callback'i kendi mounted/aktif/intro koşullarını tekrar kontrol eder, gerçek geçici runtime'ı başlatır ve running sonucunu döndürür. Parent yalnız bu başarıdan sonra run ref ve started state'i oluşturur. startedAt, aynı senkron başlangıcın hemen öncesindeki duvar saatidir; tanıtım bekleme zamanını temsil etmez. İki işlem arasında artık async boşluk yoktur.

İlk kontrol arka plandaysa tanıtım isteği bile yapılmaz. Yazı sırasında veya callback sınırında inactive olursa run oluşturulmaz; kullanıcı ön planda mevcut Başlat onayını yeniden verebilir. Durable tanıtım zaten onaylıysa tekrar yazılmaz. Gerçek başlangıçtan hemen sonra inactive olursa runtime background handler'ı anchor'ı durdurur; ön plana dönmek süreyi kendiliğinden başlatmaz, mevcut açık devam kontrolü gerekir. startBusy ve gerçek run ref çift/stale başlangıcı engeller. ID yalnız değişmeyen açık Save yolunda bir kez oluşturulur. Navigation/persistence/Reset korumaları korunur.

### Deterministik regresyon kanıtı

Yeni `verify-bloom-practice-startup.cjs`, gerçek parent/preview/geçici session/persistence controller kodunu kontrollü React hook, saat, AppState ve deferred acknowledgement ile yürütür. Storage action'ları yalnız test belleğindedir. Dokuz case: ACK öncesi inactive; pending yazı sırasında inactive; durable ACK sonucu üretildiği anda inactive; callback sınırında inactive; gerçek başlangıcın hemen ardından inactive; ACK sonucu tüketildikten hemen sonra inactive; rapid/stale callback; unmount; güncel availability engeli. Açık yeniden başlatma/devam, background süre dışlama, gerçek startedAt, tek tanıtım yazısı/runtime/kayıt/ID doğrulanır. Keyfi timeout veya sleep yok; tamamlanmamış deferred adımlar process beforeExit kontrolünde başarısız olur.

Eski kaynak ve parent'ın runtime callback'ini atlayan kusurlu test varyantı aynı harness tarafından exit 1 ile yakalandı. Düzeltme exit 0: [red kanıtı](qa/practice-persistence/reliability-startup-red-evidence.json), [sonuçlar](qa/practice-persistence/reliability-results.json).

Bu son kaynakla yeniden çalıştırılan **8/8 komut exit 0**: typecheck; Practice runtime/UI/lifecycle/motion; Practice persistence/integration/exact retry; persistence ACK; Reset continuity; navigation; persistence/migration; protection-reset. Loglar `qa/practice-persistence/reliability-*.log`.

### Onaylı görsellerin korunması ve yayın kapsamı

Tipografi, metinler, SVG/animasyonlar ve stiller değiştirilmedi. Önceki onaylı source'tan alınan 78 rendered-state sözleşmesi (375/402 pt × normal/orta/maksimum × 13 durum) aynı metin/stil/yerleşimi doğruladı. Bu native piksel testi değildir. Önceki gerçek Simulator incelemesi ve tüm ham PNG'ler korunur; bu görev yeni native screenshot koşusu olarak sunulmaz. Kaynak hash denetiminde başlangıçtaki 109 dosyadan yalnız FeatureScreen ve PreviewScreen lifecycle kodu değişmiştir; diğer 107 kaynak aynı, tüm 368 PNG aynı ([koruma kanıtı](qa/practice-persistence/reliability-preservation.json)). Bu görev cihaz depolamasına erişmedi; v9/migration/domain/Reset/kayıt/ID/silme kuralları değişmedi.

Git'e önerilen screenshot sayısı **368 → 60** (21 tarihsel persistence + 39 onaylı typography/retained failure). PNG boyutu **83.249.883 → 12.779.072 byte**. Dışarıda kalan 308 PNG yerinde kalır ve klasör .gitignore kurallarıyla hariçtir. Raporlar, sözleşme, gerçek inceleme kayıtları, migration/exact retry/veri koruma kanıtları ve test logları korunur. Galeriler/hash manifestleri yalnız seçilmiş, gerçekten var olan dosyaları referans verir. [Yayın / yerel arşiv ayrımı](qa/practice-persistence/publication-scope.md).

Önceki yerel inceleme yamaları aynen saklanır. Güncel bütün Phase 11.7.2 text-only inceleme: `docs/patches/phase11-7-2-reliability-publication-text-only.patch`; bu yama da önerilen Git listesinin dışındadır. Kesin dosya/boyut toplamı aşağıda ve `review-manifest.json` içinde üretilir. Staging/commit/push yok.

### Son çalışma ağacı doğrulaması
Önerilen Git kapsamı: **331 dosya** (271 metin, 60 PNG), **14,827,028 byte** (14.14 MiB; çalışma ağacı toplamı). 308 ham PNG ve önceki yerel yamalar kapsam dışındadır ve disk üzerinde korunur. Git diff check, güncel text-only patch reverse-check ve yalnız yayınlanacak dosyaları kullanan galeri/hash denetimi yapıldı. Native piksel QA sonucu önceki gerçek incelemedir; bu görevde 78 rendered-state eşitliği ayrıca doğrulandı. Index boş; commit/push yok.
