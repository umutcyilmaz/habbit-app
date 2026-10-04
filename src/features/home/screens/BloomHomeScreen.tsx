import { StyleSheet, View } from "react-native";

import type { BloomHomeAction, BloomHomeReadModel, ContentFreeHomeTracker } from "../../../domain/home/getBloomHomeReadModel";
import { AppButton } from "../../../shared/components/v4/AppButton";
import { AppCard } from "../../../shared/components/v4/AppCard";
import { AppScreen } from "../../../shared/components/v4/AppScreen";
import { AppText } from "../../../shared/components/v4/AppText";
import { theme } from "../../../shared/design-system/v4/theme";
import { formatAverageInterval, formatErectionQuality, getBestContentFreeDays, type TrackingSummary } from "../homePresentation";
import { useBloomHomeFeature } from "../useBloomHomeFeature";

type Feature = ReturnType<typeof useBloomHomeFeature>;

const attentionCopy: Partial<Record<BloomHomeAction["id"], { title: string; button: string }>> = {
  resumeMasturbationSession: { title: "Devam eden oturum", button: "Oturuma devam et" },
  finishMasturbationSessionFeedback: { title: "Oturum geri bildirimi bekliyor", button: "Kaydı tamamla" },
  resumeUrgeControl: { title: "Devam eden dürtü kontrolü", button: "Devam et" },
  recordResetElapsedCompletion: { title: "15 gün tamamlandı", button: "Sonucu gör" },
  completeResetBaseline: { title: "Reset başlangıç soruları hazır", button: "Devam et" },
  reviewStartingRecommendation: { title: "Başlangıç önerin hazır", button: "Öneriyi gör" },
  reviewResetRecommendation: { title: "Reset önerin hazır", button: "Detayları gör" }
};

export function BloomHomeScreen() {
  const feature = useBloomHomeFeature();
  if (feature.hydrationStatus !== "ready") {
    return <AppScreen><AppCard testID="bloom.home.loading" variant="hero"><AppText variant="heading1">{feature.hydrationStatus === "error" ? "Home şu anda açılamıyor" : "Home yükleniyor"}</AppText><AppText tone="secondary">{feature.hydrationStatus === "error" ? "Kaydedilmiş verilerin kontrol edilemiyor." : "Kaydedilmiş verilerin açılıyor."}</AppText></AppCard></AppScreen>;
  }
  if (feature.model === null) {
    return <AppScreen><AppCard testID="bloom.home.unavailable" variant="hero"><AppText variant="heading1">Home şu anda kullanılamıyor</AppText><AppText tone="secondary">İlerleme bilgilerin kontrol edilemiyor.</AppText></AppCard></AppScreen>;
  }

  const { model } = feature;
  const resetProgress = model.trackingAvailability.resetRestriction.isRestrictionActive
    ? model.trackingAvailability.resetRestriction.progress : null;
  const contentFreeTracker = model.primaryTracker?.kind === "contentFree" ? model.primaryTracker : model.secondaryTracker;
  const isResetFirst = resetProgress !== null;

  return (
    <AppScreen scroll testID="bloom.home" contentContainerStyle={styles.page}>
      <View style={styles.header}>
        <AppText variant="display" accessibilityRole="header" style={styles.greeting}>Merhaba</AppText>
        <AppText variant="bodyLarge" tone="secondary">{isResetFirst ? `Reset ${resetProgress.currentDay}. gününde.` : "Takiplerin burada."}</AppText>
      </View>

      <AttentionCard action={model.primaryAction} onAction={feature.openAction} />

      {isResetFirst ? <ResetCard model={model} onAction={feature.openAction} onPanic={feature.openPanic} /> : null}
      {isResetFirst ? <ContentFreeCard tracker={contentFreeTracker} onOpen={feature.openContentFree} /> : null}
      {model.trackingAvailability.enabled ? <TrackingCard model={model} summary={feature.tracking} onAction={feature.openAction} restrained={isResetFirst} /> : null}
      {!isResetFirst ? <ContentFreeCard tracker={contentFreeTracker} onOpen={feature.openContentFree} /> : null}
      {!isResetFirst ? <AppButton testID="bloom.home.panic" label="Panic button" variant="secondary" onPress={feature.openPanic} /> : null}
      {model.resetRecommendationAction !== null && model.primaryAction?.id !== "reviewResetRecommendation" ? (
        <AppCard testID="bloom.home.reset-recommendation" style={styles.card}>
          <AppText variant="title">Reset önerisi</AppText>
          <AppText tone="secondary">Son kayıtlarında Reset’i değerlendirmeye değer bir örüntü var.</AppText>
          <AppButton testID="bloom.home.reset-recommendation.action" label="Detayları gör" variant="secondary" onPress={() => feature.openAction(model.resetRecommendationAction!)} />
        </AppCard>
      ) : null}
    </AppScreen>
  );
}

function AttentionCard({ action, onAction }: { action: BloomHomeAction | null; onAction: Feature["openAction"] }) {
  if (action === null) return null;
  const copy = attentionCopy[action.id];
  if (copy === undefined) return null;
  return (
    <AppCard testID="bloom.home.primary" variant="hero" style={styles.attention}>
      <AppText variant="overline" tone="accent">DEVAM ET</AppText>
      <AppText variant="heading1">{copy.title}</AppText>
      <AppButton testID="bloom.home.primary.action" label={copy.button} onPress={() => onAction(action)} />
    </AppCard>
  );
}

function ResetCard({ model, onAction, onPanic }: { model: BloomHomeReadModel; onAction: Feature["openAction"]; onPanic: () => void }) {
  const progress = model.trackingAvailability.resetRestriction.progress;
  if (progress === null) return null;
  const action = model.primaryAction?.id === "viewActiveReset" ? model.primaryAction : null;
  return (
    <AppCard testID="bloom.home.reset" variant="hero" style={[styles.card, styles.resetCard]}>
      <View style={styles.rowBetween}>
        <AppText variant="overline" tone="accent">15-DAY RESET</AppText>
        <AppText variant="bodySmall" tone="success">Aktif</AppText>
      </View>
      <View style={styles.bigValueRow}>
        <AppText testID="bloom.home.reset.current-day" style={styles.bigNumber}>{progress.currentDay}</AppText>
        <AppText variant="heading2" tone="secondary">/ 15 gün</AppText>
      </View>
      <View testID="bloom.home.reset.progress" accessibilityLabel={`${progress.currentDay} / 15 gün`} style={styles.dots}>
        {Array.from({ length: 15 }, (_, index) => <View key={index} style={[styles.dot, index < progress.currentDay ? styles.dotActive : null]} />)}
      </View>
      <AppButton testID="bloom.home.panic" label="Panic button" onPress={onPanic} />
      {action !== null ? <AppButton testID="bloom.home.reset.action" label="Reset'i görüntüle" variant="ghost" onPress={() => onAction(action)} /> : null}
    </AppCard>
  );
}

function ContentFreeCard({ tracker, onOpen }: { tracker: ContentFreeHomeTracker | null; onOpen: () => void }) {
  return (
    <AppCard testID="bloom.home.content-free" variant="hero" style={styles.card}>
      <AppText variant="overline" tone="accent">CONTENT-FREE</AppText>
      {tracker === null ? (
        <>
          <AppText variant="heading1">Porn-free sayacı</AppText>
          <AppText tone="secondary">İkinci bir sayaç · takibin devam eder</AppText>
          <AppButton testID="bloom.home.content-free.action" label="Sayacını başlat" variant="secondary" onPress={onOpen} />
        </>
      ) : (
        <>
          <View style={styles.bigValueRow}>
            <AppText testID="bloom.home.content-free.current" style={styles.bigNumber}>{tracker.progress.currentCompletedDays}</AppText>
            <AppText variant="heading2" tone="secondary">gün</AppText>
          </View>
          <AppText testID="bloom.home.content-free.best" tone="secondary">En uzun seri {getBestContentFreeDays(tracker.progress.effectiveBestStreakSeconds)} gün</AppText>
          <AppButton testID="bloom.home.content-free.action" label="Sayacı yönet" variant="ghost" onPress={onOpen} />
        </>
      )}
    </AppCard>
  );
}

function TrackingCard({ model, summary, onAction, restrained }: { model: BloomHomeReadModel; summary: TrackingSummary; onAction: Feature["openAction"]; restrained: boolean }) {
  const action = model.primaryAction?.id === "startMasturbationSession" && model.trackingAvailability.canStartSession ? model.primaryAction : null;
  return (
    <AppCard testID="bloom.home.tracking" variant="hero" style={[styles.card, restrained ? styles.restrained : null]}>
      <View style={styles.rowBetween}>
        <AppText variant="overline" tone={restrained ? "muted" : "primary"}>MASTURBATION TRACKING</AppText>
        {restrained ? <AppText variant="labelSmall" tone="secondary" style={styles.badge}>Donduruldu</AppText> : null}
      </View>
      <View style={styles.metrics}>
        <View style={styles.metric}><AppText tone="secondary">Ortalama aralık</AppText><AppText testID="bloom.home.tracking.average-interval" variant="heading1">{formatAverageInterval(summary.averageIntervalSeconds)}</AppText></View>
        <View style={styles.metric}><AppText tone="secondary">Ereksiyon kalitesi</AppText><AppText testID="bloom.home.tracking.erection-quality" variant="heading1">{formatErectionQuality(summary.averageErectionQuality)}</AppText></View>
      </View>
      {restrained ? <AppText tone="secondary">Reset boyunca yeni oturum başlatılamaz.</AppText> : null}
      {action !== null ? <AppButton testID="bloom.home.tracking.action" label={summary.completedSessionCount === 0 ? "İlk kaydını ekle" : "Oturum başlat"} onPress={() => onAction(action)} /> : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  page: { gap: theme.spacing.lg },
  header: { gap: theme.spacing.xs, marginBottom: theme.spacing.sm },
  greeting: { fontSize: 32, lineHeight: 40 },
  card: { gap: theme.spacing.lg },
  attention: { gap: theme.spacing.md, borderColor: theme.colors.border.accent },
  resetCard: { borderColor: theme.colors.accent.primary, borderWidth: 1.5 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  bigValueRow: { flexDirection: "row", alignItems: "baseline", gap: theme.spacing.md },
  bigNumber: { color: theme.colors.text.primary, fontSize: 48, lineHeight: 58, fontFamily: theme.typography.display.fontFamily },
  dots: { flexDirection: "row", gap: 5, overflow: "hidden" },
  dot: { height: 12, flex: 1, borderRadius: 6, backgroundColor: theme.colors.bg.surfaceElevated },
  dotActive: { backgroundColor: theme.colors.accent.primary },
  metrics: { flexDirection: "row", gap: theme.spacing.sm },
  metric: { flex: 1, minWidth: 0, minHeight: 100, padding: theme.spacing.md, borderRadius: theme.radius.lg, backgroundColor: theme.colors.bg.surfaceElevated, gap: theme.spacing.md },
  restrained: { opacity: 0.55 },
  badge: { backgroundColor: theme.colors.bg.surfaceElevated, borderRadius: theme.radius.lg, paddingHorizontal: theme.spacing.sm, paddingVertical: theme.spacing.xs }
});
