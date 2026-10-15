# Phase 11.7.2 — Practice veri sözleşmesi, göç ve geri dönüş

Bu belge uygulanan v1 sözleşmesidir. Önceki [11.7.2 önerisi](phase11-7-2-practice-persistence-proposal.md) 11.7.1 döneminin karar listesini korur; aşağıdaki kurallar bu görevde kesinleştirildi.

## Kalıcı alan

`BloomLocalState.practice = { introduction: PracticeIntroduction | null, sessions: CompletedPracticeSession[] }`.

| Alan | Anlam / doğrulama |
|---|---|
| `introduction.version`, `acknowledgedAt` | Pozitif güvenli tam sayı sürüm ve UTC ISO onay zamanı. Bu uygulama yalnız sürüm 1 için açık Başlat onayı yazar. Farklı pozitif sürüm korunur ve mevcut tanıtım tekrar gösterilir; yalnız onaylama işlemi değiştirir. Yönergeleri okumak yazma yapmaz. |
| `id`, `version`, `source` | İlk Kaydet girişiminde sabit kimlik; oturum sürümü 1; `guided_practice`. Aynı kimliğin içeriği değiştirilemez. |
| `startedAt` | Açık başlatma ve gereken durable tanıtım onayından sonraki UTC duvar saati. |
| `completedAt` | İlk açık Kaydet girişiminin UTC duvar saati. Soruların bekleme süresi bu tarih aralığında bulunabilir; egzersiz süresine girmez. Yeniden denemede değişmez. |
| `timezone.name`, `utcOffsetMinutes` | Kaydetme anındaki IANA bölgesi ve `Date.getTimezoneOffset()` işaretli offset (UTC − yerel). Türkiye örneği −180. |
| `foregroundExerciseMs` | Running + kasıtlı Pause sırasında ön planda geçen monotonic süre. |
| `activeMs` | `foregroundExerciseMs − intentionalPauseMs`. “Uygulama ön planda” ile eş anlamlı değildir; kasıtlı duraklama çıkarılmıştır. |
| `intentionalPauseMs` | Tamamlanan duraklama aralıklarının toplamı. Background, kilit, çıkış onayı ve reflection beklemesi hariç. |
| `pauses[]` | `{ startMs, endMs }`, egzersizin yalnız ön planda ilerleyen ekseninde, sıralı ve çakışmayan tamamlanmış aralıklar. Pause sırasında Bitir son aralığı bir kez kapatır. |
| `arousalReports[]` | `{ atMs, reportedAt, level }`: yalnız açık kullanıcı girişi; sıralı egzersiz offseti, UTC beyan zamanı, 1–10 tam sayı. Çizim örnekleri veya çıkarılmış ölçümler yok. |
| `erectionQuality` | 1–10 tam sayı veya atlandıysa null. Uyarılma seviyesiyle ayrı alan. |
| `explicitContent` | true / false / null. Yalnız Practice beyanı; Content-Free/Reset/Tracking yan etkisi yok. |
| `ending` | `came / stopped / soft / other / null`. |
| `feelings[]` | V1 sembolleri: Kontrollü, Sakin, Aceleci, Kaygılı, Yorgun. Tekrarsız; seçilmediyse boş dizi. Bitiş sorusu atlanınca bağımsız his seçimleri korunabilir. |

Tüm süreler finite ve ≥0; toplamlar 0.001 ms toleransla eşit, aralıklar ve beyan offsetleri toplamı aşamaz. UTC tarihleri geçerli ve sıralıdır. Beyan zamanı başlangıç/tamamlanma aralığındadır. Duvar saati aralığı egzersizden kısa olamaz (ISO milisaniye yuvarlaması için 1 ms tolerans). Yanlış kayıt tüm snapshot doğrulamasını durdurur; tek kayıt sessizce atılmaz. Tarih veya süre uydurularak düzeltme yapılmaz.

Görünen mm:ss değerleri aşağı yuvarlanır; ayrı satırlarda yuvarlanan saniyelerin toplamında 1 saniyelik fark olabilir. Kalıcı ms toplamları tam olarak birbirini doğrular. Sıfır süreli ama açıkça bitirilmiş pratik yasaklanmaz; asgari süre/başarı hedefi yoktur.

## Kaydetme ve kurtarma

1. Runtime yalnız bellekte yaşar. Kaydet yalnız `summary` aşamasında çalışır. Hiçbir persistent draft veya legacy dönüştürücü yoktur.
2. İlk girişim sabit ID, zaman ve payload üretir. Controller derin kopyayı doğrular ve dondurur. Yanıt düzenlemesi bu noktadan sonra kapanır.
3. UI, event-time `readPracticeAvailability` ve acknowledged transition güncel canonical Reset'i denetler. Provider ayrıca accepted/durable eşitliği, hydration ve silme kilidini işlem anında denetler.
4. Stale Save/Exit/Edit callback’leri canlı runtime/payload kilidini okur; runtime’ın reddettiği seviye girişi rapor listesine eklenmez. Busy yayımlanmadan async komut başlamaz; eşzamanlı ikinci çağrı aynı promise'ı kullanır. Kabul edilmiş girişim tekrar domain action ile oynatılmaz.
5. Retryable sonucu yalnız mevcut runtime token'ıyla yeniden dene. Timeout sonrası geç yazma aynı kapsayan işlemden doğrulanır; ikinci kimlik oluşmaz.
6. Superseded sonuç eski token'ı kullanamaz. Güncel persistence onayından sonra durable kayıtta aynı ID **ve aynı payload** aranır. Yeni durum eski snapshot ile ezilmez.
7. Invalidated/deletion sonucu eski oturumu diriltmez. “Kaydedildi” için başarılı onay, güncel accepted/durable eşitliği ve tam payload eşleşmesi gerekir. Geç cevap unmount olmuş ekranı başlatamaz/navigasyon yaptıramaz.
8. Kabul edilmemiş istek aynı immutable payload ile tekrar denenebilir. Doğrulanamayan veya cihaz saati nedeniyle geçersiz payload başarı gibi gösterilmez; geçici pratikten çıkılabilir.

Kaydedildi ekranı geçmişe geçer; geçmiş yalnız durable `practice.sessions` okur. Yeni route/remount kendi boş runtime'ıyla açılır; otomatik egzersiz veya tamamlanmış kayıt yeniden yaratılmaz.

## Reset izin tablosu

| Canonical durable durum | Yeni Practice |
|---|---|
| Hydration hazır değil / accepted ≠ durable / silme kilidi | Kapalı |
| `baseline_pending` | Kapalı |
| `active` — süre dolmuş olsa bile | Kapalı |
| `completed`, mevcut Reset akışı Content-Free devam kararı gerektiriyor | Kapalı |
| `completed`, gerekli karar kaydedilmiş veya mevcut kurallar karar gerektirmiyor | Açık |
| `inactive`, `recommended` | Açık |

Gereken karar, mevcut `canOfferResetContentFreeContinuation` sözleşmesinden türetilir; yeni Reset/Tracking kuralı yazılmaz. Tracking'in kapalı olması Practice'i kapatmaz. Home/Library/reader/direct route/start/save aynı izin katmanına bağlıdır. Geçmiş Reset boyunca açık; Home'daki “Pratik duraklatıldı” kartı Tracking geçmişinin altında kalır.

## Yerel gün ve geçmiş

Gruplama kaydetme anındaki offset ile sabittir. Sonradan seyahat veya cihaz bölgesi değişimi eski günleri taşımaz. Gruplar en son UTC kaydının sırasıyla, kayıtlar `completedAt` ve sabit ID ile deterministik sıralanır. Tüm ekrandaki değerler kalıcı kayıtların kendi verisidir; trend, klinik puan veya sahte ilerleme yoktur.

## v8 → v9 ve geri dönüş

- Yeni envelope sürümü 9, anahtar `bloom.localState.v9`. v8 ilk legacy kaynaktır; v7…v1 / önceki desteklenen envelope kuralları okunmaya devam eder.
- Canonical v8'in bütün eski alanları ve kimlikleri korunur. Practice yoksa `{ introduction: null, sessions: [] }` eklenir. Eski envelope içinde geçerli Practice alanı varsa korunur; bozuk alan düşürülmez.
- Yeni v9 yazısı tamamlanmadan kaynak kaldırılmaz. Ham v8 ve v7 anahtarları başarıdan sonra da byte düzeyinde tutulur. Diğer eski anahtarların mevcut başarılı göç temizliği korunur.
- v9 anahtarı varsa parse/version/schema hatasında eski kaynağa dönülmez. Ham hata verisi mevcut corrupt backup mekanizmasıyla korunur. v9 anahtarında eski/unversioned envelope olması da hatadır; kaynak üstüne sessiz yeniden yazma yapılmaz.
- Coordinator write sırası, generation invalidation ve deletion bariyerleri değiştirilmedi. Tam silme v9, v8…v1 ve corrupt backup anahtarlarını kapsar.
- **Otomatik downgrade yok.** v8 kopyası sonraki v9 kayıtlarını içermez. 11.7.1 binary'sine geri dönmek yeni Practice'i görünmez yapabilir ve iki anahtarı ayrıştırabilir. Geri dönüş, v9 raw payload'u koruyan, yeni kayıtları dışarıda tutmayan ayrı ve gözden geçirilmiş bir kurtarma işlemi gerektirir. v9 silinip v8 “güncel” diye kullanılamaz.

## QA önizleme sınırı

Visual preview gate'i DEV + E2E + doğru bundle + açık Preview flag gerektirir. Bu mod kök provider'da process-memory kullanır; canonical/önceki QA anahtarlarını okumaz veya göçe sokmaz. Save receipt yalnız invalidated döner; production Practice/history yolları preview'a yönlenir. Durable QA ayrı flag + geçerli run adı ve yeni namespace ister. Release normal v9 runtime'ını kullanır.

## Sonraki ürün kararları

- [ ] Tek kayıt düzenleme/silme, revizyon ve undo sözleşmesi.
- [ ] Export, retention, senkronizasyon ve başka cihazda kimlik/çatışma politikası.
- [ ] Duvar saati geri alınması veya timezone değişimi sırasında kayıt UX'i.
- [ ] Çok dilli his etiketleri için v1 sembollerini koruyan mapping/migration.
- [ ] Tanıtımın yeni içerik sürümü ve Settings'teki ayrı yönerge bağlantısı.
- [ ] Ek programlar, seviye beyanı sıklığı, geçmiş karşılaştırmaları; bu fazda otomatik birleştirme/başarı hedefi yok.
- [ ] Content-Free ile olası bağlantı ancak ayrı açık ürün/onay sözleşmesiyle; mevcut cevap hiçbir sayaç veya ihlal oluşturmaz.

Bu maddeler bu fazda başlatılmadı. Yayın için commit/push yapılmadı; inceleme bekleniyor.
