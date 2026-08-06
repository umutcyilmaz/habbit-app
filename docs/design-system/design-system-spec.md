# BLOOM / URGE CONTROL — DESIGN SYSTEM SPEC **v2**

> **Sürüm:** v2 · **Önceki:** v1
> **Bu sürüm, "Bloom V4 Design System Revizyon ve Eksik Listesi" dokümanındaki 31 talebin tamamına yanıt verir.**
> Değişiklik özeti için bkz. **Bölüm 9 — Revizyon karşılama tablosu**.
>
> Tüm değerler Figma dosyasından programatik olarak çıkarılmıştır; tahmin yoktur.
> Spec, `design-tokens.json` ve Figma dosyası birbirini doğrular (bkz. `validation-report.md`).

---

## 0. TEMEL KARARLAR (kod yazmadan önce okunacak)

### 0.1 Ölçü birimi politikası — *revizyon #4*

> **1 Figma px = 1 React Native logical unit = iOS'ta 1 pt = Android'de 1 dp.**
> Fiziksel device pixel **kullanılmaz**. `PixelRatio` ile dönüşüm **yapılmaz**.

Bu belgedeki **tüm** spacing, size, radius, typography ve component ölçüleri logical layout unit'tir.
Belgede "px" ve "pt" geçen her yer bu tanıma eşittir — ayrı bir birim değildir.

### 0.2 Referans ekran ve içerik genişliği — *revizyon #1*

```
Reference viewport width : 402
Horizontal padding       : 24 each side   (spacing/layout/screen-x)
Resolved content width   : 354            (402 − 24 − 24)
```

v1'deki **376 değeri hatalıydı** ve bu hesapla uyuşmuyordu. v2'de **tüm tam-genişlik componentleri 354'e çekilmiştir.**
354 bir *çözümlenmiş örnek*tir, sabit değil — componentler `Fill container` davranışındadır.

**Yarım kolon kuralı:** `(354 − 10 gap) / 2 = 172` → Stat Card 172.

### 0.3 Boyutlandırma davranışı — *revizyon #2, #5*

Her component için **Width behavior** ve **Height behavior** zorunlu alandır. Sayısal değer yalnızca 402 referans ekranındaki çözümdür.

| Davranış | Anlamı | React Native karşılığı |
|---|---|---|
| **Fill container** | Ebeveyn genişliğini doldurur | `width: '100%'` veya `flex: 1` |
| **Hug content** | İçeriğe göre büyür | intrinsic — genişlik/yükseklik verilmez |
| **Fixed** | Sabit ölçü | `width: N` / `height: N` |
| **Min-height** | Alt sınır, içerik büyütebilir | `minHeight: N` |

> **Kural:** Metin taşıyan her yüzey **Hug height + min-height** kullanır. Sabit yükseklik yalnızca metin taşımayan kontrollerde (Toggle, Progress Bar, Icon Button) geçerlidir.
> Bu, Dynamic Type ve çeviri durumunda metnin kesilmemesini garanti eder.

### 0.4 Safe area ve sistem barları — *revizyon #6*

| Alan | Kural |
|---|---|
| Status bar style | `light-content` (koyu tema) |
| Top safe-area | Top App Bar'ın **üstüne** eklenir; app bar görsel yüksekliği 56 sabit kalır → `rendered = 56 + topInset` |
| Bottom safe-area | Bottom Navigation'ın **altına** eklenir → `rendered = 68 + bottomInset` |
| Android navigation bar | `color/bg/surface` (#1C1C1E), ikonlar açık |
| Home indicator | Bottom Navigation zemini indicator alanına kadar uzar; içerik uzamaz |
| Scroll içeriği | Alt sınır = `nav-clearance (88) + bottomInset` |

> Referans ekran 402×874, safe-area **hariç** içerik alanıdır.

### 0.5 Kopya (copy) ve localization — *revizyon #11*

> **Hiçbir shared component kullanıcı metnini hard-code etmez.**

Bu belgedeki `"Start Check-in"`, `"Please wait…"`, `"Try again"` gibi tüm İngilizce metinler **yalnızca örnektir**.
Figma'da placeholder olarak `{label}`, `{value}`, `{emptyTitle}` biçiminde yazılmıştır.

```ts
type ButtonProps = {
  label: string;              // zorunlu, dışarıdan
  loadingLabel?: string;      // verilmezse mevcut label korunur, opacity düşer
};
```

**Loading davranışı kararı:** `loadingLabel` verilmezse **mevcut label korunur**, yanına spinner eklenir. Label boşaltılmaz (layout zıplamasın diye).

---

## 1. ENVANTER

| Katman | Adet |
|---|---|
| Primitive renk değişkeni | 55 |
| Semantic renk değişkeni | **48** (bg 13 · text 15 · border 11 · action 5 · accent 4) |
| Spacing değişkeni | 18 (9 ölçek + 9 layout rolü) |
| Radius değişkeni | 7 |
| Size değişkeni | **25** |
| Motion değişkeni | **9** |
| **Toplam değişken** | **162** |
| Text style | **17** |
| Effect (shadow) style | 6 |
| Component set | 11 |
| Tekil component | **17** (4'ü pattern) |
| Toplam varyant | **87** |

> *revizyon #16, #27:* Bu sayılar Figma, spec ve JSON'da **birebir aynıdır** ve her export'ta `validation-report.md` ile doğrulanır.
> v1'de "50 semantic" yazıyordu; 2 deprecated token kaldırıldığı için doğru sayı **48**'dir.

---

## 2. FOUNDATIONS

### 2.1 Primitive palette

Tasarımda **doğrudan kullanılmaz** — Figma'da `scopes: []` ile picker'dan gizlidir.

#### Neutral
| Token | HEX | | Token | HEX |
|---|---|---|---|---|
| neutral/975 | #0B0B0C | | neutral/500 | #666666 |
| neutral/950 | #111111 | | neutral/450 | #767C85 |
| neutral/925 | #161618 | | **neutral/430** | **#81858C** |
| neutral/900 | #1C1C1E | | neutral/400 | #8A9099 |
| neutral/875 | #222222 | | neutral/300 | #A0A0A0 |
| neutral/850 | #272729 | | neutral/200 | #E0E0E0 |
| neutral/800 | #2A2A2A | | neutral/100 | #F0F0F0 |
| neutral/775 | #2F2F2F | | neutral/0 | #FFFFFF |
| neutral/750 | #333333 | | | |
| neutral/700 | #424242 | | | |
| neutral/600 | #555555 | | | |

#### Blue / Green / Red / Amber
| Token | HEX | | Token | HEX |
|---|---|---|---|---|
| blue/900 | #12173A | | green/700 | #1E7A38 |
| blue/700 | #1A2050 | | green/500 | #34C759 |
| blue/600 | #0044CC | | green/300 | #7BE095 |
| blue/500 | #2B4AFF | | red/700 | #C0261C |
| blue/400 | #3D5CE6 | | red/500 | #FF453A |
| blue/300 | #5B8FDF | | red/300 | #FF8F87 |
| blue/200 | #8FB3EC | | amber/900 | #2A1F10 |
| blue/100 | #C3D6F5 | | amber/600 | #B85E22 |
| base/black | #000000 | | amber/500 | #E07030 |
| | | | amber/400 | #E0A060 |
| | | | amber/300 | #F0C08A |

#### Alpha
`white-05/08/12/30/60/82` · `blue-22/35/45` · `green-15/30` · `red-12/30` · `amber-30` · `black-40/60`
(değerler için bkz. `design-tokens.json` → `primitives.alpha`)

---

### 2.2 Semantic tokens (mod: `Dark`)

#### Background / Surface — 13
| Token | Alias | Değer | Kullanım |
|---|---|---|---|
| bg/canvas | neutral/950 | #111111 | Ekran zemini |
| bg/surface | neutral/900 | #1C1C1E | Kart, satır yüzeyi |
| bg/surface-raised | neutral/875 | #222222 | Hero kart, sheet, modal |
| bg/surface-elevated | neutral/800 | #2A2A2A | Input, chip, ikon rozeti |
| bg/surface-hover | neutral/775 | #2F2F2F | Hover / pressed yüzey |
| bg/surface-sunken | neutral/975 | #0B0B0C | Girintili alan |
| bg/inverse | neutral/0 | #FFFFFF | Ters kontrast yüzey |
| bg/overlay | alpha/black-60 | #000 60% | Modal/sheet perdesi |
| bg/accent-subtle | alpha/blue-22 | #3D5CE6 22% | Vurgulu seçili yüzey |
| bg/success-subtle | alpha/green-15 | #34C759 15% | Başarı zemini |
| bg/danger-subtle | alpha/red-12 | #FF453A 12% | Hata zemini |
| bg/warning-subtle | amber/900 | #2A1F10 | Uyarı zemini |
| bg/info-subtle | blue/900 | #12173A | Bilgi zemini |

#### Action — 5
| Token | Alias | Değer |
|---|---|---|
| action/primary | blue/500 | #2B4AFF |
| action/primary-pressed | blue/600 | #0044CC |
| action/primary-disabled | neutral/800 | #2A2A2A |
| action/secondary | neutral/800 | #2A2A2A |
| action/secondary-pressed | neutral/775 | #2F2F2F |

> *revizyon #15:* v1'deki `color/bg/accent` ve `color/bg/accent-pressed` **kaldırıldı**. 17 kullanım otomatik olarak `action/*`'a remap edildi. Canonical isim `action/*`'tır; v2 export'unda deprecated token **yoktur**.

#### Accent — 4
`accent/primary` blue/500 · `accent/success` green/500 · `accent/warning` amber/500 · `accent/danger` red/500

#### Text — 15
| Token | Alias | Değer | Ne zaman |
|---|---|---|---|
| text/primary | neutral/0 | #FFFFFF | Başlık, ana metin |
| text/primary-soft | neutral/100 | #F0F0F0 | Yumuşatılmış başlık |
| text/secondary | neutral/400 | #8A9099 | **Okunması beklenen** açıklama metni |
| text/tertiary | neutral/300 | #A0A0A0 | Üçüncül metin |
| **text/muted** | **neutral/430** | **#81858C** | **Taranan, okunması beklenmeyen** meta bilgi |
| text/disabled | neutral/600 | #555555 | Pasif metin (WCAG muaf, bkz. 6.2) |
| text/on-primary | neutral/0 | #FFFFFF | Ana buton üstü |
| text/on-inverse | neutral/950 | #111111 | Beyaz yüzey üstü |
| text/accent | blue/300 | #5B8FDF | Vurgulu metin |
| text/link | blue/300 | #5B8FDF | Bağlantı |
| text/success | green/500 | #34C759 | Başarı |
| text/danger | red/300 | #FF8F87 | Hata |
| text/warning | amber/400 | #E0A060 | Uyarı |
| text/info | blue/200 | #8FB3EC | Bilgi |
| text/on-accent | neutral/0 | #FFFFFF | Aksan yüzey üstü |

> *revizyon #28:* v1'de `text/secondary` ve `text/muted` aynı değere (neutral/400) bağlıydı. v2'de `muted` **neutral/430 (#81858C)** ile ayrıştırıldı — hâlâ 4.5:1'i geçer (4.59:1) ama secondary'den görsel olarak ayrılır.
> **Seçim kuralı:** kullanıcının *okumasını* beklediğiniz açıklama → `secondary`. *Taramasını* beklediğiniz etiket/meta/zaman damgası → `muted`.

#### Border — 11
`subtle` alpha/white-05 · `default` neutral/800 · `strong` neutral/750 · `muted` neutral/600 · `selected` alpha/white-30 · `focus` alpha/blue-45 · `accent` alpha/blue-35 · `success` green/500 · `danger` red/500 · `warning` amber/400 · `info` blue/400

---

### 2.3 Typography — 17 rol

> *revizyon #8:* `Editorial/Title` (Playfair Display) **kaldırıldı**. Üründe kullanılmıyordu; font bundle'ı ve bakım yükü gereksizdi. Ürün UI'ında serif başlık **yoktur**.

#### *revizyon #7:* Gerçek font kaynakları (Expo / `@expo-google-fonts`)

| Paket | Yüklenecek weight'ler |
|---|---|
| `@expo-google-fonts/inter` | `Inter_400Regular`, `Inter_500Medium`, `Inter_600SemiBold`, `Inter_700Bold` |
| `@expo-google-fonts/jetbrains-mono` | `JetBrainsMono_400Regular`, `JetBrainsMono_500Medium`, `JetBrainsMono_800ExtraBold_Italic` |

> **4 Inter + 3 JetBrains Mono = 7 font dosyası.** Synthetic bold/italic kullanılmaz — italic ve ExtraBold gerçek dosyalardan gelir.

| Rol | fontFamily (kodda) | Size / LH | LS | Case | Kullanım |
|---|---|---|---|---|---|
| Display | `Inter_700Bold` | 24 / 32 | 0 | — | Hero / onboarding başlığı, ekran başına 1 |
| Heading/1 | `Inter_700Bold` | 20 / 28 | 0 | — | Birincil ekran başlığı, ekran başına 1 |
| Heading/2 | `Inter_600SemiBold` | 17 / 25.5 | 0 | — | İkincil / sonuç başlığı |
| Title | `Inter_600SemiBold` | 16 / 24 | 0 | — | Bölüm, soru, kart başlığı |
| Title/Small | `Inter_600SemiBold` | 14 / 20 | 0 | — | Liste ve ayar satırı başlığı |
| Body/Large | `Inter_400Regular` | 16 / 24 | 0 | — | Öne çıkan paragraf |
| Body | `Inter_400Regular` | 14 / 21 | 0 | — | Varsayılan gövde |
| Body/Small | `Inter_400Regular` | 13 / 19.5 | 0 | — | Yardımcı açıklama |
| Label | `Inter_600SemiBold` | 14 / 20 | 0 | — | Buton etiketi |
| Label/Small | `Inter_500Medium` | 12 / 18 | 0 | — | Chip, rozet |
| Label/Nav | `Inter_500Medium` | 10 / 15 | 0 | — | Bottom nav etiketi |
| Caption | `JetBrainsMono_400Regular` | 11 / 16.5 | 0 | — | Meta, ölçek ucu |
| Mono/Body | `JetBrainsMono_400Regular` | 12 / 18 | 0 | — | Teknik açıklama |
| Mono/Label | `JetBrainsMono_500Medium` | 13 / 19.5 | 0 | — | Değer chip'i, süre |
| Overline | `JetBrainsMono_500Medium` | 10 / 15 | 0.5 | **UPPER** | Kategori üst etiketi |
| Numeric/Timer | `JetBrainsMono_800ExtraBold_Italic` | 32 / 40 | 0 | — | Geri sayım |
| Numeric/Value | `JetBrainsMono_500Medium` | 20 / 28 | 0 | — | Metrik değeri |

---

### 2.4 Spacing

#### Temel ölçek — 4 tabanlı
`3xs 2` · `2xs 4` · `xs 8` · `sm 12` · `md 16` · `lg 20` · `xl 24` · `2xl 32` · `3xl 48`

#### Layout rolleri
| Token | Değer | Kullanım |
|---|---|---|
| layout/screen-x | 24 | Ekran sol/sağ kenarı — **tüm ekranlarda sabit** |
| layout/section-gap | 28 | Ana bölümler arası |
| layout/card-padding | 16 | Standart kart içi (hero 24) |
| layout/card-gap | 12 | Kartlar arası |
| layout/form-gap | 12 | Form alanları arası |
| **layout/list-gap** | **12** | Liste satırları arası |
| layout/inline-gap | 8 | İkon–metin, chip–chip |
| layout/sheet-padding | 20 | Modal / sheet içi |
| layout/nav-clearance | 88 | Bottom nav üstü minimum alan |

> *revizyon #30:* **Kural: layout rolleri de 4'ün katı olmak zorundadır.**
> v1'deki `list-gap: 10` bu kuralı ihlal ediyordu → **12**'ye çekildi.
> `section-gap: 28` kuralı **ihlal etmez** (28 = 4×7); temel ölçekte listelenmemesi bir istisna değil, yalnızca ölçeğin 24→32 arasında bir adım içermemesidir. Bu değer bilinçli bir layout rolüdür.
> **Yeni ekranda keyfi ara değer üretilmez** — ölçekte veya layout rollerinde olmayan bir boşluk kullanılmaz.

---

### 2.5 Radius

| Token | Değer | Component |
|---|---|---|
| radius/xs | 3 | İnce dekoratif göstergeler |
| radius/sm | 8 | Chip, Value Chip, Stepper, Scale Cell, skeleton |
| radius/md | 11 | Küçük durum kartı |
| radius/lg | 14 | Button, Input, Card (standard), Option Row, Setting Row, List Row, Alert Card, Stat Card, **Toggle** |
| radius/xl | 16 | Panel, gruplanmış blok |
| radius/xxl | 24 | Hero Card, Modal, Bottom Sheet (üst köşeler) |
| radius/pill | 9999 | Icon Button, status pill, avatar, **Progress Bar (track + fill)** |

> *revizyon #18:* v1'de token mapping "progress → radius/xs (3)" derken component 4 kullanıyordu. v2'de **Progress Bar tamamen `radius/pill`** kullanır (H8 → görsel sonuç 4). Tek kaynak, tek değer.
> *revizyon #17:* Toggle'ın literal `14` değeri artık `radius/lg` tokenına bağlıdır.

---

### 2.6 Size — 25 token

> *revizyon #17:* v1'de literal kalan tekrarlayan ölçüler tokena taşındı.
> **Kural:** bir ölçü **iki veya daha fazla** yerde aynı rolle geçiyorsa token olmak zorundadır. Tek seferlik dekoratif ölçüler literal kalabilir.

| Grup | Token | Değer |
|---|---|---|
| İkon | `icon/xs` 16 · `icon/sm` 20 · `icon/md` 24 · `icon/lg` 28 | |
| Dokunma | `touch/min` **44** | WCAG minimum |
| Kontrol | `control/xs` **34** (görsel daire) · `control/sm` 44 · `control/md` 52 · `control/lg` 58 | |
| Rozet | `badge/sm` **38** (setting row) · `badge/md` **52** (modal) · `badge/lg` **62** (ekran durumu) | |
| Toggle | `toggle/width` **46** · `toggle/height` **27** · `toggle/knob` **21** | |
| Diğer | `radio` **20** · `chip` 34 · `scale-cell/width` **46** · `scale-cell/height` **34** | |
| Sheet | `grabber/width` **40** · `grabber/height` **4** | |
| Stroke | `stroke/hairline` 1 · `stroke/icon` 1.6 | |
| Özel | `ring/timer` 212 · `progress/height` 8 | |

---

### 2.7 Shadows — platform eşlemesi *(revizyon #19, #20)*

Figma değerleri **kaynak**tır; platform karşılıkları **görsel hiyerarşiyi** korumak içindir, birebir teknik eşitlik aranmaz.

| Token | Figma | iOS (RN shadow props) | Android (`elevation`) | Web (`box-shadow`) |
|---|---|---|---|---|
| shadow/none | — | — | 0 | `none` |
| shadow/subtle | drop 0/1/2 · #000 30% | `shadowColor:'#000', shadowOffset:{0,1}, shadowOpacity:0.30, shadowRadius:2` | 1 | `0 1px 2px rgba(0,0,0,.30)` |
| shadow/card | drop 0/1/3 · #000 40% | `…{0,1}, 0.40, 3` | 2 | `0 1px 3px rgba(0,0,0,.40)` |
| shadow/floating | drop 0/1/4 · #000 30% | `…{0,1}, 0.30, 4` | 4 | `0 1px 4px rgba(0,0,0,.30)` |
| shadow/modal | drop 0/**−4**/24 · #000 60% | `…{0,-4}, 0.60, 24` | 16 | `0 -4px 24px rgba(0,0,0,.60)` |
| shadow/inset-field | inner 0/2/2.9 · #000 25% | **kullanılmaz** — bkz. aşağıdaki karar | — | `inset 0 2px 2.9px rgba(0,0,0,.25)` |

> **Android notu:** `elevation` gölge rengini ve offset'ini kontrol etmez. Koyu temada elevation gölgesi neredeyse görünmezdir — bu kabul edilebilir. Yüzey ayrımı **öncelikle kenarlıkla** kurulmuştur, gölge yalnızca destektir.

#### *revizyon #20:* `inset-field` React Native kararı

> **KARAR: V4'te inner shadow kullanılmayacak.**
> React Native native inner shadow desteklemez. Ek paket/SVG çözümü V4 kapsamı dışıdır.
>
> **Onaylanan görünüm:** `backgroundColor: bg/surface-elevated` + `borderWidth: 1, borderColor: border/strong`.
> Input'un yüzeyden çukur görünmesi bu iki katmanla sağlanır. Geliştirici kendi başına yöntem seçmez.
> `shadow/inset-field` tokenı web/Figma referansı olarak korunur, RN theme'ine **export edilmez**.

---

### 2.8 Motion — 9 token *(revizyon #21)*

| Token | Değer | Kullanım |
|---|---|---|
| motion/duration/instant | 0 | Anında; reduced-motion fallback |
| motion/duration/fast | 120 ms | Pressed/hover state, toggle knob, chip seçimi |
| motion/duration/standard | 220 ms | Genel state geçişi, alert giriş/çıkış, progress fill |
| motion/duration/slow | 320 ms | Modal açılış/kapanış, skeleton shimmer döngüsü |
| motion/duration/sheet | 280 ms | Bottom sheet slide + detent geçişi |
| motion/easing/standard | `cubic-bezier(0.2, 0, 0, 1)` | Varsayılan |
| motion/easing/decelerate | `cubic-bezier(0, 0, 0, 1)` | Giriş (açılan sheet/modal) |
| motion/easing/accelerate | `cubic-bezier(0.3, 0, 1, 1)` | Çıkış (kapanan sheet/modal) |
| motion/reduced-motion/policy | *(aşağıda)* | — |

#### Component → motion eşlemesi
| Component | Duration | Easing |
|---|---|---|
| Button / Icon Button / Chip / Scale Cell — pressed | fast | standard |
| Toggle knob | fast | standard |
| Input focus ring | fast | standard |
| Alert Card giriş/çıkış | standard | decelerate / accelerate |
| Progress Bar fill | standard | standard |
| Timer Ring arc | *animasyonsuz* — saniyede bir adım | — |
| Modal | slow | decelerate (açılış) / accelerate (kapanış) |
| Bottom Sheet | sheet | decelerate / accelerate |
| Skeleton shimmer | slow (döngü) | standard |

#### Reduced-motion politikası
`AccessibilityInfo.isReduceMotionEnabled() === true` iken:
- Tüm `duration` → **0 ms** (`motion/duration/instant`)
- `translate` ve `scale` animasyonları **kapatılır**; yalnızca **opacity crossfade** kalır
- Skeleton shimmer **durur**, statik yüzey gösterilir
- Modal/sheet **kaymadan** görünür

---

### 2.9 Icon system *(revizyon #9, #10)*

> **Kaynak: Bloom'a özel, elle çizilmiş SVG seti.** Lucide/Phosphor gibi bir kütüphane **değildir** — isim benzerliği olsa da geometriler farklıdır.
> **Teslim:** `icons/*.svg` — 20 dosya, isimlendirilmiş, bu paketle birlikte gelir.

| Özellik | Değer |
|---|---|
| viewBox | `0 0 24 24` |
| Boyut | 24×24 |
| Stroke | `1.6` (`size/stroke/icon`) |
| Cap / Join | `round` / `round` |
| Fill | `none` |
| Renk | `stroke="currentColor"` — kullanım yerinde tokena bağlanır |

**Set (20):** `alert, arrow-left, chat, check, chevron-left, chevron-right, clock, close, heart, info, lock, minus, moon, more, phone, plus, shield, shield-check, sun, timer`

> Figma `Icon` component set'indeki her `Name=` değeri, `icons/` klasöründeki aynı adlı `.svg` dosyasıyla **birebir** eşleşir.

#### Görsel boyut ≠ dokunma alanı — *revizyon #10*

> v1'de Top App Bar kontrolü 34×34 idi ve bu 44×44 kuralıyla çelişiyordu.
> v2'de ayrıştırıldı:

```
Top App Bar control:
  visualSize : 34   (size/control/xs — görünen daire)
  hitArea    : 44   (size/touch/min — şeffaf sarmalayıcı frame)
```

Figma'da `Hit Area 44` adlı şeffaf frame, 34px görsel daireyi sarar.
**Kural:** her dokunulabilir öğede hit area ≥ 44×44. Görsel daha küçük olabilir.

---

## 3. COMPONENTS

Her component için: **Width behavior · Height behavior · ölçüler · tokenlar · state matrisi**

### 3.1 Button — 20 varyant *(revizyon #23, #27)*
- **Variant:** Primary · Secondary · Ghost · **Destructive**
- **State:** Default · Pressed · Focused · Disabled · Loading
- **Width:** Fill container *(402 ref → 354)* · **Height:** Fixed 58 (Ghost 44)

| Variant | fill | border | text |
|---|---|---|---|
| Primary | action/primary → pressed: primary-pressed → disabled: primary-disabled | — | text/on-primary |
| Secondary | action/secondary → pressed: secondary-pressed | border/strong 1 | text/primary |
| Ghost | none | — | text/secondary (`Body` stili) |
| **Destructive** | bg/danger-subtle → disabled: primary-disabled | **border/danger 1.5** | text/danger |

- Ortak: `gap 8 · padding-x spacing/xl (24) · radius/lg`
- **Focused:** `border/focus 3, strokeAlign OUTSIDE` (tüm varyantlarda)
- **Loading:** 18px arc spinner + label korunur

**Destructive kullanım kuralı:** silme, sıfırlama, veri kaybı. **Daima confirmation modal ile eşleşir** — tek tıkla yıkıcı eylem yoktur. Modal içinde güvenli seçenek Primary, yıkıcı seçenek Destructive'tir (v1'de "Ghost" deniyordu, bu yetersizdi).

### 3.2 Icon Button — 9 varyant
**Width/Height:** Fixed 44×44 · radius/pill · ikon `icon/sm` (20) · disabled opacity 0.35

| Style | fill | border |
|---|---|---|
| Filled | action/primary → pressed: primary-pressed | — |
| Outline | bg/surface-elevated → pressed: surface-hover | border/strong 1 |
| Plain | none | — |

### 3.3 Input — 14 varyant *(revizyon #3, #24)*
- **Type:** Single · Multiline
- **State:** Default · Focused · Filled · Error · **Success** · **Read-only** · Disabled
- **Width:** **Fill container** *(v1'de 344 idi — Option Row/Button ile hizasızdı, düzeltildi)*
- **Height:** **Hug content**, min-height 52 (Single) / 99 (Multiline)
- `padding 12/16 · radius/lg · fill bg/surface-elevated`

| State | border | not |
|---|---|---|
| Default / Filled | border/strong 1 | |
| Focused | **border/focus 2** + caret text/accent | |
| Error | **border/danger 1.5** | + altında ikon & açıklama metni (renk tek başına yeterli değil) |
| Success | **border/success 1.5** | + onay metni |
| Read-only | border/default 1, fill **bg/surface** | imleç yok, seçilebilir |
| Disabled | border/strong 1, opacity 0.4 | |

> **Kapsam dışı:** secure/password state V4'te yoktur — üründe şifre alanı bulunmuyor. İhtiyaç doğarsa ayrı revizyon.

### 3.4 Toggle — 3 varyant
**Fixed** `toggle/width 46 × toggle/height 27` · radius/lg · knob `toggle/knob 21`
Off: bg/surface-elevated + border/strong, knob text/muted, sola hizalı ·
On: action/primary, knob text/on-primary, sağa hizalı · Disabled: opacity 0.35
> Satır içinde min 44 dokunma alanına sarılır.

### 3.5 Stepper — tekil
**Hug content** · `padding 6/8 · gap 8 · radius/sm · bg/surface-elevated · border/strong 1`
`minus` 14 (text/secondary) + değer `Mono/Label` + `plus` 14 (text/accent). Sınırda ok → text/disabled.

### 3.6 Value Chip — tekil
**Hug content** · `padding 8/12 · radius/sm · bg/surface-elevated · border/strong 1 · Mono/Label`
Salt-okunur. Tıklanacaksa Icon Button/Stepper.

### 3.7 Chip — 3 varyant
**Hug content** · `padding 8/12 · radius/sm · Label/Small` · çoklu seçim · wrap içinde `inline-gap 8`
Default: bg/surface-elevated + border/strong · Selected: bg/inverse + text/on-inverse · Disabled: opacity 0.4

### 3.8 Option Row — 3 varyant
**Fill container** · **Hug height**, min 52 · `gap 12 · padding-x 16 · radius/lg · bg/surface-elevated` · radio `size/radio 20`
Default: border/strong · Selected: **border/selected** + radio dolu action/primary · Disabled: opacity 0.4
Grup içinde tek seçim. Satır arası `list-gap 12`.

### 3.9 Scale Cell — 3 varyant
**Fixed** `scale-cell/width 46 × scale-cell/height 34` · radius/sm · `Title/Small`
Default: bg/surface-elevated + text/secondary · Selected: action/primary + text/on-primary · Highlighted: bg/inverse + text/on-inverse
0–10 ölçeği: 11 hücre, 6+5 iki satır, uçlarda `Caption` açıklama.

### 3.10 Card — 6 varyant
**Fill container** · **Hug height**

| Type | min-height | padding | radius | fill | shadow |
|---|---|---|---|---|---|
| Standard | 88 | 16 | radius/lg | bg/surface | shadow/card |
| Hero | 132 | 24 | radius/xxl | bg/surface-raised | shadow/floating |

Default: border/default 1 · Selected: **border/accent 1.5** · Disabled: opacity 0.4
Hero ekran başına 1. Kartlar iç içe geçmez.

### 3.11 Stat Card — tekil
**Fixed width 172** (yarım kolon) · **Hug height**, min 96 · `padding 12 · radius/lg · bg/surface-elevated · border/strong 1`
`Overline` + `Numeric/Value` + `/10` + delta `Caption`.
Delta ok **ve** yazı ile — renk tek başına değil.

### 3.12 List Row — tekil
**Fill container** · **Hug height**, min 66 · `padding 12/16 · gap 4 · radius/lg · bg/surface-elevated · border/default 1`
`Caption` etiket + `Body` değer + `icon/xs 16`.

### 3.13 Setting Row — tekil
**Fill container** · **Hug height**, min 82 · `padding 14/12 · gap 12 · radius/lg · bg/surface · border/default 1`
`badge/sm 38` dairesel ikon rozeti + (`Title/Small` + `Mono/Body`) + **kontrol slotu**.
Slot: Toggle | Stepper | Value Chip. Satırda tek kontrol.

### 3.14 Progress Bar — **tekil, dinamik** *(revizyon #22)*
**Fill container** · **Fixed height 8** (`progress/height`) · **radius/pill** · track bg/surface-elevated · fill action/primary

> v1'de `Progress=0/40/100` varyantları vardı — gerçek dünyada her değer için varyant üretilemez.
> v2'de **tek component**:

```ts
type ProgressBarProps = {
  progress: number;   // 0…100, kodda clamp edilir
  label?: string;     // yüzde daima metinle de verilir
};
// fillWidth = `${clamp(progress, 0, 100)}%`
```
Figma'daki %40 gösterimi yalnızca demo durumudur. Belirsiz süreli işlemde kullanılmaz.

### 3.15 Timer Ring — tekil
**Fixed 212×212** (`ring/timer`) · halka kalınlığı %12 (`innerRadius 0.88`)
Katmanlar: Track (bg/surface-elevated arc) → Progress (action/primary arc, −90° başlangıç) → Disc 176×176 @18,18 (bg/surface + border/default)
Orta: `icon/md 24` + `Numeric/Timer` + `Caption`. 212 dışında ölçeklenmez.

### 3.16 Alert Card — 4 varyant
**Fill container** · **Hug height**, min 80 · `padding 16 · gap 10 · radius/lg` · ikon `icon/sm 18` + `Title/Small` + `Body/Small`

| Tone | fill | border | metin+ikon |
|---|---|---|---|
| Info | bg/info-subtle | border/info | text/info |
| Success | bg/success-subtle | border/success | text/success |
| Warning | bg/warning-subtle | border/warning | text/warning |
| Danger | bg/danger-subtle | border/danger | text/danger |

Renk tek başına anlam taşımaz — ikon + başlık + açıklama zorunlu. Ekranda en fazla 2 alert.

### 3.17 Top App Bar — tekil
**Fill container** · **Fixed height 56** (+ top safe-area inset) · `padding-x spacing/lg (20) · gap 8 · bg/surface`
Sol: `Hit Area 44` içinde `control/xs 34` dairesel buton (ikon 18) · Orta: `Title/Small`, Fill, **CENTER** · Sağ: ikon yoksa 44×44 boş spacer.

### 3.18 Nav Item — 2 varyant
**Fixed 76×52** · `gap 4` · ikon 22 + `Label/Nav` · Inactive text/muted · Active text/accent

### 3.19 Bottom Navigation — tekil
**Fill viewport width** · **Fixed height 68** (+ bottom safe-area inset) · `space-between · padding 8/16 · bg/surface · border/default üst 1`
5 item. Üstündeki içerik `nav-clearance 88 + bottomInset` boşluk bırakır.

### 3.20 Modal — tekil *(revizyon #25)*
**Fixed width 354** · **Hug height** · `padding 24/24/20 · gap 14 · radius/xxl · bg/surface-raised · border/strong 1 · shadow/modal`
`badge/md 52` rozet → `Heading/2` + `Body` → Primary → Destructive/Ghost

**Interaction kuralları:**
| Davranış | Kural |
|---|---|
| Kapatma yolları | Backdrop tap · Android back · açık bir "Cancel/Kapat" aksiyonu |
| Yıkıcı onay modalı | Backdrop tap ve back **kapatır** (= iptal, güvenli taraf) |
| Focus | Açılışta **başlığa** taşınır; modal içinde focus trap |
| Keyboard | Modal içinde input yoksa klavye açılmaz |
| Animasyon | `duration/slow` + decelerate/accelerate |
| Accessibility | `accessibilityViewIsModal`, arka plan `importantForAccessibility="no-hide-descendants"` |

### 3.21 Bottom Sheet — tekil *(revizyon #25)*
**Fill viewport width** · **Hug height**, max %90 ekran · `padding 12/20/28 (sheet-padding) · üst köşe radius/xxl, alt 0 · bg/surface-raised · shadow/modal`
Grabber `grabber/width 40 × grabber/height 4`, radius 2, border/muted. Arkasında `bg/overlay`.

**Interaction kuralları:**
| Davranış | Kural |
|---|---|
| Detent | Tek detent (content height). Çoklu detent V4 kapsamı dışı |
| Swipe | Aşağı swipe kapatır; eşik = yüksekliğin %25'i veya velocity > 0.5 |
| Backdrop tap | Kapatır |
| Android back | Kapatır |
| Keyboard avoidance | Sheet klavye yüksekliği kadar yukarı iter (`KeyboardAvoidingView`), içerik scroll olur |
| Focus | Açılışta ilk interaktif öğeye; kapanışta tetikleyen öğeye geri döner |
| Animasyon | `duration/sheet` (280) + decelerate/accelerate |

### 3.22 Screen Header — tekil
**Fill container** · **Hug height** · `gap 8 · ortalanmış` · `Heading/1` + `Body` (text/secondary)

### 3.23 Divider — tekil
**Fill container** · **Fixed height 1** · `bg = border/default` · üst/alt `spacing/lg 20`

### 3.24 Icon — 20 varyant
Bkz. 2.9.

### 3.25–3.28 Pattern componentleri *(revizyon #26)*

> v1'de bunlar yalnızca yazılı kuraldı; v2'de **Figma'da hazır component**tir.
> **Width:** Fill container · **Height:** Hug content · `padding-x spacing/xl 24, padding-y 32` · tüm metinler property.

| Component | Yapı | Aksiyon |
|---|---|---|
| **Pattern / Empty State** | `badge/lg 62` nötr rozet (bg/surface-elevated + border/strong) + `Heading/2` + `Body/Small` | tek **Primary** |
| **Pattern / Loading State** | Skeleton blokları: `354×20`, `300×14`, `354×88` — bg/surface-elevated, radius/sm | yok; aksiyonlar disabled |
| **Pattern / Error State** | `badge/lg 62` danger rozet + `Heading/2` + `Body/Small` (+ hata kodu `Caption`) | **Secondary** "tekrar dene" |
| **Pattern / Success State** | `badge/lg 62` success rozet + `Heading/2` + `Body/Small` | tek **Primary** (sonraki adım) |

> **Kural:** yeni ekranda bu durumlar sıfırdan çizilmez, bu componentlerden türetilir.
> Loading skeleton'ın layout yüksekliği gerçek içerikle aynı olmalıdır (zıplama olmasın).

---

## 4. PATTERNS

### 4.1 Screen composition

```
[top safe-area inset]
Top App Bar              56          bg/surface
Screen Header            Hug (~78)   Heading/1 + Body
Content block            Hug
  ↕ section-gap          28
Content block            Hug
  ↕ nav-clearance        88
Bottom Navigation        68          bg/surface + üst border
[bottom safe-area inset]
```
Yatay: `screen-x 24` her iki yan → içerik **354**.

### 4.2 Top App Bar ↔ Screen Header kullanımı *(revizyon #29)*

> **Kural: her ekranda tam bir başlık katmanı vardır. İkisi birden ancak aşağıdaki durumda kullanılır.**

| Ekran tipi | App Bar | Screen Header | Başlık nerede |
|---|---|---|---|
| **Root sekme** (Today, Progress…) | ✗ | ✓ | Screen Header |
| **Push edilmiş alt ekran** | ✓ (geri butonu + başlık) | ✗ | App Bar |
| **Akış / onboarding adımı** | ✓ (yalnız geri/kapat, **başlık boş**) | ✓ | Screen Header |
| **Modal / Sheet** | ✗ | ✓ (sheet içi) | Sheet başlığı |

> İkisi birlikte kullanıldığında **App Bar başlığı boş bırakılır** — aynı metin iki kez görünmez.
> Örnek: "Night Protection Setup" ekranı → App Bar yalnız geri oku, başlık Screen Header'da.

### 4.3 Durum ekranları
Bkz. 3.25–3.28 — artık component'tir, tarif değil.

---

## 5. HANDOFF — Figma → JSON → React Native *(revizyon #12, #14)*

### 5.1 Machine-safe isimlendirme kuralı *(revizyon #14)*

> **Display name korunur, machine ID türetilir.** Dönüşüm kuralı tek ve deterministiktir:

| Kural | Örnek |
|---|---|
| `/` → nesting seviyesi | `color/bg/canvas` → `colors.bg.canvas` |
| `-` → camelCase | `screen-x` → `screenX`, `surface-elevated` → `surfaceElevated` |
| Boşluk → camelCase | `Icon Button` → `iconButton` |
| Component: `displayName` + `id` | `displayName: "Icon Button"`, `id: "iconButton"` |
| Variant property değeri | `Read-only` → `readOnly` |

Aynı token/component her export'ta **aynı** TypeScript anahtarını üretir.

### 5.2 Eşleme tablosu

| Figma değişkeni | JSON path | React Native theme path |
|---|---|---|
| `color/bg/canvas` | `semantic.bg.canvas` | `theme.colors.bg.canvas` |
| `color/bg/surface-elevated` | `semantic.bg.surfaceElevated` | `theme.colors.bg.surfaceElevated` |
| `color/action/primary` | `semantic.action.primary` | `theme.colors.action.primary` |
| `color/text/on-primary` | `semantic.text.onPrimary` | `theme.colors.text.onPrimary` |
| `color/border/focus` | `semantic.border.focus` | `theme.colors.border.focus` |
| `spacing/md` | `spacing.scale.md` | `theme.spacing.md` |
| `spacing/layout/screen-x` | `spacing.layout.screenX` | `theme.spacing.layout.screenX` |
| `radius/lg` | `radius.lg` | `theme.radius.lg` |
| `size/touch/min` | `size.touch.min` | `theme.size.touch.min` |
| `size/icon/sm` | `size.icon.sm` | `theme.size.icon.sm` |
| `motion/duration/fast` | `motion.duration.fast` | `theme.motion.duration.fast` |
| `motion/easing/standard` | `motion.easing.standard` | `theme.motion.easing.standard` |
| Text style `Heading/1` | `typography.heading1` | `theme.typography.heading1` |
| Text style `Body/Small` | `typography.bodySmall` | `theme.typography.bodySmall` |
| Effect `shadow/card` | `shadows.card` | `theme.shadows.card` |

### 5.3 Örnek theme tipi

```ts
export type Theme = {
  colors: {
    bg: { canvas: string; surface: string; surfaceRaised: string; surfaceElevated: string;
          surfaceHover: string; surfaceSunken: string; inverse: string; overlay: string;
          accentSubtle: string; successSubtle: string; dangerSubtle: string;
          warningSubtle: string; infoSubtle: string };
    action: { primary: string; primaryPressed: string; primaryDisabled: string;
              secondary: string; secondaryPressed: string };
    accent: { primary: string; success: string; warning: string; danger: string };
    text: { primary: string; primarySoft: string; secondary: string; tertiary: string;
            muted: string; disabled: string; onPrimary: string; onInverse: string;
            onAccent: string; accent: string; link: string;
            success: string; danger: string; warning: string; info: string };
    border: { subtle: string; default: string; strong: string; muted: string;
              selected: string; focus: string; accent: string;
              success: string; danger: string; warning: string; info: string };
  };
  spacing: { xs3: 2; xs2: 4; xs: 8; sm: 12; md: 16; lg: 20; xl: 24; xl2: 32; xl3: 48;
             layout: { screenX: 24; sectionGap: 28; cardPadding: 16; cardGap: 12;
                       formGap: 12; listGap: 12; inlineGap: 8; sheetPadding: 20;
                       navClearance: 88 } };
  radius: { xs: 3; sm: 8; md: 11; lg: 14; xl: 16; xxl: 24; pill: 9999 };
  size: { icon: { xs: 16; sm: 20; md: 24; lg: 28 }; touch: { min: 44 }; /* … */ };
  motion: { duration: { instant: 0; fast: 120; standard: 220; slow: 320; sheet: 280 };
            easing: { standard: string; decelerate: string; accelerate: string } };
  typography: Record<TypographyRole, TextStyle>;
  shadows: Record<ShadowRole, ViewStyle>;
};
```

### 5.4 Token formatı *(revizyon #13)*

`design-tokens.json` artık **DTCG/W3C Design Tokens** formatına yakındır:
- Semantic token'lar `$value: "{primitives.neutral.950}"` biçiminde **gerçek referans** tutar
- `$type` alanı taşır (`color`, `dimension`, `duration`, `cubicBezier`, `fontFamily`)
- Çözümlenmiş değerler **build aşamasında** üretilir; canonical dosyada iki gerçek yoktur
- Referans olmayan resolved kopya isteyenler için `resolved` bloğu ayrı tutulur ve build çıktısıdır

### 5.5 Kullanım kuralları
1. Componentlerde ham HEX kullanılmaz — yalnızca semantic token.
2. Primitive katman doğrudan kullanılmaz; Figma picker'da gizlidir (`scope: none`).
3. Yeni renk ihtiyacında önce semantic karşılık sorulur, gerekirse primitive eklenir.
4. Ölçü değişikliği ekranda değil, değişkende yapılır.
5. Component adı ve variant property'leri değiştirilmeden koda aktarılır.
6. **Bir ölçü iki yerde aynı rolle geçiyorsa tokena taşınır.**

---

## 6. ACCESSIBILITY

### 6.1 Kontrast — hesaplanmış, yarı saydam zeminler kompozitlenerek

| Ön plan | Zemin | Oran | Eşik | Sonuç |
|---|---|---|---|---|
| text/primary | bg/canvas | 18.88:1 | 4.5 | ✓ |
| text/primary | bg/surface | 17.01:1 | 4.5 | ✓ |
| text/primary-soft | bg/surface | 14.93:1 | 4.5 | ✓ |
| text/secondary | bg/surface | 5.29:1 | 4.5 | ✓ |
| text/tertiary | bg/surface | 6.51:1 | 4.5 | ✓ |
| **text/muted** | bg/surface | **4.59:1** | 4.5 | ✓ |
| **text/muted** | bg/canvas | **5.10:1** | 4.5 | ✓ |
| text/on-primary | action/primary | 5.96:1 | 4.5 | ✓ |
| text/on-primary | action/primary-pressed | 7.78:1 | 4.5 | ✓ |
| text/success | bg/success-subtle | 5.87:1 | 4.5 | ✓ |
| text/danger | bg/danger-subtle | 6.79:1 | 4.5 | ✓ |
| text/warning | bg/warning-subtle | 7.19:1 | 4.5 | ✓ |
| text/info | bg/info-subtle | 8.13:1 | 4.5 | ✓ |
| text/accent | bg/surface | 5.22:1 | 3.0 | ✓ |
| text/disabled | bg/surface | 2.28:1 | — | **muaf** ↓ |

**14/14 geçiyor + 1 muaf.**

### 6.2 `text/disabled` neden muaf?
WCAG 2.1 SC 1.4.3, **devre dışı (inactive) arayüz bileşenlerini kontrast şartından muaf tutar.**
Pasif öğenin *pasif görünmesi* gerekir; bunu kontrast yükselterek bozmak yanlış olur.
Buna karşılık disabled durum **renkle tek başına anlatılmaz**:
- zemin değişir (`action/primary-disabled`), **ve**
- opacity 0.35–0.40 uygulanır, **ve**
- RN tarafında `accessibilityState={{ disabled: true }}` verilir (ekran okuyucu duyurur).

### 6.3 Kalite kuralları

| Kural | Sistemdeki karşılığı |
|---|---|
| Min dokunma alanı 44×44 | `size/touch/min`; Icon Button 44 fixed, Top App Bar 34 görsel + 44 hit area, Ghost buton H44 |
| Görünür focus | `border/focus` 2–3px; Button ve Input `State=Focused` varyantları |
| Renk tek başına anlam taşımaz | Alert Card, Input Error/Success, Stat Card delta — hepsi ikon + metin ile |
| Büyütülmüş metin | Metin taşıyan **tüm** componentler Hug height + min-height *(revizyon #5)* |
| Disabled ayırt edilebilir | zemin + opacity + `accessibilityState` |
| Reduced motion | `motion/reduced-motion/policy` — bkz. 2.8 |
| Modal/sheet erişimi | focus trap, `accessibilityViewIsModal`, back/backdrop ile kapanır |
| Okunabilir isimlendirme | Variant property'leri sabit: `Variant`/`Type`/`State`/`Tone`/`Style`/`Name` |

---

## 7. TESLİM PAKETİ

| Dosya | İçerik |
|---|---|
| `design-system-spec.md` | Bu belge |
| `design-tokens.json` | DTCG formatında canonical token'lar + component metadata |
| `validation-report.md` | Otomatik doğrulama çıktısı *(revizyon #31)* |
| `icons/*.svg` | 20 isimlendirilmiş ikon, `currentColor`, viewBox 0 0 24 24 |
| Figma dosyası | `🎨 Design System` sayfası (dokümantasyon + component master'ları) |

---

## 8. HÂLÂ AÇIK OLANLAR

Aşağıdakiler **bilinçli olarak V4 kapsamı dışıdır** — belirsizlik değil, karardır:

| Konu | Karar |
|---|---|
| Light theme | Yok. `Color` koleksiyonunda tek mod. Eklemek gerekirse ikinci mod + aynı semantic isimlere farklı primitive alias'ı yeterli; componentler semantic'e bağlı olduğu için tek yerden döner |
| Secure/password input | Üründe şifre alanı yok; ihtiyaç doğarsa ayrı revizyon |
| Çoklu detent bottom sheet | Tek detent yeterli |
| Inner shadow (RN) | Kaldırıldı — bkz. 2.7 kararı |
| Serif / editoryal başlık | Kaldırıldı — bkz. 2.3 |
| Geniş motion library | Sadece duration + easing + reduced-motion; spring/parallax yok |

Gerçek açıklar (sonraki revizyonda ele alınmalı):

- **Timer Ring** RN'de nasıl çizilecek net değil (`react-native-svg` gerekiyor) — bağımlılık kararı verilmeli.
- **Skeleton shimmer** implementasyonu (`reanimated` vs. statik) seçilmedi; şu an statik kabul ediliyor.
- Bottom Navigation'ın **5 sekme ikonu** henüz ikon setinde ayrışmış değil (hepsi placeholder `shield` kullanıyor) — gerçek sekme ikonları çizilmeli.

---

## 9. REVİZYON KARŞILAMA TABLOSU

| # | Talep | Durum | Nerede |
|---|---|---|---|
| 1 | Referans genişlik hesabı | ✅ Düzeltildi — 354 | 0.2 |
| 2 | Width behavior Fill/Hug/Fixed | ✅ Eklendi | 0.3, 3.x |
| 3 | Input genişliği/hizalama | ✅ Fill container | 3.3 |
| 4 | Ölçü birimi politikası | ✅ Eklendi | 0.1 |
| 5 | Fixed/min-height/Hug ayrımı | ✅ Eklendi + Figma'da uygulandı | 0.3, 3.x |
| 6 | Safe area / sistem barları | ✅ Eklendi | 0.4 |
| 7 | Kesin font listesi | ✅ Expo paket adlarıyla | 2.3 |
| 8 | Playfair kararı | ✅ **Kaldırıldı** | 2.3 |
| 9 | Icon kaynağı/sürümü | ✅ Özel set + 20 SVG teslim | 2.9, `icons/` |
| 10 | Icon ölçüsü ≠ touch target | ✅ visualSize 34 / hitArea 44 | 2.9 |
| 11 | Copy sabitlenmemeli | ✅ Placeholder + props | 0.5 |
| 12 | Figma→JSON→RN eşlemesi | ✅ Tablo + theme tipi | 5.2, 5.3 |
| 13 | DTCG alias formatı | ✅ JSON yeniden yazıldı | 5.4 |
| 14 | Machine-safe isimlendirme | ✅ Kural tablosu | 5.1 |
| 15 | Deprecated token'lar | ✅ **Silindi**, 17 kullanım remap | 2.2 |
| 16 | Envanter sayıları | ✅ 48 semantic, doğrulandı | 1 |
| 17 | Literal ölçüler → token | ✅ 12 yeni size token | 2.6 |
| 18 | Progress radius | ✅ radius/pill'de tekleştirildi | 2.5 |
| 19 | Shadow platform eşlemesi | ✅ iOS/Android/web tablosu | 2.7 |
| 20 | inset-field fallback | ✅ **Karar: inner shadow yok** | 2.7 |
| 21 | Motion token'ları | ✅ 9 token + component eşlemesi | 2.8 |
| 22 | Dinamik Progress Bar | ✅ Tek component + `progress: number` | 3.14 |
| 23 | Destructive buton | ✅ 4. varyant eklendi (5 state) | 3.1 |
| 24 | Input state kapsamı | ✅ Read-only + Success eklendi | 3.3 |
| 25 | Modal/Sheet interaction | ✅ Kural tabloları | 3.20, 3.21 |
| 26 | Pattern component'leri | ✅ 4 component Figma'da | 3.25–3.28 |
| 27 | Button varyant sayısı | ✅ 20, üç kaynakta aynı | 1, 3.1 |
| 28 | secondary vs muted | ✅ muted → neutral/430 | 2.2 |
| 29 | App Bar ↔ Screen Header | ✅ Ekran tipi tablosu | 4.2 |
| 30 | section-gap / ölçek ilişkisi | ✅ Kural + list-gap 12'ye çekildi | 2.4 |
| 31 | Validation raporu | ✅ `validation-report.md` | 7 |

**31/31 karşılandı.**
