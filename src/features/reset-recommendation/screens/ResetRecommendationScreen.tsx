import { StyleSheet, View } from "react-native";
import type { TrackingResetRecommendationSignal } from "../../../domain/reset/getTrackingResetRecommendation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { useResetRecommendationFeature } from "../useResetRecommendationFeature";

const signalLabels: Record<TrackingResetRecommendationSignal, string> = {
  erectionQualityDownwardTrend: "Son üç kayıtta ereksiyon kalitesi önceki üç kayda göre daha düşük.",
  repeatedFirmnessDecrease: "Son kayıtlarda sertlik azalması daha sık kaydedildi.",
  recentExplicitContentPattern: "Son üç kaydın en az ikisinde açık içerik kullanımı kaydedildi."
};
const saveLabels = {
  loading: "Kayıtlar yükleniyor…", unavailable: "Kaydetme durumu kullanılamıyor", saving: "Bu cihaza kaydediliyor…",
  saved: "Bu cihazda kayıtlı", unconfirmed: "Kaydetme henüz doğrulanmadı"
};

export function ResetRecommendationScreen() {
  const feature = useResetRecommendationFeature();
  const { view, actions, locked } = feature;
  return (
    <AppScreen>
      <View testID="bloom.reset-recommendation" style={styles.stack}>
        <AppText variant="heading" accessibilityRole="header">15-Day Reset</AppText>
        <AppText testID="bloom.reset-recommendation.save-state" variant="bodySmall" tone="secondary" accessibilityLiveRegion="polite">
          {saveLabels[feature.saveState]}
        </AppText>
        {feature.message !== null ? <AppText testID="bloom.reset-recommendation.message" tone="danger" accessibilityRole="alert">{feature.message}</AppText> : null}
        {feature.canRetry ? <AppButton testID="bloom.reset-recommendation.retry" variant="secondary" disabled={feature.busy} onPress={actions.retry}>Yeniden kaydet</AppButton> : null}
        {feature.recovery ? (
          <AppCard testID="bloom.reset-recommendation.recovery" style={styles.stack}>
            <AppText>{feature.canContinue ? "Reset hazırlığın kaydedildi. Başlangıç sorularına devam edebilirsin." : "Başlangıç sorularına geçmeden önce kaydetmenin doğrulanması gerekiyor."}</AppText>
            <AppButton testID="bloom.reset-recommendation.continue" disabled={!feature.canContinue || feature.busy} onPress={actions.continueAfterSave}>Devam et</AppButton>
          </AppCard>
        ) : view.kind === "unavailable" ? (
          <AppCard testID="bloom.reset-recommendation.unavailable"><AppText tone="secondary">Şu an değerlendirilecek bir Reset önerisi yok.</AppText></AppCard>
        ) : (
          <AppCard style={styles.stack}>
            {view.kind === "trackingRecommendation" ? (
              <View testID="bloom.reset-recommendation.evidence" style={styles.stack}>
                <AppText>Son Tracking kayıtlarında değerlendirebileceğin bir örüntü var. Reset isteğe bağlı bir öneridir.</AppText>
                <AppText testID="bloom.reset-recommendation.previous-quality">Önceki üç kaydın ortalama ereksiyon kalitesi: {view.recommendation.evidence.previousAverageErectionQuality.toFixed(1)}</AppText>
                <AppText testID="bloom.reset-recommendation.recent-quality">Son üç kaydın ortalama ereksiyon kalitesi: {view.recommendation.evidence.recentAverageErectionQuality.toFixed(1)}</AppText>
                <AppText testID="bloom.reset-recommendation.explicit-ratio">Son üç kayıtta açık içerik kullanım oranı: %{Math.round(view.recommendation.evidence.recentExplicitContentRatio * 100)}</AppText>
                <AppText testID="bloom.reset-recommendation.interval">Son üç kaydın başlangıçları arasındaki ortalama süre: {(view.recommendation.evidence.recentAverageIntervalSeconds / 3600).toFixed(1)} saat</AppText>
                {view.recommendation.signals.map((signal) => <AppText key={signal} testID={`bloom.reset-recommendation.signal.${signal}`}>{signalLabels[signal]}</AppText>)}
              </View>
            ) : <AppText testID="bloom.reset-recommendation.persisted">Kayıtlı bir Reset önerin var. İstersen başlangıç sorularına geçebilirsin.</AppText>}
            <AppText tone="secondary">Devam etmek yalnızca Reset hazırlığını oluşturur. 15 günlük dönem başlangıç sorularını tamamladığında başlar.</AppText>
            <AppButton testID="bloom.reset-recommendation.accept" disabled={locked} onPress={actions.accept}>Reset’i değerlendir</AppButton>
          </AppCard>
        )}
        <AppButton testID="bloom.reset-recommendation.close" variant="ghost" disabled={feature.saveState === "saving" || feature.saveState === "unconfirmed"} onPress={actions.close}>Kapat</AppButton>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({ stack: { gap: theme.spacing.lg } });
