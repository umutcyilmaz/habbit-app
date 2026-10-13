import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppText } from "../../../shared/components/v4/AppText";
import { SettingsGroup, SettingsNote, SettingsPage, SettingsRow, settingsStyles } from "../components/SettingsPrimitives";

export function SettingsHomeScreen() {
  const router = useRouter();
  const bloom = useBloomLocalState();
  const [showHelp, setShowHelp] = useState(false);
  const version = Constants.nativeAppVersion ?? Constants.expoConfig?.version;
  const counter = bloom.hydrationStatus === "ready" ? (bloom.durableState.contentFree.status === "active" ? "Açık" : "Kapalı") : "Durum şu an kullanılamıyor";
  return <SettingsPage id="home">
    <SettingsGroup title="Gizlilik">
      <SettingsRow id="privacy" title="Gizlilik bilgileri" detail="Bu cihazdaki veriler ve mevcut kontroller" icon="privacy" onPress={() => router.push(routes.settingsPrivacy)} />
      <SettingsRow border id="app-lock" title="Uygulama kilidi" detail="Face ID ve uygulama kilidi henüz kullanılamıyor" icon="lock" onPress={() => router.push(routes.settingsAppLock)} />
      <SettingsRow border id="hide-notifications" title="Bildirim içeriğini gizle" detail="Henüz kullanılamıyor · bildirim altyapısı bağlı değil" icon="bell" />
      <SettingsRow border id="app-icon" title="Uygulama simgesi" detail="Alternatif simgeler henüz kullanılamıyor" icon="app" />
    </SettingsGroup>
    <SettingsGroup title="Bildirimler">
      <SettingsRow id="notifications" title="Bildirim ayarları" detail="Hatırlatma ve izin kontrolleri henüz kullanılamıyor" icon="bell" onPress={() => router.push(routes.settingsNotifications)} />
      <SettingsRow border id="kegel-reminders" title="Kegel hatırlatmaları" detail="Henüz kullanılamıyor · zamanlama bağlı değil" icon="saved" />
      <SettingsRow border id="risk-reminders" title="Riskli saat uyarısı" detail="Henüz kullanılamıyor" icon="clock" />
      <SettingsRow border id="weekly-summary" title="Haftalık özet bildirimi" detail="Henüz kullanılamıyor" icon="calendar" />
    </SettingsGroup>
    <SettingsGroup title="Takip tercihleri">
      <SettingsRow id="content-free" title="İçeriksiz sayaç" detail={`${counter} · sayaç ekranında yönet`} icon="privacy" onPress={() => router.push("/bloom/content-free")} />
      <SettingsRow border id="content-blocker" title="İçerik engelleyici" detail="Gerçek sistem engellemesi henüz kullanılamıyor" icon="privacy" />
      <SettingsRow border id="practice-intro" title="Pratik tanıtımını tekrar göster" detail="Henüz kullanılamıyor" icon="wave" />
      <SettingsRow border id="personalization" title="Kişiselleştirme tercihi" detail="Kalıcı tercih kontrolü henüz kullanılamıyor" />
    </SettingsGroup>
    <SettingsGroup title="Veriler">
      <SettingsRow id="export" title="Verilerimi dışa aktar" detail="Dosya oluşturma ve paylaşma henüz kullanılamıyor" icon="report" />
      <SettingsRow border id="data-controls" title="Tüm verilerimi sil" detail="Bu cihazdaki Bloom verileri · geri alınamaz" danger icon="trash" onPress={() => router.push(routes.settingsDataControls)} />
    </SettingsGroup>
    <SettingsGroup title="Yardım ve destek">
      <SettingsRow id="help" title="Yardım ve SSS" detail={showHelp ? "Bilgileri kapat" : "Yerel veriler ve ayarlar hakkında"} icon="help" onPress={() => setShowHelp(value => !value)} />
      <SettingsRow border id="legal" title="Gizlilik ve koşullar" detail="Gizlilik bilgileri mevcut · kullanım koşulları henüz yayımlanmadı" icon="report" onPress={() => router.push(routes.settingsPrivacy)} />
    </SettingsGroup>
    {showHelp ? <View testID="bloom.settings.faq" style={settingsStyles.panel}>
      <AppText accessibilityRole="header" style={settingsStyles.heading}>Sık sorulan sorular</AppText>
      <AppText style={settingsStyles.copy}>Verilerim nerede? Kayıtlar bu uygulamanın cihazdaki yerel depolamasında tutulur. Bulut eşitleme ve uygulama içi dışa aktarma şu an yok.</AppText>
      <AppText style={settingsStyles.copy}>Neden bazı ayarlar kullanılamıyor? Bildirimler, Face ID, alternatif simgeler ve satın alma henüz bağlı değil.</AppText>
      <AppText style={settingsStyles.copy}>Verileri silince ne olur? Yerel kayıtlar geri alınamaz biçimde kaldırılır; silme doğrulanınca başlangıç kurulumuna dönersin.</AppText>
      <AppText style={settingsStyles.copy}>Destek iletişim kanalı henüz yayımlanmadı.</AppText>
    </View> : null}
    <SettingsGroup title="Uygulama bilgileri">
      <SettingsRow id="version" title="Bloom" detail={version ? `Sürüm ${version}` : "Sürüm bilgisi kullanılamıyor"} />
      <SettingsRow border id="subscription" title="Abonelik" detail="Yönetim ve satın alma geri yükleme henüz kullanılamıyor" icon="member" onPress={() => router.push(routes.settingsSubscription)} />
    </SettingsGroup>
    <SettingsNote>Verilerin bu cihazda saklanır.</SettingsNote>
  </SettingsPage>;
}
