# Bloom — Phase 11.4.1 Library QA

2026-10-12–13 · `feature/product-ui-v1` · başlangıç `ae22759` · iPhone 17 Pro / iOS 26.3.
Commit/push yapılmadı. Başlangıçta yalnız `docs/patches/` izlenmiyordu; Phase 11.3 kaynak
kodunda commitlenmemiş değişiklik yoktu. İnceleme sırasında dışarıdan `main` dalına
geçildi; kullanıcının açık yanıtıyla hedef dala geri dönüldü. Önceki dört patch korundu.

## Tamamlanan davranış

- Native Library: HTML'deki `wave` “Bugün için” yazısı, 6 kategori / 12 yazı, gerçek
  kategori sayıları, kaynak SVG'lerden üretilen kapaklar, native scroll ve safe-area.
- `/(tabs)/library` → `/bloom/library/category?id=…` → `/bloom/library/article?id=…`.
  Normal geri zinciri korunur. Sıradaki yazı mevcut article rotasını değiştirir;
  kategori stack'ine her yazı için yeni bir geçmiş kaydı eklemez.
- Yazı okuyucu: kapak/fade, başlık, giriş, paragraflar, başlıklar, alıntı, kalın liste
  metinleri, deneme alanı, özet, scroll ilerlemesi, bookmark, tamamlama ve sıradaki yazı.
- Açılma veya sona kaydırma okundu durumu oluşturmaz. “Okundu olarak işaretle” açık
  eylemdir. Onay sonrası üst “Tamamlandı” etiketi, koyu/mavi çerçeveli buton ve kısa
  konfeti geri bildirimi gelir; aynı buton “Okundu bilgisini geri al” olarak erişilebilirdir.
- Karttaki okundu işareti ve “Kaydedildi” metni durable state'ten gelir.
  Bookmark ekleme/çıkarma ve okundu/geri alma restart sonrasında korunur.
- Reduced Motion giriş/etiket animasyonu, parallax ve konfeti efektlerini kapatır.
- Bilinmeyen kategori/yazı rotası güvenli bulunamadı ekranına gider; bookmark veya
  tamamlama yaratmaz. Katalogda bulunmayan eski ID'ler depoda korunur ve görünmez;
  açık kaldırma isteği desteklenir, bilinmeyen ID'ye yeni durum eklenemez.
- “Rahatlatıcı sesler” ve “Araştırmalar” yalnız “Yakında” / henüz açık değil durumundadır.
  Audio playback, player ve PDF reader uygulanmadı.

## Persistence ve veri uyumluluğu

Bloom v8 envelope/key değişmedi. `library` alanı eklemeli olarak
`{ bookmarkedArticleIds: string[], completedArticleIds: string[] }` saklar.
Eski v8 payload'ında alan yoksa iki boş küme eklenir; diğer tüm alanlar korunur.
Mevcut `wasNormalized` / `needsPersist` yolu bu normalizasyonun kaydını doğrular;
load sırasında eski v8 payload'ı doğrudan üzerine yazılmaz. Yazma hatasında eski veri
korunur, mevcut whole-state confirmation/retry yolu kullanılır.

V7 ve daha eski sürümler Library veya Kegel olgusu ithal edemez; mevcut migrasyon
kuralları aynen devam eder. V7 recovery kopyası byte düzeyinde saklanır.
Bozuk Library alanı tüm payload'ı mevcut quarantine/backup yoluna gönderir;
bozuk kayıtların yerine yeni kullanıcı geçmişi uydurulmaz. Geçerli ID kümesindeki
tekrarlar deterministik olarak tekilleştirilir; bilinmeyen ID'ler silinmez.

Komut facade'ındaki `library.setArticleState(kind, id, enabled)` mevcut acknowledged
runtime'ı kullanır. Controller busy durumunu komuttan önce yayınlar, doğrulanmamış
whole-state varken ikinci komutu kabul etmez. Retry, ilk write token'ını doğrular;
accepted state üzerinde toggle komutunu tekrar çalıştırmaz. Controller hiç tarih,
ziyaret geçmişi veya sentetik tamamlanma kaydı üretmez.

UI göstergeleri `durableState.library` kullanır. Başarı bildirimi ayrıca acknowledged
receipt, güncel whole-state eşitliği ve istenen durable olguyu kontrol eder. Hata halinde
başarı bildirimi/konfeti yoktur. Mevcut `usePersistenceNavigationGuard`, router boundary
ve `getBloomPersistenceRecovery` geri, swipe, ileri deep link ve tab kaçışlarını korur.
Eski token silme/hydration lifecycle'ında geçersizleşirse güncel state doğrulanır;
eski komut replay edilmez.

Home, Kegel ve Profil feature kodları değiştirilmedi. Provider/runtime/persistence
coordinator/guard kodları değiştirilmedi; state şeması, saf transition ve mevcut facade
Library için genişletildi.

## Kontroller

| Kontrol | Sonuç |
| --- | --- |
| `npm run typecheck` | Geçti |
| Temiz `expo export --platform ios` | Geçti; 12 Library PNG varlığı ve iOS JS paketi çözümlendi |
| `npm run verify:library` | Geçti |
| `npm run verify:persistence` | Geçti |
| `npm run verify:persistence-acknowledgement` | Geçti |
| `npm run verify:navigation` | Geçti |
| `npm run verify:kegel` | Geçti |
| `npm run verify:kegel:persistence` | Geçti |
| `npm run verify:reset-continuity` | Geçti |
| `npm run verify:home-ui` | Geçti |
| `npm run verify:guided-flows` | Geçti |
| `npm run verify:protection-reset` | Geçti |
| `npm run verify:e2e-runtime` | Geçti |
| `npm run verify:release-debug-guards` | Geçti |
| `.maestro/four-tabs.yaml` | Geçti |
| `.maestro/library-categories.yaml` | Geçti |
| `.maestro/library-covers.yaml` | Hilal ve okunmamış Sleep reader görsel kontrolü geçti |
| `.maestro/library-reader-visual.yaml` | Son özet/deneme kartı düzeni ve gerçek undo/complete eylemleri geçti |
| `.maestro/library-retained-tabs.yaml` | Library sonrası Tracking, Profil ve Kegel 20 tekrar UI kontrolü geçti |
| `.maestro/library.yaml` | Geçti (tam nihai akış) |
| `git diff --check` | Geçti |

Library unit/runtime testi: HTML içeriğiyle tek onaylı navigation ifade düzeltmesi dışında birebir eşitlik, katalog/next, eski v8
normalizasyonu ve başarısız write, v7 başarılı/başarısız migrasyon ve retained copy,
bookmark/read/undo/reopen, diğer tüm alanların korunması, senkron çift callback,
bekleyen gerçek write öncesinde durable başarının olmaması, write öncesi/sonrası
hata+retry, unknown ID, corrupt payload preservation, silme sonrası obsolete token.
Mevcut facade testi 37 saf acknowledged komutu; rota envanteri iki Library dosyasını
ayrıca doğrular. Bu test güncellemeleri eski test kapsamını kaldırmaz.

## Simulator

Yeni namespace: `bloom.e2e.kegel.qa_library_1141_20261012_f2c81.`; port `8084`.
Mevcut `8082` sunucusu ve eski QA namespace'leri değiştirilmedi. Normal Bloom uygulaması
bu testler için açılmadı. Storage hatası mevcut guarded Kegel QA runtime'ının
`kegel.qa.fail` kontrolünden enjekte edildi; yeni production debug veya failure API yok.

Dört-sekme akışı gerçek tanıtım ve iki gerçek Kegel seti oluşturdu (20 tekrar);
Tracking gerçek Home eylemiyle açıldı. Kegel başarısız kayıt/retry ve Home Tracking
başarısız kayıt/tab kilidi/retry de geçti. Bu state Library turundan önce snapshotlandı.
Library turu sonrası diğer bütün alanların eşitliği ve önceki 9 E2E storage değerinin
SHA-256 eşitliği doğrulandı. İki Kegel seti / 20 tekrar ve Tracking enabled aynen
korundu. Nihai Library olgusu yalnız completed `pe`; bookmark testte açıkça kaldırıldı.
Detay: [state audit](qa/library/state-audit.json).

Doğrulanan Library adımları: kategori/yazı/geri, scroll sonrası hâlâ okunmamış,
bookmark restart, açık tamamlama restart, geri alma, next yazı, bookmark removal
hatası+retry, completion hatası+retry, başarısız kayıtta geri/swipe/Home deep link kilidi,
read işaretinin kartta görünmesi. Nihai akış bütün kategoriler, unavailable bölümler,
diğer tablar ve unknown rotalarla tamamen geçti.

İlk manuel Simulator kontrolü restart sonrası araç `noWindowsAvailable` hatası verdi.
Kullanıcının açık onayıyla Maestro'ya geçildi. İlk test denemelerinde tam native
accessibility etiketinin okuma süresini içermesi, sekme barının arkasındaki başlığın
Maestro tarafından görünür sayılması ve incoming ekran animasyonu bitmeden geri
tıklanması saptandı. Seçiciler ID'ye çevrildi; hedefler ortalandı; geçiş bitişi ve gerçek
Library dönüşü ayrıca assert edildi. Native stack AX düğümlerini dokunmaya açılmadan
önce bildirebildiği için yalnız testte geri tıklamasından önce 700 ms geçiş beklemesi
eklenmiştir. Animasyonlar cihazda açık kaldı; uygulama guard'ı gevşetilmedi.

## Görsel karşılaştırma ve kalan kararlar

[Karşılaştırma galerisi](qa/library/index.html) ve [görüntü listesi](qa/library/README.md).
Ana ekran, reader başı, unread/done butonu, restart, undo, hata/retry ve unknown state
Simulator'dan yakalanır. HTML örnekleri gerçek kaynak fonksiyonları/CSS ile çevrimdışı
WeasyPrint/PDFium üzerinden render edilir; uygulamada WebView yoktur.

Tarayıcı `file:` URL erişimini reddettiği için browser güvenlik engeli aşılmadı.
Çevrimdışı renderer scripts/network çalıştırmaz. `inset`, form button ve scroller
viewport uyumluluk adaptasyonları rendering script'inde açıktır. Bu renderer CSS grid,
SVG `currentColor`, radial gradient, blur ve inset shadow'u tam eşlemez; referanstaki
koyu SVG ikonları, sert glow veya eksik buton çerçevesi bu renderer'ın sınırlamasıdır.
Galeri bunları browser pixel golden olarak sunmaz. Önceki fazın gerçek Chrome
[Library görüntüsü](qa/four-tabs/html-library.png) de ayrı kaynak olarak korunur;
featured yazısı farklıdır. Native renk/ölçü karşılaştırması kaynak CSS ile de kontrol edildi.

Native farklar: Archivo/Geist yerine mevcut Inter; statik SVG-derived kapaklarda
HTML'nin sürekli dalga/rotasyon/pulse animasyonu ve ince noise dokusu yok; opaque
üst kontrol arka planında browser blur yok. Reader parallax/fade, safe-area boyunca opak status scrim ve altında source `.topfade`, giriş/press ve
kısa completion animasyonu native'dir. CairoSVG'nin luminance-mask sınırlaması
Uyku kapağında tam ay üretiyordu; kaynak iki daire farkı tam SVG yay geometrisiyle
ifade edilerek hilal düzeltildi ve ayrı Simulator görsel kontrolü yapıldı. Kategori ekranı HTML grup tasarımından
ayrılan native route/header/back uyarlamasıdır. Gerçek iOS safe-area ve 402×874 pt
viewport, HTML 390×844 çerçevesinden farklı satır kırılmaları oluşturur.

Ürün/içerik kararları: referanstaki `run60` bir dakika nefes CTA'sının bu fazda gerçek
karşılığı yok; açıkça unavailable metni gösterilir. Kegel CTA'sı gerçek Kegel deneyimine gider. Pratik kartı “Pratik yakında” /
“Yeni Pratik deneyimi henüz kullanıma açık değil.” durumunu gösterir; legacy Arousal
Control bağlantısı yoktur. Tek “Pratik sekmesi” ifadesi “Eşik farkındalığı burada
işe yarar.” olarak düzeltildi; extractor bu minimal değişikliği yeniden üretir.
Diğer editorial içerik korunur; “Riskli saat” gibi eski ürün ifadeleri ayrı editorial
revizyonda ele alınabilir.
“Faydalı oldu mu?” yanıtı yalnız reader oturumunda tutulur; öneri/personalization veya
kalıcı kayıt iddiası yoktur. Sonraki yazı sırası HTML'deki global, döngüsel sıradır.
Bu faz yalnız ID düzeyindeki kullanıcı durumunu saklar; ileride içerik revizyonunda
okundu durumunun sıfırlanması ayrı bir ürün kararıdır.

Android/iPad/landscape/Dynamic Type ve gerçek cihaz bu fazda çalıştırılmadı.
Audio/PDF kapsamı Phase 11.4.2/11.4.3'e bırakıldı.

## Yeniden üretme

Mevcut namespace'i temizlemeyin; her yeni koşu için yeni 8–80 karakterli ad kullanın:

```sh
APP_VARIANT=e2e EXPO_PUBLIC_E2E_MODE=1 EXPO_PUBLIC_KEGEL_PERSISTENCE_QA=1 \
EXPO_PUBLIC_KEGEL_QA_RUN=qa_yeni_benzersiz_library_run \
npx expo start --dev-client --localhost --port 8084
xcrun simctl openurl booted 'tms-e2e://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8084'
maestro test .maestro/four-tabs.yaml
maestro test .maestro/library.yaml
maestro test .maestro/library-covers.yaml
maestro test .maestro/library-reader-visual.yaml
maestro test .maestro/library-retained-tabs.yaml
```

Kapak yeniden üretimi: `node scripts/extract-library-reference.cjs`, sonra CairoSVG/Pillow
bulunan geçici venv ile `scripts/render-library-assets.py`. Pelvic kapak, mevcut Kegel
anatomy katmanlarını salt okunur kullanır. Mobile dependency eklenmedi.
HTML karşılaştırması: `node scripts/render-library-reference.cjs /private/tmp/library-ref`,
sonra WeasyPrint/PDFium bulunan geçici ortamdan
`python scripts/render-library-reference.py /private/tmp/library-ref docs/qa/library`.
Temiz son iOS paketi `/private/tmp/bloom-library-final-ios-bundle` içine export edildi;
geliştirme sırasında asset üretiminden önce görülen geçici Metro çözümleme hataları
son kaynaklarda yoktur. Yalnız bu görevde açılan 8084 sunucusu QA sonunda kapatıldı;
mevcut 8082 sunucusu korundu.

Pango/Fribidi/Thai kitaplıkları yalnız `/private/tmp` içine açıldı; sistem kurulumu yapılmadı.

[Text-only review patch](patches/phase11-4-1-library-text-only.patch) binary kapakları ve
screenshots'ları dışlar; kaynak SVG'ler, kod, testler ve metin dokümantasyonunu içerir.
Binary dosyalar çalışma ağacında ayrıca teslim edilir. Patch başlangıç HEAD'ine
`git apply --check` / apply ve metin içeriği eşitliğiyle doğrulandı.

## Değişen dosyalar

- `app/_layout.tsx`, `app/bloom/library/article.tsx`, `app/bloom/library/category.tsx`
- `src/features/library/screens/LibraryEntryScreen.tsx`
- `src/features/library/screens/LibraryCategoryScreen.tsx`
- `src/features/library/screens/LibraryArticleScreen.tsx`
- `src/features/library/LibraryCover.tsx`, `LibraryArticleRow.tsx`, `libraryTheme.ts`
- `src/features/library/libraryContent.ts`, `libraryPersistenceController.ts`
- `src/features/library/assets/` — 8 kaynak SVG/PNG kapak; bookmark/outline SVG/PNG;
  hero-fade / status-fade PNG
- `src/storage/bloomState.ts`, `bloomStateSchema.ts`, `bloomLibrarySchema.ts`,
  `bloomLibraryTransitions.ts`
- `src/app/providers/bloomProductAcknowledgedActions.ts`
- `package.json`
- `scripts/verify-bloom-library.ts`, `run-bloom-library-verification.cjs`
- `scripts/verify-bloom-product-actions.ts`, `verify-bloom-product-routes.ts`,
  `verify-bloom-four-tabs.cjs`
- `scripts/extract-library-reference.cjs`, `render-library-assets.py`,
  `render-library-reference.cjs`, `render-library-reference.py`
- `.maestro/library.yaml`, `.maestro/library-categories.yaml`,
  `.maestro/library-transition-settle.js`, `.maestro/library-covers.yaml`,
  `.maestro/library-reader-visual.yaml`, `.maestro/library-retained-tabs.yaml`
- `docs/phase11-4-1-library-qa.md`, `docs/qa/library/`,
  `docs/patches/phase11-4-1-library-text-only.patch`


## Final review düzeltmeleri · 13 Ekim 2026

Önceki commit edilmemiş Library çalışması ve önceki review patch korunmuştur.
Bu turdaki uygulama değişiklikleri yalnız reader ve tek navigation ifadesidir:

- `LibraryArticleScreen.tsx`: legacy Pratik yönlendirmesi kaldırıldı; açık unavailable
  durum gösterilir. Gerçek Kegel CTA'sı aynı rota ve pending-save guard ile çalışır.
  iOS status safe-area opak siyahtır; mevcut 64 pt fade bunun altında devam eder.
- `libraryContent.ts` / `extract-library-reference.cjs`: `pe` ID'sinin ilk
  paragrafındaki tek “Pratik sekmesi” ifadesi düzeltildi. Katalog, ID ve diğer metinler
  değişmedi. Geçici dizinde extractor çıktısı byte eşitliğiyle doğrulandı.
- `verify-bloom-library.ts`: yalnız bu açık içerik farkına izin verilir; geri kalan
  referans eşitliği, migration, acknowledged persistence ve retry testleri korunur.
- `.maestro/library-final-review.yaml`: unavailable Pratik, scrolled reader, gerçek
  Kegel CTA/dönüş ve mevcut sekmeler için ek Simulator kontrolü.

Typecheck; Library; navigation; persistence; persistence acknowledgement; Kegel ve
Kegel persistence; Reset continuity; Home UI; guided flows doğrulamaları geçti.
Final Maestro sonuçları ve veri karşılaştırması aşağıdaki final-review galerisiyle
birlikte kaydedilir. İlk Maestro CTA turunda sekme assertion'ı, ikinci turda XCTest
transport bağlantısı başarısız oldu; geçti etiketi yalnız tamamlanan son koşulara
verilir. Otomasyon Kegel ekranından native kapatma ve geçiş bekleme ile döner;
ürünün diğer tab davranışına değişiklik yapılmadı.

[Final review Simulator görüntüleri](qa/library/index.html#final-review) status-bar
okunurluğunu ve unavailable kartı gösterir. Önceki görüntüler tarihsel karşılaştırma
olarak korunur. Bu UI değişiklikleri storage/schema/provider dosyalarına dokunmaz;
v8/v7 uyumluluğu, guards ve kullanıcı verisi aynı mimariyi kullanır.


| Final Simulator koşusu | Sonuç |
| --- | --- |
| `maestro test .maestro/library-final-review.yaml --debug-output /private/tmp/bloom-library-final-review-cta-final` | PASS, exit 0; unavailable Pratik, Kegel CTA/native dönüş, Home/Profile/Library |
| `maestro test .maestro/library.yaml --debug-output /private/tmp/bloom-library-final-review-regression-reboot` | PASS, exit 0; bookmark/read restart, undo/next, iki storage hatası + retry, back/swipe/tab guards, 6 kategori, unknown ID |

Son Library turu öncesinde bir XCTest swipe çağrısı HTTP 500/zaman aşımıyla
kesildi. QA Simulator veri silmeden yeniden başlatıldı; yukarıdaki son tam tur
başarıyla tamamlandı. Açık bir doğrulama hatası kalmadı. `git diff --check` geçti.

[Final review state audit](qa/library/final-review-state-audit.json): turun
başlangıcındaki bütün Bloom state alanlarıyla son state eşit; diğer 9 storage
payload'ının hash'i ve storage key kümesi aynı. Başlangıçta bulunan 3 Kegel seti /
30 tekrar, Tracking enabled ve Library (`bookmarked=[]`, `completed=[pe]`)
korundu. Önceki fazın 2 set / 20 tekrar audit/görüntüsü tarihsel kanıt olarak
bırakıldı. Bu tur egzersiz başlatmadı ve normal Bloom uygulamasını açmadı.

[Final review text-only delta patch](patches/phase11-4-1-final-review-fixes.patch)
önceki Phase 11.4.1 patch'inin üzerine uygulanır; önceki patch değiştirilmedi.
Binary screenshots dışındadır. İki patch sırayla HEAD `ae22759` arşivine
uygulanarak `git apply --check`, apply ve son metinlerin byte eşitliği doğrulandı.
Yeni screenshot/manifest/gallery/audit dosyaları `docs/qa/library/` altındadır.

Kalan kapsam: yeni Pratik deneyimi planlanan fazına kadar unavailable'dır;
Audio/PDF hâlâ Phase 11.4.2/11.4.3 kapsamındadır. Commit veya push yapılmadı.
