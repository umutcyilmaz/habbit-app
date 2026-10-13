import { SettingsGroup, SettingsNote, SettingsPage, SettingsRow } from "../components/SettingsPrimitives";
export function AppLockSettingsScreen() {
  return <SettingsPage id="app-lock-screen">
    <SettingsGroup title="Gizlilik">
      <SettingsRow id="biometrics" icon="privacy" title="Face ID / uygulama kilidi" detail="Henüz kullanılamıyor. Biyometrik doğrulama ve uygulama kilidi bağlı değil; Bloom açılışını korumaz." />
    </SettingsGroup>
    <SettingsNote>Uygulama kilidi, yerel depolama şifrelemesinden ayrı bir özelliktir. Bu sürümde ikisi için de ek koruma sunulmaz.</SettingsNote>
  </SettingsPage>;
}
