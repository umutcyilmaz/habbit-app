import { useRouter } from "expo-router";
import { routes } from "../../../constants/navigation";
import { SettingsGroup, SettingsNote, SettingsPage, SettingsRow } from "../components/SettingsPrimitives";

export function PrivacyOverviewScreen() {
  const router = useRouter();
  return <SettingsPage id="privacy-screen">
    <SettingsGroup title="Yerel verilerin">
      <SettingsRow id="local-storage" icon="data" title="Bu cihazda saklanır" detail="Bloom kayıtları uygulamanın veya tarayıcının yerel depolamasındadır. Bu sürümde bulut eşitleme yok." />
      <SettingsRow border id="stored-data" icon="report" title="Neler kaydedilir?" detail="Onboarding yanıtları ve plan seçimi; Kegel geçmişi; Library okundu ve kaydetme bilgileri; Tracking, içeriksiz sayaç, zor an ve Reset kayıtları. Veri kontrollerinde ayrıntıları görebilirsin." />
      <SettingsRow border id="storage-protection" icon="privacy" title="Mevcut korumanın sınırları" detail="Uygulama düzeyinde şifreleme veya biyometrik kilit bağlı değil. Bildirim içeriği gizleme de henüz kullanılamıyor." />
    </SettingsGroup>
    <SettingsGroup title="Senin kontrolünde">
      <SettingsRow id="privacy-data" icon="data" title="Veri kontrolleri" detail="Saklanan bilgileri incele veya yerel verilerini sil" onPress={() => router.push(routes.settingsDataControls)} />
      <SettingsRow border id="optional-details" icon="assessment" title="İsteğe bağlı ayrıntılar" detail="Notlar ve desteklenen isteğe bağlı yanıtları eklemek zorunda değilsin. Mevcut kayıt akışlarının seçimleri korunur." />
      <SettingsRow border id="privacy-lock" icon="privacy" title="Uygulama kilidi" detail="Henüz kullanılamıyor" onPress={() => router.push(routes.settingsAppLock)} />
    </SettingsGroup>
    <SettingsNote>Bu ekran mevcut veri kontrollerini açıklar. Yayımlanmış kullanım koşulları ve kapsamlı gizlilik metni için ürün kararı bekleniyor.</SettingsNote>
  </SettingsPage>;
}
