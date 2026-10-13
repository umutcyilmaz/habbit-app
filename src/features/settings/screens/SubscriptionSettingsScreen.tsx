import { SettingsGroup, SettingsNote, SettingsPage, SettingsRow } from "../components/SettingsPrimitives";
export function SubscriptionSettingsScreen() {
  return <SettingsPage id="subscription-screen">
    <SettingsGroup title="Abonelik">
      <SettingsRow id="membership" icon="member" title="Üyelik bilgisi kullanılamıyor" detail="Bu sürüm mağazadan üyelik veya deneme süresi doğrulamıyor." />
      <SettingsRow border id="subscription-management" icon="member" title="Aboneliği yönet" detail="Henüz kullanılamıyor · mağaza bağlantısı bağlı değil" />
      <SettingsRow border id="restore-purchases" icon="report" title="Satın almaları geri yükle" detail="Henüz kullanılamıyor · satın alma doğrulaması bağlı değil" />
    </SettingsGroup>
    <SettingsNote>Yerel verilerini silmek mağazadaki bir aboneliği iptal etmez.</SettingsNote>
  </SettingsPage>;
}
