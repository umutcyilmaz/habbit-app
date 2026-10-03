import { StyleSheet, View } from "react-native";
import type { OnboardingRecommendation } from "../../../domain/models/OnboardingDimensions";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { useStartingRecommendationFeature } from "../useStartingRecommendationFeature";

const copy: Record<OnboardingRecommendation, { title: string; description: string }> = {
  masturbation_tracking: { title: "Masturbation Tracking ile başla", description: "Kayıtlı başlangıç önerin, seanslarını ve gözlemlerini takip etmek. Kabul ettiğinde Tracking açılır; bir seans başlatılmaz." },
  content_free: { title: "Content-Free sayacını başlat", description: "Kayıtlı başlangıç önerin, açık içerik kullanmadığın süreyi takip etmek. Kabul ettiğinde Content-Free sayacı başlar." },
  reset: { title: "15-Day Reset’i değerlendir", description: "Kayıtlı başlangıç önerin 15-Day Reset. Kabul ettiğinde başlangıç sorularına geçersin; 15 günlük dönem bu soruları tamamladığında başlar." },
  reset_and_content_free: { title: "15-Day Reset + Content-Free", description: "Kayıtlı başlangıç önerin Reset ve Content-Free. Kabul ettiğinde Content-Free sayacı başlar ve Reset başlangıç sorularına geçersin. Reset dönemi soruları tamamladığında başlar." }
};
const saveLabels = {
  loading: "Kayıtlar yükleniyor…", unavailable: "İşlem şu an kullanılamıyor", saving: "Bu cihaza kaydediliyor…",
  saved: "Bu cihazda kayıtlı", unconfirmed: "Kaydetme henüz doğrulanmadı"
};

export function StartingRecommendationScreen() {
  const feature = useStartingRecommendationFeature();
  const { view, actions } = feature;
  return (
    <AppScreen>
      <View testID="bloom.starting-recommendation" style={styles.stack}>
        <AppText variant="heading" accessibilityRole="header">Başlangıç önerin</AppText>
        <AppText testID="bloom.starting-recommendation.save-state" variant="bodySmall" tone="secondary" accessibilityLiveRegion="polite">{saveLabels[feature.saveState]}</AppText>
        {feature.message !== null ? <AppText testID="bloom.starting-recommendation.message" tone="danger" accessibilityRole="alert">{feature.message}</AppText> : null}
        {feature.canRetry ? <AppButton testID="bloom.starting-recommendation.retry" variant="secondary" disabled={feature.busy} onPress={actions.retry}>Yeniden kaydet</AppButton> : null}
        {feature.recovery ? (
          <AppCard testID="bloom.starting-recommendation.recovery" style={styles.stack}>
            <AppText>{feature.canContinue ? "Başlangıç planın kaydedildi. Devam edebilirsin." : "Devam etmeden önce kaydetmenin doğrulanması gerekiyor."}</AppText>
            <AppButton testID="bloom.starting-recommendation.continue" disabled={!feature.canContinue || feature.busy} onPress={actions.continueAfterSave}>Devam et</AppButton>
          </AppCard>
        ) : view.kind === "unavailable" ? (
          <AppCard testID="bloom.starting-recommendation.unavailable"><AppText tone="secondary">Şu an değerlendirilecek bir başlangıç önerisi yok.</AppText></AppCard>
        ) : (
          <AppCard testID={`bloom.starting-recommendation.plan.${view.recommendation}`} style={styles.stack}>
            <AppText variant="heading">{copy[view.recommendation].title}</AppText>
            <AppText>{copy[view.recommendation].description}</AppText>
            <AppButton testID="bloom.starting-recommendation.accept" disabled={feature.locked} onPress={actions.accept}>Kabul et ve devam et</AppButton>
          </AppCard>
        )}
        <AppButton testID="bloom.starting-recommendation.close" variant="ghost" disabled={!feature.canClose} onPress={actions.close}>Kapat</AppButton>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({ stack: { gap: theme.spacing.lg } });
