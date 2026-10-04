import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { BehaviorSlipReason } from "../../../domain/models/BehaviorSlip";
import { AppButton } from "../../../shared/components/v4/AppButton";
import { AppCard } from "../../../shared/components/v4/AppCard";
import { AppScreen } from "../../../shared/components/v4/AppScreen";
import { AppText } from "../../../shared/components/v4/AppText";
import { theme } from "../../../shared/design-system/v4/theme";
import { usePanicFeature } from "../usePanicFeature";

const reasons: ReadonlyArray<{ value: BehaviorSlipReason; label: string }> = [
  { value: "masturbation", label: "Mastürbasyon" },
  { value: "intentionalExplicitContent", label: "Açık içerik" },
  { value: "masturbationWithExplicitContent", label: "İkisi de" }
];
const saveLabels = {
  loading: "Kayıtlar yükleniyor…",
  unavailable: "Kaydetme durumu kullanılamıyor",
  saving: "Bu cihaza kaydediliyor…",
  saved: "Bu cihaza kaydedildi",
  unconfirmed: "Kaydetme henüz doğrulanmadı"
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
  const needsStatusPanel = feature.saveState !== "saved" || feature.message !== null || feature.canRetry;

  return (
    <AppScreen scroll includeBottomNavClearance={false}>
      <View testID="bloom.panic" style={styles.page}>
        <View style={styles.header}>
          <AppText variant="overline" tone="accent">PANIC</AppText>
          <AppText variant="display" accessibilityRole="header">Ne oldu?</AppText>
          <AppText variant="bodyLarge" tone="secondary">Şu anda sana en uygun yolu seç. Seriyi bozduysan kaydetmeden önce nelerin değişeceğini görebilirsin.</AppText>
        </View>
        <View style={needsStatusPanel ? styles.statusPanel : styles.statusLine}>
          <AppText testID="bloom.panic.save-state" variant="bodySmall" tone={feature.saveState === "unconfirmed" ? "warning" : "secondary"} accessibilityLiveRegion="polite">
            {saveLabels[feature.saveState]}
          </AppText>
          {feature.message !== null ? <AppText testID="bloom.panic.message" tone="danger" accessibilityRole="alert">{feature.message}</AppText> : null}
          {feature.canRetry ? <AppButton testID="bloom.panic.retry" label="Yeniden kaydet" variant="secondary" disabled={feature.busy} onPress={actions.retry} /> : null}
        </View>

        {feature.recoveryTarget !== null ? (
          <AppCard variant="hero" testID="bloom.panic.recovery" style={styles.cardStack}>
            <AppText variant="heading1">Sonraki adım</AppText>
            <AppText tone="secondary">{feature.canContinue ? "Kaydın kaydedildi. Devam edebilirsin." : "Devam etmeden önce kaydetmenin doğrulanması gerekiyor."}</AppText>
            <AppButton testID="bloom.panic.continue" label={feature.recoveryTarget === "today" ? "Bugüne dön" : "Devam et"} disabled={!feature.canContinue || feature.busy} onPress={actions.continueAfterSave} />
          </AppCard>
        ) : view.kind === "resume" ? (
          <AppCard variant="hero" style={styles.cardStack}>
            <AppText variant="overline" tone="accent">DEVAM EDEN KAYIT</AppText>
            <AppText variant="heading1">Devam eden bir kayıt var.</AppText>
            <AppText tone="secondary">Dürtü kontrolüne kaldığın yerden dönebilirsin.</AppText>
            <AppButton testID="bloom.panic.continue-existing" label="Devam et" disabled={locked} onPress={actions.continueExisting} />
          </AppCard>
        ) : view.kind === "choices" ? slipOpen ? (
          <View testID="bloom.panic.slip.form" style={styles.stack}>
            <View style={styles.cardStack}>
              <AppText variant="heading1">Ne oldu?</AppText>
              <AppText tone="secondary">Yaşadığın duruma en yakın seçeneği işaretle.</AppText>
            </View>
            <View accessibilityRole="radiogroup" accessibilityLabel="Ne oldu?" style={styles.choiceList}>
              {reasons.map((option) => (
                <AppButton
                  key={option.value}
                  testID={`bloom.panic.slip.reason.${option.value}`}
                  label={option.label}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityState={{ checked: reason === option.value }}
                  disabled={locked}
                  variant={reason === option.value ? "primary" : "secondary"}
                  onPress={() => {
                    if (locked || !branchOpen.current) return;
                    currentReason.current = option.value;
                    setReason(option.value);
                  }}
                />
              ))}
            </View>
            {reason !== null ? (
              <AppCard testID="bloom.panic.slip.preview" style={styles.cardStack}>
                <AppText variant="title">Bunlar değişecek</AppText>
                {view.impact === null ? <AppText tone="secondary">Bu kayıt için değişiklikler şu an gösterilemiyor.</AppText> : (
                  <>
                    {view.impact.reset === "restart" ? (
                      <View testID="bloom.panic.slip.preview.reset" style={styles.impactRow}>
                        <AppText variant="label">15 günlük Reset</AppText>
                        <AppText variant="bodySmall" tone="secondary">Mevcut deneme 1. günden yeniden başlayacak.</AppText>
                      </View>
                    ) : null}
                    {view.impact.contentFree === "resetStreak" ? (
                      <View testID="bloom.panic.slip.preview.content-free" style={styles.impactRow}>
                        <AppText variant="label">Content-Free sayacı</AppText>
                        <AppText variant="bodySmall" tone="secondary">Mevcut seri yeniden başlayacak.</AppText>
                      </View>
                    ) : null}
                    {!view.canConfirmSlip ? <AppText tone="secondary">Bu seçimle değişecek aktif bir takip yok. Yeni kayıt oluşturulmayacak.</AppText> : null}
                  </>
                )}
              </AppCard>
            ) : <AppText variant="bodySmall" tone="secondary">Önce bir seçenek seç.</AppText>}
            <AppButton testID="bloom.panic.slip.confirm" label="Kaydet" disabled={locked || !view.canConfirmSlip || reason === null} onPress={confirm} />
            <AppButton testID="bloom.panic.slip.cancel" label="Vazgeç" variant="ghost" disabled={locked} onPress={cancelSlip} />
          </View>
        ) : (
          <View style={styles.stack}>
            <AppCard variant="hero" style={styles.cardStack}>
              <AppText variant="heading1">Şu an tetiklendim</AppText>
              <AppText tone="secondary">Kısa bir ara verip dürtünün dalgasını gözlemle.</AppText>
              <AppButton testID="bloom.panic.triggered" label="Şu an tetiklendim" disabled={locked} onPress={() => { if (!locked && !branchOpen.current) actions.startUrge(); }} />
            </AppCard>
            <AppCard style={styles.cardStack}>
              <AppText variant="title">Seriyi bozdum</AppText>
              <AppText variant="bodySmall" tone="secondary">Önce nelerin değişeceğini gör, sonra kaydetmeye karar ver.</AppText>
              <AppButton testID="bloom.panic.slip" label="Seriyi bozdum" variant="secondary" disabled={locked} onPress={openSlip} />
            </AppCard>
          </View>
        ) : (
          <AppCard variant="hero" testID="bloom.panic.unavailable"><AppText tone="secondary">Kayıtlar şu an kullanılamıyor.</AppText></AppCard>
        )}

        {view.kind !== "resume" || feature.recoveryTarget !== null ? (
          <AppButton testID="bloom.panic.close" label="Kapat" variant="ghost" disabled={feature.saveState === "saving" || feature.saveState === "unconfirmed"} onPress={actions.close} />
        ) : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  page: { gap: theme.spacing.xl2, paddingBottom: theme.spacing.xl3 },
  header: { gap: theme.spacing.md },
  stack: { gap: theme.spacing.lg },
  cardStack: { gap: theme.spacing.md },
  choiceList: { gap: theme.spacing.sm },
  impactRow: { gap: theme.spacing.xs, paddingVertical: theme.spacing.xs },
  statusLine: { alignItems: "center" },
  statusPanel: { gap: theme.spacing.sm, padding: theme.spacing.md, borderRadius: theme.radius.lg, backgroundColor: theme.colors.bg.surface }
});
