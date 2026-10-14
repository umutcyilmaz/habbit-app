# Bloom — Phase 11.7.1 Native Practice QA

Çalışma tabanı: `feature/product-ui-v1`, `cb02862f16118521b9cfb632541e7d5787ffb465`.
İlk uygulama: 13 Ekim 2026. Son görsel review: 14 Ekim 2026, Europe/Istanbul. Aşağıdaki uygulama ve görsel review kanıtları yayın öncesi aşamaya aittir.

## Mimari denetimi ve sınırlar

| İncelenen alan | Bulgu ve uygulanan karar |
| --- | --- |
| Masturbation Tracking | `useMasturbationSessionFeature`, controller, route view, `MasturbationSession` ve storage transitions ordinary oturumun active → awaiting_feedback → completed akışını ve acknowledged write/retry yönetir. Tarihleri wall clock’tan gelir. Bu mutasyonlar Practice tarafından çağrılmaz. |
| Legacy Arousal Control | `arousalControl.draft`, check-in/note/duration ve completion log kimliğiyle kalıcı ayrı akış. `MainPracticeScreen`, `PauseScreen`, submission/README incelendi. Yeni deneyimde mount edilmez; bucket veya tahmini duration dönüştürmeleri alınmadı. |
| Kegel timer | `useKegelExercise` monotonic saat, interval temizliği, AppState duraklama örneği sunar. Sabit tekrar/countdown ve Kegel completion metriklerine bağlı olduğu için doğrudan kullanılmadı. Practice toplamında bilinçli duraklama dahil, background/confirmation hariç. |
| Güvenli UI reuse | V4 `AppText`, Kegel’in stateless `KegelCard`, `KegelBack`, `KegelHint`, yerel renkleri kullanıldı. Ortak düğmenin büyük fontta satır ölçümünün yetersiz olduğu görülerek aynı görsel stili koruyan bağımsız `PracticeButton` eklendi. Native Practice SVG ikonları yerel HTML path’leriyle çizildi. Kegel session/persistence controller bağlanmadı. |
| Persistence/navigation | v8 storage/schema/migration/provider/action dosyaları değişmedi. Mevcut `BloomGuardedStack` kalır. Practice draft için `usePreventRemove`, gesture kilidi, Android back onayı eklenir; unconfirmed save guard bypass edilmez. |
| HTML | İki HTML’in Practice fonksiyonları, tasarım levhası ve prototype `pRun/pPause/pQuestions/pSave/pExitSheet` okundu. Son referans ana ekranı statik 1–10 rehberidir. Talep edilen dekoratif eğri ayrıca açık “fizyolojik ölçüm değil” etiketiyle eklendi. |

`docs/bloom-html-implementation-plan.md` içindeki Practice’in tracking lifecycle
ile birleştirilmesini öneren eski satırlar bu fazın bağımsız domain sınırına göre
düzeltildi. Diğer özelliklerin davranışları değiştirilmedi.

## Native uygulama

`src/features/practice` bağımsız geçici runtime, yedi ekran durumu ve native SVG /
Reanimated görseller içerir. WebView kullanılmaz. Başlama ve çıkma onayı, gerçek
elapsed-time, pause/resume, 4/4/6 nefes küresi, optional manuel 1–10 beyanı,
3 reflection sorusu, tekli bitiş/çoklu his seçimi, atlama, geri ve yanıt düzenleme
uygulandı. Özet mevcut denemenin süreleri, duraklamaları ve beyanlarını gösterir.

Runtime senkron komut kontrolleriyle aynı start/pause/resume/finish işlemini iki
kez oluşturmaz. Sonraki soru için render’ın beklediği soru numarası kontrol
edilir; stale handler soru atlatamaz. Kontrol basışlarında 350 ms koruma vardır.
Monotonic `performance.now()` farkı interval kaymasına dayanıklıdır. Interval
yalnız aktif foreground exercise sırasında çalışır; unmount/discard sonrasında
abonelikler ve animation’lar temizlenir. Efekt remount/Fast Refresh cleanup aralığı
süreye eklenmez.

Arka plana veya inactive durumuna geçişte saat ve animasyon durur. Foreground’da
açık devam eylemi gerekir. Bilinçli duraklama ayrı kalır; background bir yeni
“duraklama” yaratmaz. Çıkış onayı süresi hariç tutulur; “Pratiğe dön” önceki
running/paused durumunu korur. Reflection’a geçince saat donar. Duraklama sırasında
bitirmek o aralığı bir kez kapatır. Süre hedefi veya otomatik tamamlanma yoktur.

Başlıklar, seçim state’leri, minimum 44 pt hedefler, scroll alanları, scalable text
ve ekran değişimi duyuruları vardır. Büyük fontta QA etiketi scroll gövdesine taşınır; kısa görünen düğme etiketlerinin tam accessibility label’ı korunur, sayısal girişler iki sütuna iner, özet satırları dikey yerleşir. Yalnız dekoratif cetvelin küçük sayı işaretleri sabit fonttadır; aynı anlamı veren grup metinleri ve bütün gerçek kullanıcı girişleri tam font scaling kullanır. Reduced Motion girişleri/fade/curve loop ve
orb/confirmation tween’lerini kapatır; nefes yönergesi ve işlevler kalır. Sayısal
süre tek satırda kullanılabilir alana sığar. Native VoiceOver ile insan dinleme
incelemesi yapılmadı; otomatik erişilebilirlik hiyerarşisi ve Reduced Motion
handler/görsel testleri yapıldı.

## HTML’den bilinçli farklar

- “Pratik kaydedildi” yerine “Pratik tamamlandı · Önizleme · Kaydedilmedi”.
- “Kaydet” yerine “Özeti göster”; “Kaydı düzenle” yerine “Yanıtları düzenle”.
- İçerik “Evet” amber görünür ama hiçbir seri sıfırlanmaz. Uydurma 26 günlük seri,
  geçmiş karşılaştırması, progress/başarı puanı veya kayıt kimliği yoktur.
- QA bütün 3 soruyu her zaman gösterir; üçü de açık atlama eylemi sunar. Üretim
  koşulları ve gerekli cevaplar 11.7.2 kararlarıdır.
- Kalıcı intro-seen bayrağı yoktur; her yeni QA girişinde tanıtım gösterilir.
- Gerçek duraklama zamanları eğri üzerinde kesikli zaman işaretleri olarak
  görünür. Eğrinin yüksekliği/hareketli nokta ölçüm veya kullanıcı beyanı değildir.
  Manuel seviyeler ayrıca beyan olarak özetlenir.

## İzole QA girişi

```sh
npm run start:e2e:practice
# Mevcut E2E dev-client localhost:8082’ye bağlı olmalı.
xcrun simctl openurl booted 'tms-e2e:///debug/practice'
npm run verify:practice
npm run typecheck
maestro test .maestro/practice-preview.yaml
maestro test .maestro/practice-lifecycle.yaml
# content_size accessibility-extra-extra-extra-large iken:
maestro test .maestro/practice-large-text.yaml
```

Giriş aynı anda `__DEV__`, E2E mode, `com.umutcyilmaz.bloom.e2e` bundle kimliği ve
`EXPO_PUBLIC_PRACTICE_PREVIEW=1` gerektirir. Guard’ın 36 kombinasyonu doğrulanır;
kapalı durumda root’a redirect olur. Üretim menüsü/tabı, Library “Pratik yakında”
CTA’sı, Reset erişim kuralı veya production Practice rotası eklenmedi. Bu preview
üretim uygunluk politikasının bir implementasyonu değildir.

## Doğrulama kanıtları

[HTML/native karşılaştırma galerisi](qa/practice/index.html).
[11.7.2 model ve karar listesi](phase11-7-2-practice-persistence-proposal.md).
Text-only review patch yerel `docs/patches/phase11-7-1-practice-ui-text-only.patch` dosyasındadır; yayın kapsamı dışında tutulur.

- Typecheck: geçti (`qa/practice/typecheck.log`).
- Practice runtime/UI/motion: geçti (`qa/practice/verify-practice.log`). Gerçek
  screen handler’ları kontrollü hooks/AppState/clock ile çalıştırılır; native
  renderer’ın yerine geçmez. Native kanıt ayrıca Simulator koşularıdır.
- 18 paket: persistence, persistence-acknowledgement, navigation, guided-flows,
  Kegel, Kegel persistence, Library, Profile, Settings, Audio, counter-history,
  Home UI, reset-continuity, protection-reset, release-debug-guards, E2E runtime,
  E2E identity ve Practice; tamamı geçti (`qa/practice/test-results.json`).
- Normal Simulator full flow: geçti (`qa/practice/native-normal-clean.log`), iPhone 17
  Pro / iOS 26.3, `content_size=large` (standart). Start cancel/confirm → seviye 7
  beyanı → pause/resume → exit cancel → 3 yanıt → gerçek özet → edit/skip → done;
  ardından yeni denemeden çıkış doğrulandı.

İlk otomasyon koşusunda XCTest accessibility session SIGSEGV raporu oluştu.
İkinci koşuda alttaki sabit düğmeyle çakışan offscreen seçeneğe otomasyon dokundu;
`centerElement: true` ve seçimin görünür doğrulamasıyla test düzeltildi. Bir ara
koşu geliştirme Fast Refresh sırasında kaldı. Geçerli final normal koşu bunlardan
sonra, temiz uygulama başlangıcında ve product source değişmeden geçti. Önceki
başarısız loglar saklandı; başarı kanıtı olarak kullanılmaz.

- Lifecycle / restart / dört tab: geçti (`qa/practice/native-lifecycle-final.log`).
  Running ve paused arka plan dönüşü açık devam ister; yinelenen pause/resume
  tek aralık oluşturur; paused finish, tüm soruları atlama ve restart sonrası
  intro doğrulanır. Kegel için introduced varsayımı yerine gerçek feature
  container’ı doğrulanır. Mevcut veriye yeni fixture eklenmedi.
- En büyük Dynamic Type tam akış: geçti (`qa/practice/native-largest-clean.log`).
  Tanıtım/modal, süre/rehber, pause, üç yanıt ve scroll summary/done çalışır.
  `accessibility-extra-extra-extra-large` sonrası önceki `large` geri yüklendi.
- 22 mevcut AsyncStorage dosyası hash’i değişmedi; eklenen/silinen dosya yok
  (`qa/practice/storage-comparison.json`). Başarılı içerik “Evet” yanıtı ve
  app restart dahil; bütün dosyalar byte-for-byte aynı. Kalıcı Practice key,
  MasturbationSession veya Content-Free olayı oluşturulmadı.
- 31 PNG: 7 HTML + 24 native. Kaynak pikseller korunur; boyut/SHA envanteri vardır.
  Galeri yazımı Metro’nun yenileme bandını iki ara capture’a soktuğundan final
  normal/büyük capture’lar workspace’e yazmadan geçici dizinde tekrar alındı.
  Normal clean flow her screenshot öncesi “Refreshing” yokluğunu doğrular;
  final PNG’lerde bandın renk/piksel kontrolü de yapıldı. Önceki overlay kareleri
  final galeride kullanılmaz.
- `git diff --check` ve yeni text dosyalarının no-index whitespace kontrolü geçti.
  Text-only patch reverse-apply check ile mevcut çalışma ağacına karşı doğrulanır;
  PNG ve ham Maestro artefact’leri patch dışında teslim edilir.

Android Simulator, gerçek cihaz, canlı OS Reduced Motion toggle ve insan
VoiceOver turu çalıştırılmadı. Bu sınırlar UI/interaction teslimini üretim
persistence veya klinik doğrulama olarak sunmaz. 11.7.2 için üretim erişimi/Reset,
izinler, kayıt/draft yaşam döngüsü, soru koşulları, sayaç yan etkileri, intro flag,
düzenleme/silme/undo ve migration kararı ayrı checklist’te bekliyor.


## 14 Ekim 2026 — Son iki görsel/erişilebilirlik düzeltmesi

Ürün kodunda yalnız `PracticePreviewScreen.tsx` içindeki iki JSX bölgesi değişti:

1. Normal başlık metni aynı kaldı; `fark\u00a0et` bölünmeyen boşlukla aynı
   satırda tutulur. Büyük fontta ilk kelime “Artışı” olarak kısaltılır:
   “Artışı daha erken fark et”. “Yükselişi daha erken fark et” erişilebilir
   başlık etiketi her boyutta korunur. Başlıkta font scaling kapatılmadı veya
   font büyümesine tavan konmadı. En büyük metinde doğal kaydırma devam eder.
2. `1 · Zayıf` ve `10 · Tam` normal boyutta yatay, büyük boyutta boşlukla alt alta
   yerleşir. Metinler kendi genişliğine sığar; 1–10 gerçek seçenekleri ve seçim
   handler’ları aynı kalır. Bu düzeltme başka başlık/ölçeklere uygulanmadı.

`01`, `15`, `19` ve normal kalite ekranı `06/06b` yeniden çekildi. `15b` büyük
başlığın devamını gösterir. Güncel galeri 32 PNG (7 HTML + 25 native) içerir.
Önceki beş kare, önceki hash envanteri ve QA raporu
`qa/practice/previous-review-final-visual/` altında değiştirilmeden korundu.
Galeri önce/sonra karşılaştırmalarını sunar. PNG pikselleri düzenlenmedi.

Doğrulama: typecheck, Practice runtime/UI/motion, navigation, persistence ve
persistence-acknowledgement geçti. Normal `large` ve en büyük
`accessibility-extra-extra-extra-large` Simulator koşuları geçti; iki uç etiketi
aynı kadrajda görsel olarak kontrol edildi. QA scroll hedefinin erişilebilirlik
bounds’u taşınca yalnız capture konumu ayarlandı. Başlık başlangıcı `15`, doğal
kaydırmadaki tam “erken / fark et” devamı `15b` karesinde görülür. Tüm loglar
`qa/practice/final-visual-*.log`, sonuçlar `final-visual-test-results.json` içindedir.
Tekrar çalıştırmak için `.maestro/practice-final-visual-{normal,largest}.yaml`
kullanılır; büyük metin koşusundan sonra önceki `large` boyutu geri yüklendi.

Mevcut 22 AsyncStorage dosyası byte-for-byte aynı kaldı; eklenen, silinen veya
hash’i değişen dosya yok (`final-visual-storage-comparison.json`). Bütün `src/` ve
`app/` dosyalarının önce/sonra hash denetiminde yalnız ekran bileşeni değişti.
Runtime/timer/handler bölümü ayrıca birebir karşılaştırıldı
(`final-visual-source-comparison.json`). Storage, diğer Bloom özellikleri,
Practice veri sınırları ve preview isolation aynen korundu.

`git diff --check`, text-only patch reverse-apply kontrolü, PNG hash’leri ve galeri
bağlantıları doğrulandı. Yalnız iki JSX düzeltmesinin yerel patch’i
`docs/patches/phase11-7-1-practice-final-visual.patch` ve mevcut tam review patch’i
güncellendi; ikisi de yayın kapsamı dışındadır. Görsel review aşamasında commit/push yapılmadı.


## 14 Ekim 2026 — Yayın öncesi doğrulama

Yerel branch `feature/product-ui-v1`; yerel HEAD ve fetch sonrası
`origin/feature/product-ui-v1` baseline’ı
`cb02862f16118521b9cfb632541e7d5787ffb465` olarak doğrulandı. Uzak branch’in
`ls-remote` sonucu da aynı baseline’ı gösterdi.

Typecheck, Practice runtime/UI/motion, navigation, persistence ve
persistence-acknowledgement yeniden çalıştırıldı; tamamı geçti.
Güncel 32 PNG’nin SHA-256 değerleri ve galerinin bütün bağlantıları doğrulandı.
Kanıtlar `qa/practice/publish-*.log` ve `publish-test-results.json` içindedir.

Yayın kapsamı onaylı Practice preview, test/Maestro akışları, gallery/capture/hash
kanıtları, mimari denetim notu, QA raporu ve 11.7.2 için yalnız öneri belgesidir.
`.local-design/`, `docs/patches/`, geçici/ara koşu dosyaları ve önceki fazın yerel
logları stage edilmez. Önceki QA kareleri ve nihai kanıtlar korunur; ara koşu logları
yerel kalır. Arşivlenmiş eski rapor, geçmiş review linklerini tarihsel kayıt olarak
korur. Phase 11.7.2 uygulaması başlatılmadı; preview izolasyonu ve veri sınırı aynı.
