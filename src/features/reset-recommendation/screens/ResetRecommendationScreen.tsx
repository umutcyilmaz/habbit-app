import { StyleSheet, View } from "react-native";

import type { TrackingResetRecommendationSignal } from "../../../domain/reset/getTrackingResetRecommendation";
import { AppButton } from "../../../shared/components/v4/AppButton";
import { AppCard } from "../../../shared/components/v4/AppCard";
import { AppScreen } from "../../../shared/components/v4/AppScreen";
import { AppText } from "../../../shared/components/v4/AppText";
import { theme } from "../../../shared/design-system/v4/theme";
import { useResetRecommendationFeature } from "../useResetRecommendationFeature";

const signalLabels: Record<TrackingResetRecommendationSignal, string> = {
  erectionQualityDownwardTrend: "Son kayıtlarında ereksiyon kalitesi daha düşük seyrediyor.",
  repeatedFirmnessDecrease: "Sertlik azalması son kayıtlarda daha sık görülüyor.",
  recentExplicitContentPattern: "Son kayıtlarda açık içerik kullanımı tekrar ediyor."
};
const saveLabels = {
  loading: "Kayıtlar yükleniyor…", unavailable: "Kaydetme durumu kullanılamıyor", saving: "Bu cihaza kaydediliyor…",
  saved: "Bu cihaza kaydedildi", unconfirmed: "Kaydetme henüz doğrulanmadı"
};

export function ResetRecommendationScreen() {
  const feature = useResetRecommendationFeature();
  const { view, actions, locked } = feature;
  const needsStatusPanel = feature.saveState !== "saved" || feature.message !== null || feature.canRetry;

  return (
    <AppScreen scroll includeBottomNavClearance={false}>
      <View testID="bloom.reset-recommendation" style={styles.page}>
        <View style={styles.header}>
          <AppText variant="overline" tone="accent">15-Day Reset</AppText>
          <AppText variant="display" accessibilityRole="header">{view.kind === "unavailable" && !feature.recovery ? "Reset önerisi" : "Bir Reset dönemi değerlendirebilirsin"}</AppText>
          <AppText variant="bodyLarge" tone="secondary">{view.kind === "trackingRecommendation"
            ? "Son kayıtlarında birlikte görülen bazı değişimler nedeniyle 15 günlük Reset’i değerlendirebilirsin. Bu isteğe bağlı bir gözlemdir; tıbbi tanı değildir."
            : "15 günlük Reset isteğe bağlıdır. Dönem henüz başlamadı; devam etmek istersen önce başlangıç sorularını tamamlarsın."}</AppText>
        </View>
        <View style={needsStatusPanel ? styles.statusPanel : styles.statusLine}>
          <AppText testID="bloom.reset-recommendation.save-state" variant="bodySmall" tone={feature.saveState === "unconfirmed" ? "warning" : "secondary"} accessibilityLiveRegion="polite">{saveLabels[feature.saveState]}</AppText>
          {feature.message !== null ? <AppText testID="bloom.reset-recommendation.message" tone="danger" accessibilityRole="alert">{feature.message}</AppText> : null}
          {feature.canRetry ? <AppButton testID="bloom.reset-recommendation.retry" label="Yeniden kaydet" variant="secondary" disabled={feature.busy} onPress={actions.retry} /> : null}
        </View>

        {feature.recovery ? (
          <AppCard variant="hero" testID="bloom.reset-recommendation.recovery" style={styles.cardStack}>
            <AppText variant="heading1">Sonraki adım</AppText>
            <AppText tone="secondary">{feature.canContinue ? "Reset hazırlığın kaydedildi. Başlangıç sorularına devam edebilirsin." : "Başlangıç sorularına geçmeden önce kaydetmenin doğrulanması gerekiyor."}</AppText>
            <AppButton testID="bloom.reset-recommendation.continue" label="Devam et" disabled={!feature.canContinue || feature.busy} onPress={actions.continueAfterSave} />
          </AppCard>
        ) : view.kind === "unavailable" ? (
          <AppCard variant="hero" testID="bloom.reset-recommendation.unavailable" style={styles.cardStack}>
            <AppText variant="heading2">Şu an bir Reset önerisi gösterilemiyor</AppText>
            <AppText tone="secondary">Kayıtların hazır olduğunda uygun bir öneri burada görünebilir.</AppText>
          </AppCard>
        ) : (
          <View style={styles.stack}>
            {view.kind === "trackingRecommendation" ? (
              <View style={styles.stack}>
                <View style={styles.cardStack}>
                  <AppText variant="heading2">Son kayıtlarında görülenler</AppText>
                  {view.recommendation.signals.map((signal) => (
                    <AppCard key={signal} testID={`bloom.reset-recommendation.signal.${signal}`} style={styles.signalCard}>
                      <AppText>{signalLabels[signal]}</AppText>
                    </AppCard>
                  ))}
                </View>
                <AppCard testID="bloom.reset-recommendation.evidence" style={styles.cardStack}>
                  <AppText variant="title">Tracking özeti</AppText>
                  <AppText variant="bodySmall" tone="secondary">Son üç kayıt ve önceki üç kayıt üzerinden betimleyici bir özet.</AppText>
                  <AppText testID="bloom.reset-recommendation.previous-quality" variant="bodySmall" tone="secondary">Önceki üç kaydın ortalama ereksiyon kalitesi: {view.recommendation.evidence.previousAverageErectionQuality.toFixed(1)}</AppText>
                  <AppText testID="bloom.reset-recommendation.recent-quality" variant="bodySmall" tone="secondary">Son üç kaydın ortalama ereksiyon kalitesi: {view.recommendation.evidence.recentAverageErectionQuality.toFixed(1)}</AppText>
                  <AppText testID="bloom.reset-recommendation.explicit-ratio" variant="bodySmall" tone="secondary">Son üç kayıtta açık içerik kullanım oranı: %{Math.round(view.recommendation.evidence.recentExplicitContentRatio * 100)}</AppText>
                </AppCard>
              </View>
            ) : (
              <AppCard testID="bloom.reset-recommendation.persisted" style={styles.cardStack}>
                <AppText variant="heading2">Kaydedilmiş önerin</AppText>
                <AppText tone="secondary">Daha önce kaydedilmiş bir Reset önerin var. İstersen başlangıç sorularına geçebilirsin.</AppText>
              </AppCard>
            )}
            <AppCard variant="hero" style={styles.cardStack}>
              <AppText variant="overline" tone="accent">KARAR SENİN</AppText>
              <AppText variant="heading2">Hazırsan sonraki adıma geç</AppText>
              <AppText tone="secondary">Devam ettiğinde dört başlangıç sorusuna geçersin. Reset bu sorular tamamlandıktan sonra başlar.</AppText>
              <AppButton testID="bloom.reset-recommendation.accept" label="Reset’i değerlendir" disabled={locked} onPress={actions.accept} />
            </AppCard>
          </View>
        )}
        <AppButton testID="bloom.reset-recommendation.close" label="Kapat" variant="ghost" disabled={feature.saveState === "saving" || feature.saveState === "unconfirmed"} onPress={actions.close} />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  page: { gap: theme.spacing.xl2, paddingBottom: theme.spacing.xl3 },
  header: { gap: theme.spacing.md },
  stack: { gap: theme.spacing.lg },
  cardStack: { gap: theme.spacing.md },
  signalCard: { minHeight: 64, justifyContent: "center" },
  statusLine: { alignItems: "center" },
  statusPanel: { gap: theme.spacing.sm, padding: theme.spacing.md, borderRadius: theme.radius.lg, backgroundColor: theme.colors.bg.surface }
});
