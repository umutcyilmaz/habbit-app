import { StyleSheet, View } from "react-native";

import type { OnboardingDimensions, OnboardingRecommendation, OnboardingSignalLevel } from "../../../domain/models/OnboardingDimensions";
import { AppButton } from "../../../shared/components/v4/AppButton";
import { AppCard } from "../../../shared/components/v4/AppCard";
import { AppScreen } from "../../../shared/components/v4/AppScreen";
import { AppText } from "../../../shared/components/v4/AppText";
import { theme } from "../../../shared/design-system/v4/theme";
import { useStartingRecommendationFeature } from "../useStartingRecommendationFeature";

const planCopy: Record<OnboardingRecommendation, { title: string; description: string }> = {
  masturbation_tracking: {
    title: "Mastürbasyon takibiyle başla",
    description: "Önce gerçek oturumlarından veri toplamak, sana ait örüntüleri daha net görmemizi sağlar."
  },
  content_free: {
    title: "Content-Free sayacını başlat",
    description: "Açık içerikten uzak geçen süreyi ayrı olarak takip etmek iyi bir başlangıç olabilir."
  },
  reset: {
    title: "15 günlük Reset’i değerlendir",
    description: "Reset başlamadan önce dört kısa başlangıç sorusunu cevaplayacaksın."
  },
  reset_and_content_free: {
    title: "15 günlük Reset + Content-Free",
    description: "Content-Free sayacı başlar; Reset ise dört başlangıç sorusunu tamamladığında başlar."
  }
};
const signalCopy: ReadonlyArray<{ key: keyof Pick<OnboardingDimensions, "contentDysregulation" | "erectionResponseConcern" | "stimulationPattern">; label: string }> = [
  { key: "contentDysregulation", label: "İçerik kullanımı" },
  { key: "erectionResponseConcern", label: "Ereksiyon yanıtı" },
  { key: "stimulationPattern", label: "Uyarılma alışkanlığı" }
];
const levelCopy: Record<OnboardingSignalLevel, string> = {
  high: "Belirgin sinyal",
  medium: "Orta düzeyde sinyal",
  low: "Belirgin sinyal yok",
  uncertain: "Belirsiz"
};
const saveLabels = {
  loading: "Kayıtlar yükleniyor…", unavailable: "Kaydetme durumu kullanılamıyor", saving: "Bu cihaza kaydediliyor…",
  saved: "Bu cihaza kaydedildi", unconfirmed: "Kaydetme henüz doğrulanmadı"
};

export function StartingRecommendationScreen() {
  const feature = useStartingRecommendationFeature();
  const { view, actions } = feature;
  const needsStatusPanel = feature.saveState !== "saved" || feature.message !== null || feature.canRetry;

  return (
    <AppScreen scroll includeBottomNavClearance={false}>
      <View testID="bloom.starting-recommendation" style={styles.page}>
        <View style={styles.header}>
          <AppText variant="overline" tone="accent">BAŞLANGIÇ DEĞERLENDİRMESİ</AppText>
          <AppText variant="display" accessibilityRole="header">{view.kind === "unavailable" && !feature.recovery ? "Başlangıç değerlendirmen" : "Değerlendirme tamamlandı"}</AppText>
          <AppText variant="bodyLarge" tone="secondary">{view.kind === "unavailable" && !feature.recovery
            ? "Yanıtların tamamlandığında sana uygun ilk adımı burada görebilirsin."
            : "Yanıtların başlangıç için bazı sinyaller gösteriyor. Bunlar tıbbi bir tanı değil; sana uygun ilk adımı seçmek için kullanılıyor."}</AppText>
        </View>
        <View style={needsStatusPanel ? styles.statusPanel : styles.statusLine}>
          <AppText testID="bloom.starting-recommendation.save-state" variant="bodySmall" tone={feature.saveState === "unconfirmed" ? "warning" : "secondary"} accessibilityLiveRegion="polite">{saveLabels[feature.saveState]}</AppText>
          {feature.message !== null ? <AppText testID="bloom.starting-recommendation.message" tone="danger" accessibilityRole="alert">{feature.message}</AppText> : null}
          {feature.canRetry ? <AppButton testID="bloom.starting-recommendation.retry" label="Yeniden kaydet" variant="secondary" disabled={feature.busy} onPress={actions.retry} /> : null}
        </View>

        {feature.recovery ? (
          <AppCard variant="hero" testID="bloom.starting-recommendation.recovery" style={styles.cardStack}>
            <AppText variant="heading1">Sonraki adım</AppText>
            <AppText tone="secondary">{feature.canContinue ? "Başlangıç planın kaydedildi. Devam edebilirsin." : "Devam etmeden önce kaydetmenin doğrulanması gerekiyor."}</AppText>
            <AppButton testID="bloom.starting-recommendation.continue" label="Devam et" disabled={!feature.canContinue || feature.busy} onPress={actions.continueAfterSave} />
          </AppCard>
        ) : view.kind === "unavailable" ? (
          <AppCard variant="hero" testID="bloom.starting-recommendation.unavailable" style={styles.cardStack}>
            <AppText variant="heading2">Şu an bir başlangıç önerisi gösterilemiyor</AppText>
            <AppText tone="secondary">Değerlendirme henüz tamamlanmamış olabilir ya da planın zaten seçilmiş olabilir.</AppText>
          </AppCard>
        ) : (
          <View style={styles.stack}>
            <AppCard variant="hero" selected testID={`bloom.starting-recommendation.plan.${view.recommendation}`} style={styles.cardStack}>
              <AppText variant="overline" tone="accent">ÖNERİLEN İLK ADIM</AppText>
              <AppText variant="heading1">{planCopy[view.recommendation].title}</AppText>
              <AppText tone="secondary">{planCopy[view.recommendation].description}</AppText>
              <AppButton testID="bloom.starting-recommendation.accept" label="Bu planla devam et" disabled={feature.locked} onPress={actions.accept} />
            </AppCard>
            <View style={styles.cardStack}>
              <AppText variant="heading2">Yanıtlarında görülen sinyaller</AppText>
              <AppText variant="bodySmall" tone="secondary">Bunlar yalnızca paylaştığın yanıtların bir özetidir.</AppText>
              {signalCopy.map(({ key, label }) => (
                <AppCard key={key} testID={`bloom.starting-recommendation.signal.${key}`} style={styles.signalRow}>
                  <AppText variant="title" style={styles.signalLabel}>{label}</AppText>
                  <AppText variant="bodySmall" tone="secondary">{levelCopy[view.result.dimensions[key]]}</AppText>
                </AppCard>
              ))}
            </View>
            {view.result.safetyFlag === "reported" ? (
              <AppCard testID="bloom.starting-recommendation.safety" style={styles.safetyCard}>
                <AppText variant="title">Sağlığınla ilgili bir not</AppText>
                <AppText tone="secondary">Bazı yanıtların bir sağlık profesyoneliyle konuşmaya değer olabilecek fiziksel bir değişime işaret ediyor. Bir ürologdan değerlendirme almayı düşünebilirsin.</AppText>
              </AppCard>
            ) : view.result.safetyFlag === "uncertain" ? (
              <AppCard testID="bloom.starting-recommendation.safety-uncertain" style={styles.cardStack}>
                <AppText variant="title">Sağlık sinyali belirsiz</AppText>
                <AppText tone="secondary">Bu konuda yanıtların net değil. Fiziksel bir değişim fark edersen bir sağlık profesyoneliyle görüşebilirsin.</AppText>
              </AppCard>
            ) : null}
          </View>
        )}
        <AppButton testID="bloom.starting-recommendation.close" label="Kapat" variant="ghost" disabled={!feature.canClose} onPress={actions.close} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  page: { gap: theme.spacing.xl2, paddingBottom: theme.spacing.xl3 },
  header: { gap: theme.spacing.md },
  stack: { gap: theme.spacing.lg },
  cardStack: { gap: theme.spacing.md },
  statusLine: { alignItems: "center" },
  statusPanel: { gap: theme.spacing.sm, padding: theme.spacing.md, borderRadius: theme.radius.lg, backgroundColor: theme.colors.bg.surface },
  signalRow: { minHeight: 72, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  signalLabel: { flex: 1 },
  safetyCard: { gap: theme.spacing.md, backgroundColor: theme.colors.bg.infoSubtle, borderColor: theme.colors.border.info }
});
