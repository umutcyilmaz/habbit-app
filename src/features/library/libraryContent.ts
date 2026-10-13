// Editorial content from .local-design/kegel/tasarim.html; only obsolete Practice-tab wording is adapted. No generated articles.
export const libraryCategories = {
  "sex": "Seks ipuçları",
  "urge": "Dürtüler",
  "brain": "Alışkanlık",
  "pelvic": "Pelvik sağlık",
  "sleep": "Uyku",
  "rel": "İlişkiler"
} as const;
export type LibraryCategoryId = keyof typeof libraryCategories;
export type LibraryBlock = ["p" | "h" | "quote", string] | ["list", string[]] | ["try", string, string, string, "practice" | "run60" | "kegel"];
export type LibraryArticle = {id:string;cat:LibraryCategoryId;min:number;motif:string;title:string;lead:string;body:LibraryBlock[];keys:string[]};
export const libraryArticles: readonly LibraryArticle[] = [
  {
    "id": "pe",
    "cat": "sex",
    "min": 5,
    "motif": "heart",
    "title": "Erken boşalmayı yönetmek",
    "lead": "İki basit teknik, kontrolü seks sırasında da kullanmanı sağlar: dur-başla ve sıkma.",
    "body": [
      [
        "p",
        "Erken boşalma çok yaygındır ve çoğu zaman öğrenilebilir bir beceriyle iyileşir. Eşik farkındalığı burada işe yarar."
      ],
      [
        "h",
        "Dur-başla"
      ],
      [
        "p",
        "Uyarılma yedi civarına çıktığında hareketi durdur, birkaç nefes al, seviye düşünce devam et. Partnerine önceden anlatırsan bu bir kesinti değil, ortak bir ritim olur."
      ],
      [
        "h",
        "Sıkma tekniği"
      ],
      [
        "p",
        "Eşiğe yaklaştığında penisin baş kısmının hemen altını birkaç saniye nazikçe sık. Dürtü azalır; ardından devam edebilirsin."
      ],
      [
        "quote",
        "Kontrol, hızı yavaşlatabilmekle başlar."
      ],
      [
        "try",
        "Önce tek başına çalış",
        "Eşiğini tanımak için pratik yap.",
        "Pratik başlat",
        "practice"
      ],
      [
        "p",
        "Sorun sürekliyse ya da sıkıntı veriyorsa bir ürolog ya da cinsel terapistle konuşmak iyi bir adımdır."
      ]
    ],
    "keys": [
      "Eşiği tanı, yedide dur.",
      "Sıkma tekniği dürtüyü azaltır.",
      "Partnerine önceden anlat."
    ]
  },
  {
    "id": "anx",
    "cat": "sex",
    "min": 4,
    "motif": "heart",
    "title": "Performans kaygısıyla başa çıkmak",
    "lead": "Kafanda “ya olmazsa” varken beden de gerilir. Odağı sonuca değil, ana taşı.",
    "body": [
      [
        "p",
        "Kaygı, ereksiyonu ve kontrolü doğrudan etkiler. Gerilen beden, uyarılmayı zorlaştırır; bu da kaygıyı büyütür."
      ],
      [
        "list",
        [
          "<b>Odağı his üzerine taşı.</b> Dokunuşu, sıcaklığı, nefesi fark et.",
          "<b>Hedefi kaldır.</b> Her yakınlaşmanın bir sonuca ulaşması gerekmez.",
          "<b>Nefesini yavaşlat.</b> Uzun nefes vermek bedeni sakinleştirir."
        ]
      ],
      [
        "quote",
        "Sonucu düşünmeyi bıraktığında beden kendi işini yapar."
      ],
      [
        "p",
        "Ara sıra olan zorlanmalar normaldir. Sık tekrarlıyorsa bir uzmanla görüşmek faydalı olur."
      ]
    ],
    "keys": [
      "Kaygı ve beden birbirini etkiler.",
      "Sonuç yerine hisse odaklan.",
      "Nefes en hızlı araçtır."
    ]
  },
  {
    "id": "talk2",
    "cat": "sex",
    "min": 4,
    "motif": "heart",
    "title": "İstediğini konuşmak",
    "lead": "İyi seks, çoğu zaman iyi bir konuşmayla başlar.",
    "body": [
      [
        "p",
        "Ne hoşuna gittiğini ve neyin gitmediğini söylemek ilişkiyi yakınlaştırır. Tahmin etmek yerine sormak, ikiniz için de rahatlatıcıdır."
      ],
      [
        "list",
        [
          "Yatakta değil, sakin bir anda konuş.",
          "Eleştiri yerine istek cümlesi kur: “Şunu denemek isterim.”",
          "Onun ne istediğini de sor ve dinle."
        ]
      ],
      [
        "quote",
        "Merak, en iyi ön sevişmedir."
      ]
    ],
    "keys": [
      "Sakin bir anı seç.",
      "İstek cümlesi kur.",
      "Sor ve dinle."
    ]
  },
  {
    "id": "fore",
    "cat": "sex",
    "min": 3,
    "motif": "heart",
    "title": "Acele etmemek",
    "lead": "Uzun bir başlangıç, hem uyarılmayı hem kontrolü kolaylaştırır.",
    "body": [
      [
        "p",
        "Uyarılma kademeli yükseldiğinde eşiği fark etmek kolaylaşır. Acele, seviyeyi bir anda zirveye taşır."
      ],
      [
        "p",
        "Yavaş başlamak, dokunuşa ve öpüşmeye zaman ayırmak partnerin için de daha keyiflidir."
      ],
      [
        "quote",
        "Yavaş yükselen dalgayı yönetmek daha kolaydır."
      ]
    ],
    "keys": [
      "Kademeli uyarılma kontrolü kolaylaştırır.",
      "Başlangıca zaman ayır."
    ]
  },
  {
    "id": "wave",
    "cat": "urge",
    "min": 4,
    "motif": "wave",
    "title": "Dürtü dalgası: neden geçer?",
    "lead": "Dürtüler sonsuza kadar sürecekmiş gibi hissettirir. Aslında dalga gibi davranırlar.",
    "body": [
      [
        "p",
        "Dürtü geldiğinde hiç bitmeyecekmiş gibi hissettirir. Oysa dürtüler denizdeki dalgalar gibi davranır: yükselir, zirve yapar ve sonra kendiliğinden alçalır."
      ],
      [
        "h",
        "Dalganın üç evresi"
      ],
      [
        "list",
        [
          "<b>Yükseliş.</b> Beden gerilir, düşünceler tek bir şeye kilitlenir.",
          "<b>Zirve.</b> En zor an; çoğu zaman sanıldığından kısa sürer.",
          "<b>Alçalış.</b> Tepki vermediğinde dürtü kendiliğinden zayıflar."
        ]
      ],
      [
        "p",
        "Bu yaklaşıma “dürtü sörfü” denir; bağımlılık tedavisinde kullanılan farkındalık temelli yöntemlerden biridir. Amaç dürtüyle savaşmak ya da ona uymak değil, onu fark edip üzerinden geçmesine izin vermektir."
      ],
      [
        "quote",
        "Dürtüyle savaşmak onu büyütür. Onu izlemek, geçmesine alan açar."
      ],
      [
        "h",
        "Nasıl yapılır?"
      ],
      [
        "p",
        "Dürtüyü bedeninde nerede hissettiğini fark et. Nefesine odaklan ve hissin şiddetini 1 ile 10 arasında puanla. Birkaç dakika sonra yeniden puanla; çoğu zaman düştüğünü görürsün."
      ],
      [
        "try",
        "Şimdi dene",
        "Bir dakikalık nefes eşliğinde ilk dalganı izle.",
        "1 dakika başlat",
        "run60"
      ],
      [
        "p",
        "Her başarılı sörf, beynine dürtünün geçici olduğunu öğretir. Zamanla dalgalar hem seyrekleşir hem de alçalır."
      ]
    ],
    "keys": [
      "Dürtüler kalıcı değildir; yükselir ve alçalır.",
      "Savaşmak yerine fark et ve şiddetini puanla.",
      "Her sörf bir sonrakini kolaylaştırır."
    ]
  },
  {
    "id": "halt",
    "cat": "urge",
    "min": 5,
    "motif": "halt",
    "title": "Tetikleyicilerini tanı",
    "lead": "Dürtüler çoğu zaman rastgele gelmez. Dört basit soru, onları önceden görmeni sağlar.",
    "body": [
      [
        "p",
        "Dürtüler çoğu zaman rastgele gelmez. Belirli saatler, yerler ve duygular onları tetikler. Tetikleyiciyi bilmek, dürtü gelmeden önlem almanı sağlar."
      ],
      [
        "h",
        "H.A.L.T. kontrolü"
      ],
      [
        "p",
        "Kendine dört soru sor: Aç mıyım? Öfkeli miyim? Yalnız mıyım? Yorgun muyum? Bu dört durum dürtülerin en sık beslendiği zeminlerdir."
      ],
      [
        "list",
        [
          "<b>Aç.</b> Uzun süre yemek yemediğinde öz denetim zorlaşır.",
          "<b>Öfkeli.</b> Gerginlik bir çıkış yolu arar.",
          "<b>Yalnız.</b> Bağlantı ihtiyacı başka yollarla doldurulmaya çalışılır.",
          "<b>Yorgun.</b> Gece geç saatler en riskli zamanlardır."
        ]
      ],
      [
        "quote",
        "Tetikleyiciyi bilmek, dalga gelmeden kıyıya çıkmaktır."
      ],
      [
        "h",
        "Kendi haritanı çıkar"
      ],
      [
        "p",
        "Bir hafta boyunca dürtü geldiğinde saati, yeri ve o anki duygunu not et. Birkaç gün sonra tekrar eden bir desen görmeye başlarsın; sayaç detayındaki “Riskli saat” bilgisi de bu desenden gelir."
      ]
    ],
    "keys": [
      "Dört soru: aç, öfkeli, yalnız, yorgun.",
      "Saat, yer ve duyguyu bir hafta not et.",
      "Deseni görünce önlemi önceden al."
    ]
  },
  {
    "id": "loop",
    "cat": "brain",
    "min": 6,
    "motif": "loop",
    "title": "Alışkanlık döngüsü",
    "lead": "Her alışkanlık bir işaret, bir rutin ve bir ödülden oluşur. Döngüyü kırmanın yolu rutini değiştirmekten geçer.",
    "body": [
      [
        "p",
        "Her alışkanlık üç parçalı bir döngüdür: bir işaret, bir rutin ve bir ödül. Beyin bu döngüyü tekrarladıkça davranış otomatikleşir."
      ],
      [
        "list",
        [
          "<b>İşaret.</b> Yatağa telefonla girmek, yalnız kalmak, sıkılmak.",
          "<b>Rutin.</b> Düşünmeden yapılan davranış.",
          "<b>Ödül.</b> Kısa süreli rahatlama ya da uyarılma."
        ]
      ],
      [
        "p",
        "Döngüyü kırmanın en etkili yolu rutini yalnızca yasaklamak değil, aynı işarete farklı bir rutinle cevap vermektir."
      ],
      [
        "quote",
        "İşareti değiştiremiyorsan, cevabını değiştir."
      ],
      [
        "h",
        "Yeni bir rutin seç"
      ],
      [
        "p",
        "Örneğin gece yatağa girerken telefonu başka odada şarja bırakmak ya da sıkıldığında kısa bir yürüyüşe çıkmak. Yeni rutin, eskisinin karşıladığı ihtiyaca, yani rahatlamaya ya da molaya cevap vermeli."
      ]
    ],
    "keys": [
      "İşaret, rutin, ödül.",
      "Yasaklamak yerine rutini değiştir.",
      "Yeni rutin aynı ihtiyacı karşılamalı."
    ]
  },
  {
    "id": "pelvic",
    "cat": "pelvic",
    "min": 3,
    "motif": "pelvic",
    "title": "Pelvik taban nedir?",
    "lead": "Görmediğin ama her gün kullandığın bir kas grubu: mesaneyi taşır, cinsel işlevde rol oynar.",
    "body": [
      [
        "p",
        "Pelvik taban, leğen kemiğinin tabanında hamak gibi uzanan bir kas grubudur. Mesaneyi ve bağırsağı taşır, idrar ve gaz kontrolünde rol oynar, cinsel işlevde de görev alır."
      ],
      [
        "h",
        "Neden zayıflar?"
      ],
      [
        "p",
        "Yaş, hareketsizlik, prostat ameliyatı, diyabet ve aşırı aktif mesane gibi durumlar bu kasları zayıflatabilir."
      ],
      [
        "h",
        "Kegel ne yapar?"
      ],
      [
        "p",
        "Kegel egzersizleri bu kasları düzenli olarak sıkıp gevşeterek güçlendirir. Mesane kontrolüne yardımcı olabilir ve cinsel işlevi destekleyebilir."
      ],
      [
        "try",
        "Kegel sekmesinde dene",
        "Kası bulmayı 2 dakikalık etkileşimli tanıtımla öğren.",
        "Kegel'e git",
        "kegel"
      ]
    ],
    "keys": [
      "Leğen kemiğinin tabanında hamak gibi bir kas grubu.",
      "Mesane ve cinsel işlevde rol oynar.",
      "Kegel ile güçlendirilebilir."
    ]
  },
  {
    "id": "mist",
    "cat": "pelvic",
    "min": 4,
    "motif": "pelvic",
    "title": "Kegel'de sık yapılan 5 hata",
    "lead": "Doğru kası bulmak işin yarısı. Diğer yarısı onu doğru çalıştırmak.",
    "body": [
      [
        "p",
        "Kegel küçük bir hareket olduğu için yanlış yapmak kolaydır. En sık görülen hatalar:"
      ],
      [
        "list",
        [
          "<b>Nefesi tutmak.</b> Sıkarken nefes almaya devam et.",
          "<b>Başka kasları sıkmak.</b> Karın, kalça ve bacaklar gevşek kalmalı.",
          "<b>Gevşetmeyi atlamak.</b> Sıktığın kadar süre tamamen bırak.",
          "<b>Fazla yüklenmek.</b> Yorulan kas iyi çalışmaz; programı takip et.",
          "<b>İdrarı durdurmayı egzersiz yapmak.</b> Bu yalnızca kası bulmak içindir."
        ]
      ],
      [
        "quote",
        "Kegel'de güç kadar gevşemek de önemlidir."
      ],
      [
        "p",
        "Ağrı ya da yeni bir şikâyet olursa egzersize ara ver ve bir doktora ya da pelvik taban fizyoterapistine danış."
      ]
    ],
    "keys": [
      "Nefes al-ver, yardımcı kasları sıkma.",
      "Gevşetme evresini atlama.",
      "İdrarı durdurmak yalnızca kası bulmak için."
    ]
  },
  {
    "id": "sleep",
    "cat": "sleep",
    "min": 4,
    "motif": "moon",
    "title": "Uyku, gece ve ekran",
    "lead": "Gece geç saatler hem yorgunluk hem yalnızlık yüzünden en riskli zaman. Yatak odası buna göre düzenlenebilir.",
    "body": [
      [
        "p",
        "Gece geç saatler, yorgunluk ve yalnızlığın birleştiği zamandır. Yatakta elinde telefon olması bu riski büyütür."
      ],
      [
        "h",
        "Üç küçük değişiklik"
      ],
      [
        "list",
        [
          "Telefonu yatak odası dışında şarj et.",
          "Yatmadan önce 30 dakikalık ekransız bir rutin seç: kitap, duş, esneme.",
          "Uyanınca ilk yarım saat telefona bakma."
        ]
      ],
      [
        "quote",
        "Yatak odasından telefonu çıkarmak, en zor anı ortadan kaldırır."
      ],
      [
        "p",
        "İyi uyku, ertesi günkü öz denetimi de destekler. Uykusuz geçen bir gece, dürtülerle başa çıkmayı zorlaştırır."
      ]
    ],
    "keys": [
      "Gece geç saatler en riskli zaman.",
      "Telefon yatak odası dışında.",
      "Ekransız bir yatma rutini."
    ]
  },
  {
    "id": "reset",
    "cat": "urge",
    "min": 3,
    "motif": "reset",
    "title": "Sıfırlamak başarısızlık değil",
    "lead": "“Zaten bozdum” düşüncesi tek bir kaymayı tam bir geri dönüşe çevirir. Bunun bir adı var.",
    "body": [
      [
        "p",
        "Uzun bir seriden sonra sıfırlamak ağır gelebilir. “Zaten bozdum, artık fark etmez” düşüncesi çok yaygındır; psikolojide buna ihlal etkisi denir."
      ],
      [
        "p",
        "Bu düşünce tek bir kaymayı tam bir geri dönüşe çevirir. Oysa bir kayma geçmişteki temiz günleri silmez. En uzun serin ve toplam içeriksiz günlerin bu yüzden kayıtlı kalır."
      ],
      [
        "quote",
        "Bir kayma bir gündür, bir yön değil."
      ],
      [
        "h",
        "Sıfırladıktan sonra"
      ],
      [
        "list",
        [
          "Kendini suçlamak yerine ne olduğunu not et.",
          "Tetikleyiciyi bul: saat, yer, duygu.",
          "Bir sonraki adımı küçük tut: sadece bugün."
        ]
      ]
    ],
    "keys": [
      "“Zaten bozdum” bir tuzaktır.",
      "Temiz günler silinmez.",
      "Hedef: sadece bugün."
    ]
  },
  {
    "id": "talk",
    "cat": "rel",
    "min": 5,
    "motif": "rel",
    "title": "Partnerinle konuşmak",
    "lead": "Bu süreci yalnız yürütmek zorunda değilsin. Konuşmak utancı azaltır.",
    "body": [
      [
        "p",
        "Bu süreci yalnız yürütmek zorunda değilsin. Güvendiğin biriyle konuşmak utanç duygusunu azaltır ve seni yalnız bırakmaz."
      ],
      [
        "h",
        "Nasıl başlanır?"
      ],
      [
        "list",
        [
          "Sakin, acelesiz bir an seç.",
          "“Ben” diliyle konuş: ne hissettiğini anlat.",
          "Ondan ne beklediğini açıkça söyle: dinlemesi mi, destek mi?"
        ]
      ],
      [
        "quote",
        "Paylaşılan bir yük, taşınabilir bir yüktür."
      ],
      [
        "p",
        "Partnerin yoksa ya da hazır değilsen, güvendiğin bir arkadaş ya da bir uzman da aynı rolü üstlenebilir."
      ]
    ],
    "keys": [
      "Doğru anı seç.",
      "“Ben” diliyle konuş.",
      "Beklentini açıkça söyle."
    ]
  }
];
export const featuredLibraryArticleId = "wave";
export const findLibraryArticle = (id:string) => libraryArticles.find(a=>a.id===id);
export function nextLibraryArticle(id:string) {const index=libraryArticles.findIndex(a=>a.id===id);return index<0 ? undefined : libraryArticles[(index+1)%libraryArticles.length];}
export const articlesForCategory = (category:LibraryCategoryId) => libraryArticles.filter(a=>a.cat===category);
