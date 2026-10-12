# Phase 11.3 — Dört sekme QA

2026-10-12 · `feature/product-ui-v1` · iPhone 17 Pro / iOS 26.3.

Görünür navigasyon **Ana sayfa | Library | Kegel | Profil** olarak değişti. Home mevcut
production V4 ekranıdır. Kegel `/bloom/kegel` üzerindeki gerçek persisted feature'ı kullanır;
`/debug/kegel` tab hedefi değildir. Library/Profil yalnızca native giriş yapılarıdır; içerik,
abonelik, isim, tarihçe veya istatistik uydurulmaz. Profil mevcut ayar/veri kontrollerine bağlanır.
Log, Exercises, Protect ve Progress dosyaları/deep link'leri korunur; bar içinde görünmezler.

## Guard ve veri koruması

Kegel ana ekranı ortak dört-sekmeli barı gösterir; tanıtım, egzersiz, pause ve completion
mevcut root stack içinde kalır ve bar gizlenir. Tab'dan bu stack'e geçiş, eski exit/retry/
`beforeRemove` guard'larını tab blur olayına dönüştürmez. Kegel'den diğer sekmelere `dismissTo`
mevcut tab stack'ini kullanır. Ayarlar rotalarına native, erişilebilir Geri kontrolü eklendi.

Simulator'da bir deep link'in `beforeRemove` çalışmadan ekran fokusunu değiştirebildiği
saptandı ve düzeltildi. Expo Router'ın public `withLayoutContext` köprüsüyle mevcut React
Navigation native stack/tab navigatörleri kullanılır. Router katmanı anlık accepted/durable
snapshot'larını ve mevcut `usePreventRemoveContext` kayıtlarını okur; pending-save tab
atlamalarını, ileri PUSH/NAVIGATE ve child-focus bypass'larını engeller. Normal kaldırmayı
mevcut callback'lere devreder; başlangıç redirect'i ve mevcut recovery ekranına güvenli dönüş
korunur. Kayıt kilidinde sekmelerin recovery alanı yalnız mevcut `confirmCurrentPersistence`
metodunu çağırır; domain işlemini, seansı veya kimliği tekrar oluşturmaz.

Persistence v8, v7 migration, seans şeması, workout configuration, mevcut retry controller'ı,
`usePersistenceNavigationGuard`, `bloomPersistenceRecovery` ve product entry `app/index.tsx`
görev başlangıcına göre byte düzeyinde değişmedi. Yeni dependency eklenmedi. Normal Bloom
uygulaması test için açılmadı. Mevcut normal uygulama (1 değer) ve önceki E2E/diagnostik verileri
(8 değer) son akış öncesi/sonrası SHA-256 özetleriyle eşleşti. Hiçbir veri reset/clear edilmedi.

## Doğrulama

Geçti:

```text
npm run typecheck
npm run verify:navigation
npm run verify:kegel
npm run verify:kegel:persistence
npm run verify:persistence
npm run verify:persistence-acknowledgement
npm run verify:home-ui
npm run verify:product-onboarding-ui
npm run verify:reset-continuity
npm run verify:e2e-runtime
npm run verify:release-debug-guards
npm run verify:guided-flows
npm run verify:journey
npm run verify:protection-reset
git diff --check
```

`.maestro/four-tabs.yaml` final akışı geçti: dört tab / eski tabların yokluğu, Profil → Gizlilik →
Geri, Kegel tanıtımı → ilk gerçek egzersiz → pause/resume → kayıt → Library, restart, yarıda çıkış,
ikinci set kayıt hatası → swipe ve Library deep link'inin engellenmesi → aynı kayıtla Retry →
Profil → restart. **İki benzersiz seans / 20 tekrar**, gerçek onboarding, günlük 2 set / haftada 1
gün / seri 1 korundu. Home Tracking etkinleştirmesinde ayrı bir QA write-failure enjekte edildi:
tab geçişi engellendi, mevcut Tracking Retry sonrası açıldı. Bu işlem yalnız yeni QA Tracking
flag'ini açtı; Tracking tamamlanan oturum geçmişi boş, Content-Free/Reset inactive kaldı.

Final namespace: `bloom.e2e.kegel.qa_phase113_guarded_20261012_91be.`. İlk tanısal akışın iki
seansı mevcut current-confirmation recovery ile saklandı ve ayrı namespace'te korundu.
Native geri başlığı ilk denemede uyumsuz `statusBarStyle` seçeneği nedeniyle hata verdi;
seçenek kaldırıldı, Info.plist/global native yapılandırma değiştirilmedi. Son akış bu haliyle geçti.

Ek read-only kontrol Settings → Geri ve eski Log/Protect/Exercises deep link'lerini doğruladı.
Eski Maestro dosyalarında kaldırılan tab tıklamaları deep link ile değiştirildi; bu tarihsel tam
akışlar burada yeniden çalıştırılmadı. Yeni faz akışı ve mevcut unit/regresyonlar çalıştırıldı.

## Görsel karşılaştırma ve kapsam sınırı

[HTML/native görüntüler](qa/four-tabs/README.md): HTML, `.local-design/kegel/` klasörü localhost
HTTP üzerinden Chrome'da gerçekten render edilerek yakalandı. CSS'in son dört-tab override'ı
esas alındı: 24px ikon, 11px etiket, beyaz active / `#6c6c73` inactive, 62pt içerik + gerçek cihaz
alt safe-area inset'i. Reduced Motion ikon press/screen fade animasyonlarını kapatır.

Native bar dependency eklememek için opaque `#0e0e10`; HTML'deki backdrop blur yok.
İkonlar native View geometrisiyle yaklaşık çizilir; Archivo yerine mevcut Inter kullanılır.
Profil gear glyph'i Simulator'da eksik render edildiğinden native geometriyle düzeltildi.
Kegel'in onaylı sis/halka yaklaşımı ve close kontrolü korunur. Home mevcut V4 görünümündedir;
Library/Profil'in full HTML içerik/aggregate/subscription tasarımı bu fazın kapsamı değildir.
Eski ayar ekranları light/İngilizce görünümünü korur; yalnız geri navigasyonu eklenmiştir.
Android/iPad/Dynamic Type/gerçek cihaz bu fazda doğrulanmadı. Bloke eden kalan sorun yok.

## Yeniden üretme

Yeni 8–80 karakterli QA run adı kullanın; mevcut namespace'i temizlemeyin:

```sh
EXPO_PUBLIC_KEGEL_QA_RUN=qa_yeni_benzersiz_run npm run start:e2e:kegel:persistence
xcrun simctl openurl booted 'tms-e2e://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8082'
maestro test .maestro/four-tabs.yaml
```

[Metin review yaması](patches/phase-11-3-four-tabs.patch) yalnız Phase 11.3 delta'sıdır;
incelenmiş Phase 11.2 persistence + son UX düzeltmelerini içeren görev başlangıcı çalışma
ağacına uygulanır. PNG, screenshot galerisi ve önceki review yamaları dahil değildir.
Başlangıç ağacının geçici kopyasına check/apply ve birebir içerik karşılaştırması yapılmıştır.
Commit/push yapılmadı.

## Bu fazda değişen dosyalar

- `.maestro/check-in-save.yaml`
- `.maestro/protection-setup.yaml`
- `.maestro/reset-complete.yaml`
- `app/(tabs)/_layout.tsx`
- `app/_layout.tsx`
- `app/bloom/kegel.tsx`
- `docs/bloom-html-implementation-plan.md`
- `package.json`
- `scripts/verify-bloom-kegel.cjs`
- `src/constants/navigation.ts`
- `src/features/kegel/screens/KegelFeatureScreen.tsx`
- `.maestro/four-tabs.yaml`
- `app/(tabs)/kegel.tsx`
- `app/(tabs)/library.tsx`
- `app/(tabs)/profile.tsx`
- `docs/phase-11-3-four-tabs-qa.md`
- `scripts/verify-bloom-four-tabs.cjs`
- `src/features/library/screens/LibraryEntryScreen.tsx`
- `src/features/profile/screens/ProfileEntryScreen.tsx`
- `src/shared/navigation/BloomBottomNavigation.tsx`
- `src/shared/navigation/BloomGuardedNavigators.tsx`
- `src/shared/navigation/BloomNestedBackButton.tsx`
- `src/shared/navigation/BloomTabRecoveryScreen.tsx`
- `src/shared/navigation/BloomTabsBar.tsx`
- `src/shared/navigation/bloomTabNavigation.ts`
- `src/shared/navigation/guardBloomNavigation.ts`

Görsel kanıtlar ayrıca `docs/qa/four-tabs/` içindedir; patch artifact: `docs/patches/phase-11-3-four-tabs.patch`.
