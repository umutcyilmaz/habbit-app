import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { BehaviorSlipReason } from "../../../domain/models/BehaviorSlip";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { usePanicFeature } from "../usePanicFeature";

const reasons: ReadonlyArray<{ value: BehaviorSlipReason; label: string }> = [
  { value: "masturbation", label: "Mastürbasyon" },
  { value: "intentionalExplicitContent", label: "Açık içerik" },
  { value: "masturbationWithExplicitContent", label: "İkisi de" }
];
const saveLabels = {
  loading: "Kayıtlar yükleniyor…", unavailable: "Kaydetme durumu kullanılamıyor", saving: "Bu cihaza kaydediliyor…",
  saved: "Bu cihazda kayıtlı", unconfirmed: "Kaydetme henüz doğrulanmadı"
};

export function PanicScreen() {
  const [slipOpen, setSlipOpen] = useState(false);
  const [reason, setReason] = useState<BehaviorSlipReason | null>(null);
  const branchOpen = useRef(false);
  const currentReason = useRef<BehaviorSlipReason | null>(null);
  const feature = usePanicFeature(reason);
  const { view, actions, locked } = feature;
  const openSlip = () => {
    if (locked) return;
    branchOpen.current = true;
    currentReason.current = null;
    setReason(null);
    setSlipOpen(true);
  };
  const cancelSlip = () => {
    if (locked) return;
    branchOpen.current = false;
    currentReason.current = null;
    setReason(null);
    setSlipOpen(false);
  };
  const confirm = () => {
    if (locked || !branchOpen.current || reason === null || currentReason.current !== reason ||
      view.kind !== "choices" || !view.canConfirmSlip) return;
    actions.recordSlip();
  };
  return (
    <AppScreen>
      <View testID="bloom.panic" style={styles.stack}>
        <AppText variant="heading" accessibilityRole="header">Şu an neye ihtiyacın var?</AppText>
        <AppText testID="bloom.panic.save-state" variant="bodySmall" tone="secondary" accessibilityLiveRegion="polite">
          {saveLabels[feature.saveState]}
        </AppText>
        {feature.message !== null ? <AppText testID="bloom.panic.message" tone="danger" accessibilityRole="alert">{feature.message}</AppText> : null}
        {feature.canRetry ? (
          <AppButton testID="bloom.panic.retry" variant="secondary" disabled={feature.busy} onPress={actions.retry}>Yeniden kaydet</AppButton>
        ) : null}
        {feature.recoveryTarget !== null ? (
          <AppCard testID="bloom.panic.recovery" style={styles.stack}>
            <AppText tone="secondary">{feature.canContinue ? "Kaydın kaydedildi. Devam edebilirsin." : "Devam etmeden önce kaydetmenin doğrulanması gerekiyor."}</AppText>
            <AppButton testID="bloom.panic.continue" disabled={!feature.canContinue || feature.busy} onPress={actions.continueAfterSave}>
              {feature.recoveryTarget === "today" ? "Bugüne dön" : "Devam et"}
            </AppButton>
          </AppCard>
        ) : view.kind === "resume" ? (
          <AppCard style={styles.stack}>
            <AppText>Devam eden bir dürtü kontrolü kaydın var.</AppText>
            <AppButton testID="bloom.panic.continue-existing" disabled={locked} onPress={actions.continueExisting}>Devam et</AppButton>
          </AppCard>
        ) : view.kind === "choices" ? slipOpen ? (
          <AppCard testID="bloom.panic.slip.form" style={styles.stack}>
            <AppText variant="title">Ne oldu?</AppText>
            <View accessibilityRole="radiogroup" accessibilityLabel="Ne oldu?" style={styles.stack}>
              {reasons.map((option) => (
                <AppButton key={option.value} testID={`bloom.panic.slip.reason.${option.value}`} accessibilityRole="radio"
                  accessibilityState={{ checked: reason === option.value }} disabled={locked}
                  variant={reason === option.value ? "primary" : "subtle"}
                  onPress={() => {
                    if (locked || !branchOpen.current) return;
                    currentReason.current = option.value;
                    setReason(option.value);
                  }}>
                  {option.label}
                </AppButton>
              ))}
            </View>
            {reason !== null ? (
              <View testID="bloom.panic.slip.preview" style={styles.stack}>
                <AppText variant="title">Bunlar değişecek</AppText>
                {view.impact === null ? <AppText tone="secondary">Bu kayıt için değişiklikler şu an gösterilemiyor.</AppText> : (
                  <>
                    <AppText testID="bloom.panic.slip.preview.reset">Reset: {view.impact.reset === "restart" ? "yeniden başlayacak" : "değişmeyecek"}</AppText>
                    <AppText testID="bloom.panic.slip.preview.content-free">Content-Free: {view.impact.contentFree === "resetStreak" ? "seri yeniden başlayacak" : "değişmeyecek"}</AppText>
                    {!view.canConfirmSlip ? <AppText tone="secondary">Bu seçimle değişecek aktif bir takip yok. Yeni kayıt oluşturulmayacak.</AppText> : null}
                  </>
                )}
              </View>
            ) : <AppText tone="secondary">Bir seçenek seç.</AppText>}
            <AppButton testID="bloom.panic.slip.confirm" disabled={locked || !view.canConfirmSlip || reason === null} onPress={confirm}>Onayla ve kaydet</AppButton>
            <AppButton testID="bloom.panic.slip.cancel" variant="ghost" disabled={locked} onPress={cancelSlip}>Vazgeç</AppButton>
          </AppCard>
        ) : (
          <AppCard style={styles.stack}>
            <AppButton testID="bloom.panic.triggered" disabled={locked} onPress={() => { if (!locked && !branchOpen.current) actions.startUrge(); }}>Şu an tetiklendim</AppButton>
            <AppButton testID="bloom.panic.slip" variant="secondary" disabled={locked} onPress={openSlip}>Seriyi bozdum</AppButton>
          </AppCard>
        ) : <AppCard testID="bloom.panic.unavailable"><AppText tone="secondary">Kayıtlar şu an kullanılamıyor.</AppText></AppCard>}
        {view.kind !== "resume" || feature.recoveryTarget !== null ? (
          <AppButton testID="bloom.panic.close" variant="ghost" disabled={feature.saveState === "saving" || feature.saveState === "unconfirmed"} onPress={actions.close}>Kapat</AppButton>
        ) : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({ stack: { gap: theme.spacing.lg } });
