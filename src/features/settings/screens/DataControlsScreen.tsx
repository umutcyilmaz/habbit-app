import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Alert, Pressable, View } from "react-native";
import { useLocalDataLifecycle } from "../../../app/providers/LocalDataLifecycleProvider";
import { AppButton } from "../../../shared/components/v4/AppButton";
import { AppText } from "../../../shared/components/v4/AppText";
import { SettingsGroup, SettingsNote, SettingsPage, SettingsRow, settingsStyles } from "../components/SettingsPrimitives";

const DELETION_WARNING = "Bu cihazdaki onboarding ve değerlendirme yanıtların, plan seçimin, Kegel geçmişin, Library kayıtların, Tracking ve içeriksiz sayaç kayıtların, Reset ilerlemen, notların ve diğer yerel Bloom verilerin kalıcı olarak silinir. Bu işlem geri alınamaz. Mağazadaki bir aboneliği iptal etmez.";

export function DataControlsScreen() {
  const { deletionStatus, deletionError, deleteAllLocalData, retryBloomLocalDataResetNavigation } = useLocalDataLifecycle();
  // Keep the coordinator's error/late-settlement state across visits. Do not clear it on mount.
  const [confirming, setConfirming] = useState(deletionStatus === "error");
  const [holding, setHolding] = useState(false);
  const submitted = useRef(false);
  const focused = useRef(false);
  const confirmation = useRef(confirming);
  const blocked = useRef(false);
  confirmation.current = confirming;
  const busy = deletionStatus === "deleting" || deletionStatus === "success";
  blocked.current = busy;
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; setHolding(false); };
  }, []));

  const submit = () => {
    if (!focused.current || !confirmation.current || blocked.current || submitted.current) return;
    submitted.current = true;
    setHolding(false);
    // Success and navigation belong exclusively to the existing lifecycle coordinator.
    void deleteAllLocalData().catch(() => undefined).finally(() => { submitted.current = false; });
  };
  const confirmWithoutHold = () => {
    if (busy || submitted.current) return;
    Alert.alert("Tüm yerel verilerini sil?", DELETION_WARNING, [
      { text: "Vazgeç", style: "cancel" },
      { text: "Kalıcı olarak sil", style: "destructive", onPress: submit },
    ], { cancelable: true });
  };

  return <SettingsPage id="data-screen">
    <SettingsGroup title="Saklanan bilgiler">
      <SettingsRow id="data-onboarding" icon="assessment" title="Onboarding ve değerlendirme" detail="Yanıtlar, sonuçlar, öneri ve plan seçimi; başlangıç kurulumunun tamamlanma bilgileri." />
      <SettingsRow border id="data-kegel" icon="saved" title="Kegel ve Library" detail="Kegel tanıtım kabulü, tamamlanan setler, tekrarlar ve tarihler; Library’de okundu ve kaydedilen yazı kimlikleri." />
      <SettingsRow border id="data-tracking" icon="report" title="Takip, sayaç ve Reset" detail="Tracking oturumları ve geri bildirimleri; içeriksiz sayaç geçmişi; zor an kayıtları; Reset ilerlemesi, ihlal ve geri alma bilgileri." />
      <SettingsRow border id="data-legacy" icon="data" title="Diğer yerel kayıtlar" detail="Check-in, Pause ve Arousal Control taslakları ve geçmişi; Protection tercihleri, isteğe bağlı notlar, tarih/saat ve kimlikler. Uyumluluk ve kurtarma için tutulan eski kayıtlar da silme kapsamındadır." />
    </SettingsGroup>
    <SettingsGroup title="Dışa aktarma">
      <SettingsRow id="data-export" title="Verilerimi dışa aktar" detail="Dosya oluşturma ve paylaşma henüz kullanılamıyor" icon="report" />
    </SettingsGroup>
    <View testID="bloom.settings.delete-panel" style={settingsStyles.panel}>
      <AppText accessibilityRole="header" style={[settingsStyles.heading, settingsStyles.danger]}>Tüm verilerimi sil</AppText>
      <AppText style={settingsStyles.copy}>Yalnızca bu uygulamanın veya tarayıcının yerel Bloom verileri kaldırılır. Bulut veya mağaza hesabı yönetimi yapılmaz.</AppText>
      {confirming ? <View testID="bloom.settings.delete-confirmation" style={settingsStyles.actions}>
        <AppText accessibilityRole="header" style={{ color: "#ffbf69", fontFamily: "Inter_600SemiBold" }}>Geri alınamaz</AppText>
        <AppText style={settingsStyles.copy}>{DELETION_WARNING}</AppText>
        <Pressable testID="bloom.settings.delete-hold" accessibilityRole="button" accessibilityLabel="Silmek için 2 saniye basılı tut"
          accessibilityHint="Kısa dokunma silmez. Basılı tutamıyorsan aşağıdaki ayrı onay düğmesini kullan."
          accessibilityState={{ disabled: busy, busy }} disabled={busy} delayLongPress={2000}
          onPressIn={() => setHolding(true)} onPressOut={() => setHolding(false)} onLongPress={submit}
          style={({ pressed }) => ({ minHeight: 56, borderRadius: 28, padding: 16, alignItems: "center", justifyContent: "center", backgroundColor: pressed ? "#ffd39b" : "#ffbf69", opacity: busy ? .5 : 1 })}>
          <AppText style={{ color: "#17120b", fontFamily: "Inter_600SemiBold", textAlign: "center" }}>{busy ? "Silme sonucu doğrulanıyor…" : holding ? "Basılı tutmaya devam et…" : deletionStatus === "error" ? "Tekrar denemek için basılı tut" : "Silmek için basılı tut"}</AppText>
        </Pressable>
        <AppButton testID="bloom.settings.delete-accessible" label="Basılı tutmak yerine ayrı onay aç" variant="ghost" disabled={busy} onPress={confirmWithoutHold} />
        <AppButton testID="bloom.settings.delete-cancel" label="Vazgeç" variant="secondary" disabled={busy} style={settingsStyles.button} onPress={() => { confirmation.current = false; setConfirming(false); }} />
      </View> : <AppButton testID="bloom.settings.delete-open" label="Silme onayını aç" variant="destructive" style={settingsStyles.button} disabled={busy} onPress={() => setConfirming(true)} />}
      {deletionStatus === "deleting" ? <AppText testID="bloom.settings.delete-pending" accessibilityLiveRegion="polite" style={settingsStyles.copy}>Silme işlemi sürüyor. Sonuç doğrulanmadan tamamlandı sayılmaz.</AppText> : null}
      {deletionStatus === "error" ? <View testID="bloom.settings.delete-error" style={{ gap: 8 }}>
        <AppText accessibilityLiveRegion="assertive" style={settingsStyles.danger}>Silme doğrulanamadı. Verilerin hâlâ mevcut olabilir; devam eden bir işlem varsa tekrar denemek yeni bir silme başlatmaz.</AppText>
        {!confirming ? <AppButton label="Tekrar deneme onayını aç" variant="secondary" onPress={() => setConfirming(true)} /> : null}
      </View> : null}
      {deletionStatus === "success" ? <View testID="bloom.settings.delete-success" style={{ gap: 10 }}>
        <AppText accessibilityLiveRegion="polite">{deletionError ? "Yerel verilerin silindiği doğrulandı, ancak başlangıç kurulumu açılamadı. Başlangıç kurulumunu tekrar açmayı dene." : "Yerel verilerin silindiği doğrulandı. Başlangıç kurulumu açılıyor."}</AppText>
        {deletionError ? <AppButton label="Başlangıç kurulumunu tekrar aç" onPress={retryBloomLocalDataResetNavigation} /> : null}
      </View> : null}
    </View>
    <SettingsNote>Silme doğrulanınca başlangıç kurulumuna dönersin.</SettingsNote>
  </SettingsPage>;
}
