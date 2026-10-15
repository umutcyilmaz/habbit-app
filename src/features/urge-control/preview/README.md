# Zor An — Phase 11.8.1 QA preview

`npm run start:e2e:urge-preview` (Metro 8084), ardından E2E uygulamasında
`tms-e2e:///debug/urge-control`. Gate: development + E2E mode + E2E bundle +
`EXPO_PUBLIC_URGE_PREVIEW=1`. Üretimde `/` yönlendirmesi vardır; normal ürün
menülerinden bağlantı verilmez. Ekran açıkça QA / kaydedilmez etiketi taşır.

Kök provider bu opt-in build boyunca yeni bellek runtime'ı kullanır. Diskteki
canonical veya eski QA kayıtları yüklenmez/migrate edilmez; başka bir retained
route da cihaz kaydı doğrulaması alamaz. Bu build ile üretim akışına kayıt
entegrasyonu denenmez. Normal flag kapalı uygulamanın runtime'ı değişmez.

`urgePreviewTimer.ts` scheduler/React/domain/storage bağı olmayan geçici modeldir.
Start açık eylemdir; pause, background, focus loss ve exit dialog süreyi dondurur.
Foreground ve dialog cancel sonrasında açık Resume gerekir. Unmount temizliği
interval, AppState, BackHandler, Reduced Motion ve animasyonları kapatır.
Restart başlangıç ekranıdır; schema veya session kaydı yoktur.

`?fixture=completion` yalnız gate arkasında etiketli, açık Başlat gerektiren
2 saniyelik QA denemesidir; kullanıcı presetine veya gerçek olaya dönüşmez.
5/10/15/20 dk gerçek presetlerin tamamı deterministik saat testinde sınanır.

`npm run verify:urge-preview` gerçek timer, ekran handler'ları, lifecycle,
animasyon ve izolasyon testlerini çalıştırır. Native Maestro akışları
`.maestro/urge-preview*.yaml` altındadır. Testler clearState/uninstall kullanmaz.

[QA raporu](../../../../docs/phase11-8-1-urge-ui-qa.md) ·
[Entegrasyon önerisi](../../../../docs/phase11-8-2-urge-integration-proposal.md)
