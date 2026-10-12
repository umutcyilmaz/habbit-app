# Phase 11.3 — HTML / native karşılaştırması

HTML mock değerleri yalnız tasarım referansıdır. Native ekranlar izole E2E namespace'inin
gerçek kayıtlarını gösterir. Normal Bloom veya önceki QA verileri temizlenmedi.

| Sekme | Render edilen HTML | Native |
| --- | --- | --- |
| Ana sayfa | [HTML](html-home.png) | [V4 Home](01-native-home.png) |
| Library | [HTML](html-library.png) | [Minimal giriş](02-native-library.png) |
| Kegel | [HTML](html-kegel.png) | [İlk açılış](04-native-kegel-initial.png) |
| Profil | [HTML](html-profile.png) | [Minimal giriş](03-native-profile.png) |

Diğer native durumlar:

- [Onaylı completion](05-native-completed.png)
- [İlk yeniden açılış](06-native-kegel-reopened.png)
- [Hata sırasında engellenen swipe/deep link](07-native-guarded-save.png)
- [İkinci yeniden açılış: 2 set / 20 tekrar](08-native-two-sessions.png)
- [Home kayıt hatasında engellenen sekme geçişi](09-native-home-save-guard.png)

[QA sonuçları ve değişen dosyalar](../../phase-11-3-four-tabs-qa.md).
