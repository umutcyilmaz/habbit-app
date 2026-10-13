# Library · Simulator ve referans galerisi

[Yan yana karşılaştırmayı aç](index.html). Tarih: 2026-10-12–13; iPhone 17 Pro / iOS 26.3.
Native görüntüler 1206×2622 px (402×874 pt); offline HTML 1170×2532 px (390×844 CSS px).
Galeri görüntüleri aynı panel genişliğinde gösterir; pixel-perfect ölçüm iddiası yoktur.

| Görüntü | Doğrulanan durum |
| --- | --- |
| `01-native-library.png` | Bugün için / gerçek kategori kartları |
| `02-native-category.png` | Seks ipuçları kategorisi |
| `03-native-unread-restored.png` | Test kurulumunda önceki okundu durumu açıkça geri alındı; aynı yazıya dönüş scroll konumunu koruyabilir |
| `04-native-bookmark-reopened.png` | Reader başı; bookmark restart sonrası korunmuş |
| `05-native-article-bottom-unread.png` | Sona kaydırılmış, hâlâ okunmamış |
| `06-native-completed.png` | Açık eylem sonrası tamamlandı, konfeti ve koyu/mavi buton |
| `07-native-read-reopened.png` | Read + bookmark restart sonrası korunmuş |
| `08-native-read-undone.png` | Tamamlama geri alınmış |
| `09-native-save-failed.png` | Bookmark kaldırma doğrulanmadı; eski durable bookmark görünür |
| `10-native-retry-confirmed.png` | Aynı write retry ile doğrulandı; bookmark artık kapalı |
| `11-native-read-failed.png` | Completion kabul edildi, storage doğrulanmadı; UI hâlâ okunmamış |
| `12-native-read-card.png` | Retry/restart sonrası kartta Okundu |
| `13-native-deferred.png` | Sesler/araştırmalar henüz açık değil |
| `14-native-unknown-article.png` | Unknown/deleted article güvenli fallback |
| `15-native-unknown-category.png` | `toString` gibi katalog dışı kategori güvenli fallback |
| `16-native-home.png`, `17-native-profile.png` | Mevcut diğer tablar |
| `18-native-kegel-preserved.png` | İki gerçek set / 20 tekrar restart sonrası |
| `19-native-home-save-guard.png` | Mevcut Tracking storage hatası, tab kilidi ve retry |
| `20-native-sleep-category.png`, `21-native-sleep-cover.png` | Kaynak luminance-mask farkını koruyan hilal ve açılmakla okunmamış kalan Sleep yazısı |

Özet halkaları ve deneme kartının dekoratif play alanı son native düzeninde
05/06/08 kareleriyle tekrar doğrulandı. 09/11 hata kareleri aynı persistence
akışının daha önceki görsel kontrolündendir; state ve guard davranışı değişmedi.

`html-home.png`, `html-article-top.png`, `html-article-bottom.png`, `html-completed.png`
supplied HTML fonksiyonları/CSS ile offline render'dır. WeasyPrint browser değildir:
SVG currentColor, radial gradient, grid, blur ve inset shadow sınırlamaları vardır.
Siyah SVG ikonları / farklı satır kırılması / eksik çerçeve kaynak tasarım kararları değildir.
Butonlar ve scroller/inset yalnız static renderer uyumluluğu için adapte edildi;
ürünün native uygulamasına HTML veya WebView eklenmedi.

Önceki fazın [gerçek Chrome Library görüntüsü](../four-tabs/html-library.png) de
kullanılabilir; featured article seçimi farklıdır. Yeni offline karşılaştırma `wave`/`pe`
içeriğini kaynak fonksiyonlarından üretir. Renk, ölçü, reader fade ve completion
state'i ayrıca `.local-design/kegel/tasarim.html` CSS'iyle kontrol edildi.

[state-audit.json](state-audit.json) diğer bütün Bloom alanlarının eşitliğini ve eski
E2E değerlerinin hash kontrolünü özetler; kullanıcı verileri veya eski payload'lar bu
klasöre kopyalanmadı. `assets-manifest.json` teslim edilen PNG'lerin SHA-256/dimensions
bilgisini içerir. Test komutları ve kararlar [QA raporunda](../../phase11-4-1-library-qa.md).


Final review (13 Ekim): [yeni karşılaştırma](index.html#final-review).
22: unavailable Pratik kartı; 23: sona kaydırılmış reader, opak sistem status bölgesi
ve devam eden fade; 24: Kegel CTA; 25: gerçek Kegel ekranı. Bu tur başlamadan önce
namespace'te 3 set / 30 tekrar vardı; egzersiz başlatılmadı. Önceki 18 numaralı
2 set / 20 tekrar görüntüsü tarihsel olarak korunur.
[Final review audit](final-review-state-audit.json) bu turun başlangıcıyla karşılaştırır.
