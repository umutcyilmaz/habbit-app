# Bloom — Phase 11.5.1 Profile QA

Tarih: 13 Ekim 2026 · Branch: `feature/product-ui-v1` · Başlangıç/son HEAD: `8ac0523baf236dd3a09e5625521c3666dde73d40`. Commit/push yapılmadı.

## Uygulama ve kapsam

Profile artık native React Native ekranıdır: avatar ve yerel profil kartı, ayarlar ikonu, üç ana sayı, rekor/kayıt özeti, “Senin için”, abonelik boş durumu ve gruplu ayar bağlantıları. WebView kullanılmaz. `AppScreen`, `AppCard`, `AppText`, `BloomTabIcon`, `BloomNestedBackButton` ve `LibraryArticleRow` yeniden kullanılır. Yeni kaydedilen-yazılar ekranı yalnızca mevcut kataloğun bookmarked içeriklerini gösterir; yazı açma, okundu/kaydetme ve audio davranışı mevcut Library ekranına aittir.

`durableState` tek veri kaynağıdır; accepted/pending veriler sayılara dönüşmez. Şema, migration, provider, silme koordinatörü, mevcut navigation/persistence guard’ları, Kegel kuralları ve dört tab değiştirilmedi. Yeni salt okunur `/bloom/profile/saved` rotası root stack’e eklendi. Sabit rota envanteri regresyonu bu tek ek rotayı da denetler.

Ekran focus’ta ve foreground’a dönüşte saati yeniler; yalnızca focus boyunca dakika aralığı kullanır. İçeriksiz 24 saat/gün sınırındaki değişim bir dakika içinde yansır. Staggered `FadeInDown` ve yeni rota animasyonu Reduce Motion açıkken devre dışıdır. Metinler Dynamic Type kullanır; kart/satır yükseklikleri sabit değildir. Font ölçeği 1.5 üzerindeyken kimlik ve üç istatistik dikey düzenlenir. Mevcut sabit yükseklikli tab bar’da aşırı ölçekle çakışan etiketler için yalnızca metin ölçeği 1.3 ile sınırlanır; tab sayısı, rotalar, hedef boyutları ve erişilebilirlik etiketleri aynıdır. Profile içeriği tam Dynamic Type ölçeğini kullanır. Başlıklar, açıklamalı butonlar, birleşik istatistik erişilebilirlik etiketleri, dekoratif SVG’ler ve en az 44pt ayar/geri hedefleri kullanılır.

## Gerçek veriler ve tanımlar

| Görünen alan | Kaynak / tanım |
| --- | --- |
| İçeriksiz gün | `getBloomProgressReadModel` → `getContentFreeProgress.currentCompletedDays`; aktif sayacın tamamlanan 24 saatleri, mevcut Reset kredi/undo semantiği dahil. Kapalı sayaçta `—`; erişilebilirlik etiketi “İçeriksiz sayaç kapalı”. |
| Takip oturumu | Aynı progress seçicisi → `getTrackingSummary.completedSessionCount`. Tüm zamanların completed Masturbation Tracking oturumları; active/awaiting-feedback ve gözlem saatinden sonra biten oturumlar hariç. Legacy arousal kayıtlarıyla birleştirilmez. |
| Kegel serisi | Mevcut `deriveKegelSummary.streak`; kaydedilmiş completionDate yerel günleri, bugün kayıt yoksa dünün devam kuralı. |
| En uzun içeriksiz seri | Mevcut `effectiveBestStreakSeconds / 86400`, aşağı yuvarlanır; aktif ve tarihsel en iyi süre birlikte değerlendirilir. |
| Tamamlanan Kegel seti / toplam tekrar | Kalıcı completed Kegel session kimliklerinin benzersiz sayısı ve mevcut Kegel seçicisinin gerçek `completedRepetitions` toplamı. HTML’nin `total / 10` varsayımı kullanılmaz. |
| Tamamlanan / kaydedilen yazı | `library.completedArticleIds` / `bookmarkedArticleIds`, gerçek `libraryArticles` kataloğuyla kesişim. Eski/bilinmeyen kimlikler ve tekrarlar sayı veya bozuk link yaratmaz. |
| Tamamlanan Reset sayısı | Mevcut progress seçicisinin completedAttemptCount değeri; elapsed ama henüz kaydedilmemiş tamamlanma rapor olarak sunulmaz. |
| Değerlendirmem | Mevcut `getStartingRecommendationView`: validated completed product onboarding ve planAcceptance null ise mevcut `/bloom/starting-recommendation` rotası açılır. Sonuç yeniden skorlanmaz. |

İsim, kayıt tarihi, üyelik hakkı veya güvenilir toplam içeriksiz gün kaynağı yok. Bu yüzden “Kişisel alanın / Verilerin bu cihazda / Yerel profil” kullanılır; ad, üyelik başlangıç tarihi, Plus, fiyat, trial ve toplam içeriksiz gün uydurulmaz. Üyelik alanı açıkça kullanılamıyor der. Sıfır, gerçek boş dizinin sayımıdır; hidratasyon hatası/eksikliği sıfır dashboard’a çevrilmez.

## Navigasyon ve ürün kararları

- Ayarlar → `/settings`; Gizlilik → `/settings/privacy`; Veri kontrolleri → `/settings/data-controls`. Mevcut native Back ve silme safeguards korunur; QA silme butonuna basmaz.
- Kaydedilen yazılar → `/bloom/profile/saved` → gerçek `/bloom/library/article?id=...`; reader Back → saved list → Profile. Boş liste Library bağlantısını sunar.
- Planı seçilmemiş geçerli onboarding sonucu mevcut sonuç ekranına gider. Planı seçilmiş sonuç için mevcut ekran `unavailable` verir ve `/onboarding/result` Home’a redirect eder. Bu durumda Profile satırı “Planın seçildi · sonuç görüntüleme henüz yok” olarak salt okunurdur. Geçmiş sonuçları salt okunur açan bir ekran ayrı ürün kararıdır; bu fazda guard değiştirilmedi.
- Reset rapor ekranı mevcut değil. Satır gerçek completed Reset sayısını/boş durumu ve “raporlar henüz kullanıma açık değil” bilgisini gösterir; sahte toast/link yok.
- Üyelik yönetimi, biyometri, bildirimler, simge seçimi ve yeni dışa aktarma uygulanmadı. Research/PDF ertelenmiş olarak kaldı.

## Doğrulama

Deterministik testlerde gerçek storage coordinator ve mutation runtime, bellek storage adapter’iyle çalışır. Cihaz verisi okunmaz/silinmez. `verify:profile` boş/hatalı/yükleniyor durumunu, gerçek seçicileri, idempotent Kegel kayıtlarını, pending oturum hariç tutulmasını, katalog filtrelemesini, inactive tarihsel rekoru, Reset sayısını, onboarding rota geçerliliğini, gerçek envelope round trip/restart’ı ve failed-save durable projection’ını denetler.

| Kontrol | Sonuç |
| --- | --- |
| `npm run typecheck` | Geçti |
| `npm run verify:profile` | Geçti |
| `npm run verify:navigation` | Geçti |
| `npm run verify:persistence` | Geçti; yeni Profile rotası için sabit envanter güncellendi |
| `npm run verify:persistence-acknowledgement` | Geçti |
| `npm run verify:kegel`, `verify:kegel:persistence` | Geçti |
| `npm run verify:library`, `verify:audio` | Geçti |
| `npm run verify:home-ui`, `verify:journey` | Geçti |
| `npm run verify:reset-continuity`, `verify:protection-reset` | Geçti |
| `npm run verify:product-onboarding-ui`, `verify:guided-flows`, `verify:e2e-runtime` | Geçti |
| `git diff --check` | Geçti |

Native iOS sonuçları:

| Senaryo | Sonuç / kanıt |
| --- | --- |
| Fresh/empty, Ayarlar/Gizlilik/Veri kontrolleri, back ve restart | Geçti; final kodla ikinci yeni namespace’te tekrar doğrulandı; `01`–`07` |
| Gerçek onboarding yanıtlarının kaydı, mevcut result bağlantısı, restart | Geçti; `08`–`09` |
| Plan kabulünden sonra sonuç rota kısıtının doğru gösterilmesi | Geçti; `09b` |
| UI’da tamamlanan gerçek Kegel, bookmark/read, saved list/reader/back ve restart | Geçti; `10`–`13`; 1 Kegel seti, 10 tekrar, 1 okunan ve 1 kaydedilen yazı |
| En büyük Dynamic Type, scroll ve saved/back | Geçti; `14`–`16`; final boş QA namespace’inde soğuk başlangıç, font ölçeği >1.5 için dikey düzen |

İlk history denemesi Profile’ın korunmuş scroll konumunda ekran dışındaki istatistiği aradığı için assertion’da durdu. Test yukarı kaydıracak şekilde düzeltildi; bu fazın kendi yeni namespace’indeki gerçek kayıtlar korunup tekrar kullanıldı. Test idempotent bookmark/read koşulları sayesinde bu kayıtları geri almaz. İlk büyük-yazı yakalamasında yerleşim/başlık problemi görüldü; adaptif dikey düzen, esnek başlık ve soğuk başlangıç QA’sıyla düzeltildi. Galeride final görüntüler kullanılır.

Native test sonuçları ve son görsel inceleme aşağıda kayıtlıdır. Android hardware-back, gerçek cihaz VoiceOver denetimi, abonelik/OS izinleri bu iOS fazının kanıtı değildir.

## iOS izolasyonu ve yeniden çalıştırma

Cihaz: iPhone 17 Pro, iOS 26.3, 402×874pt. Uygulama: **`com.umutcyilmaz.bloom.e2e`**, scheme `tms-e2e`. Normal Bloom açılmaz. Bu fazda yeni run’lar `profile_20261013_1219` ve `profile_finalempty_20261013_1231` kullanıldı. Yeni `EXPO_PUBLIC_KEGEL_QA_RUN` zorunlu; `createKegelQaStorage` tüm storage anahtarlarını bu yeni prefix altında izole eder. `clearState`, AsyncStorage temizleme, database edit, cihaz saati değişikliği veya eski QA seed/replace komutu kullanılmaz. Kegel/onboarding/bookmark/read kayıtları gerçek UI ve mevcut acknowledged mutation yoluyla yaratılır. Bu fazın yeni test kayıtları da silinmez.

```sh
EXPO_PUBLIC_KEGEL_QA_RUN=profile_NEW_UNIQUE_RUN npm run start:e2e:kegel:persistence
maestro test .maestro/profile-empty.yaml --test-output-dir /private/tmp/profile-empty
maestro test .maestro/profile-onboarding.yaml --test-output-dir /private/tmp/profile-onboarding
maestro test .maestro/profile-assessment-accepted.yaml .maestro/profile-history.yaml --test-output-dir /private/tmp/profile-history
```

Her fresh suite yeni run’da bir kere çalıştırılmalıdır; mevcut kullanıcı/QA verileri üzerinde sıfırlanarak tekrarlanmaz. Büyük yazı boyutu görsel kontrolü için Simulator UI content_size değeri geçici değiştirilir ve başlangıç değerine geri getirilir.

## HTML / native farkları

[Karşılaştırma galerisi](qa/profile/index.html) orijinal HTML CSS/fonksiyonlarından Chrome’da yakalanan Profil ve Senin için ekranlarını native screenshot’larla birlikte gösterir. `scripts/extract-profile-reference.cjs` kaynak `PR` fixture’ını aynen okur; örnek Mert/Plus/sayılar sadece referans görüntüleridir. HTML 390×844, native 402×874pt; cihaz çerçevesi/font ve güvenli alanlar farklıdır.

Native Inter, HTML’deki Archivo/stretch/SF fontlarından farklıdır. Siyah zemin, `#141415` kartlar, `#3a4bff` avatar, `#aab3ff` ikonlar, 16pt kenar boşluğu, 30pt ana kart/26pt grup radius ve 38pt satır ikonları eşleştirildi. Desteklenmeyen HTML toplam-gün satırının yerine gerçek Kegel tekrar/yazı sayıları geldiği için rekor kartı daha uzundur. İstatistik tanımı notu ve gerçek ayar bağlantıları eklendi. Native açıklama satırları daha çok sarılır; unavailable satırlar chevron/button içermez. Animasyonlar kısa giriş hareketidir, sürekli sayaç/tween kullanılmaz.

## Dosyalar ve teslimatlar

- `src/features/profile/screens/ProfileEntryScreen.tsx`: tam ekran.
- `src/features/profile/profileReadModel.ts`: mevcut seçicileri birleştiren salt okunur özet ve bookmarked katalog listesi.
- `src/features/profile/components/ProfileIcon.tsx`: native SVG ikonları.
- `src/features/profile/screens/SavedProfileArticlesScreen.tsx`, `app/bloom/profile/saved.tsx`, `app/_layout.tsx`: gerçek saved içerik ve yeni stack kaydı.
- `src/shared/navigation/BloomBottomNavigation.tsx`: sabit tab bar etiketleri için tek maxFontSizeMultiplier sınırı; dört-tab yapısı ve davranışı aynı.
- `scripts/verify-bloom-profile.ts`, `scripts/run-bloom-profile-verification.cjs`, `scripts/verify-bloom-product-routes.ts`, `package.json`: Profile doğrulaması ve rota envanteri.
- `.maestro/profile-*.yaml`: isolated iOS UI testleri.
- `scripts/extract-profile-reference.cjs`, `docs/qa/profile/`: HTML/native galeri ve QA kanıtı.
- Bu belge ve `docs/patches/phase11-5-1-profile-text-only.patch`: text-only review teslimi; PNG/binary asset içermez. Önceden var olan `docs/patches/` dosyaları değiştirilmedi.

Son teslim doğrulaması: Galeride 19 PNG bulunur; tüm görüntü linkleri ve SHA-256 envanteri kontrol edildi. 21 dosyalık text-only patch, approved HEAD’in `/private/tmp` altına çıkarılmış temiz arşivinde `git apply --check` ile geçti; `GIT binary patch`/binary diff içermediği denetlendi. `git diff --check` ve son typecheck geçti. Simulator content_size başlangıçtaki `large` değerine döndü. QA için başlatılan Metro kapatıldı; yeni QA kayıtları ve eski kullanıcı/QA kayıtları silinmedi. Gerçek cihaz VoiceOver ve Reduce Motion OS ayarını açarak native animasyon denetimi yapılmadı; bu alanlarda kod/erişilebilirlik metadata incelemesi vardır.


## Son terminoloji düzeltmesi — 13 Ekim 2026

Ana metrik etiketi “Takip oturumu” olarak düzeltildi; iki satırlı metin yapısı korunur. Açıklama artık “Takip sayısı, tamamlanan tüm takip oturumlarını kapsar.” der. Planlanan ayrı Practice özelliğiyle karışıklık giderildi. `completedPracticeCount`, mevcut seçiciler/hesaplama, erişilebilirlik etiketi/test ID, persistence, navigation ve stiller aynı kaldı. Profile testinin assertion açıklaması Tracking terminolojisine uyarlandı; native testteki “tamamlanan takip oturumu” etiketi zaten doğrudur.

Bu düzeltme için typecheck, `verify:profile` ve `git diff --check` yeniden çalıştırıldı ve geçti. Mevcut galeri görüntüleri onaylı görsel incelemenin terminoloji düzeltmesinden önceki kayıtlarıdır; yeni screenshot veya native UI testi çalıştırılmadı. Text-only review patch güncel metinlere göre yenilendi. Commit/push yapılmadı.
