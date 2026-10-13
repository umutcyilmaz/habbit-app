import { SettingsGroup, SettingsNote, SettingsPage, SettingsRow } from "../components/SettingsPrimitives";
export function NotificationSettingsScreen() {
  return <SettingsPage id="notifications-screen">
    <SettingsNote>Bildirim altyapısı henüz bağlı değil. Bu ekranda OS izni istenmez veya hatırlatma planlanmaz.</SettingsNote>
    <SettingsGroup title="Hatırlatmalar">
      <SettingsRow id="notification-kegel" title="Kegel hatırlatmaları" detail="Henüz kullanılamıyor · saat seçimi ve zamanlama yok" icon="saved" />
      <SettingsRow border id="notification-risk" title="Riskli saat uyarısı" detail="Henüz kullanılamıyor" />
      <SettingsRow border id="notification-weekly" title="Haftalık özet" detail="Henüz kullanılamıyor" icon="report" />
    </SettingsGroup>
    <SettingsGroup title="İzin ve gizlilik">
      <SettingsRow id="notification-permission" title="Bildirim izni" detail="Sistem izni durumu bu sürümde okunmuyor veya yönetilmiyor" icon="privacy" />
      <SettingsRow border id="notification-content" title="Bildirim içeriğini gizle" detail="Henüz kullanılamıyor" icon="privacy" />
    </SettingsGroup>
  </SettingsPage>;
}
