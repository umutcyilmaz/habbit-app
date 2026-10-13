import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import type { BloomHomeAction, BloomHomeReadModel, ContentFreeHomeTracker } from "../../../domain/home/getBloomHomeReadModel";
import { AppButton } from "../../../shared/components/v4/AppButton";
import { AppCard } from "../../../shared/components/v4/AppCard";
import { AppScreen } from "../../../shared/components/v4/AppScreen";
import { AppText } from "../../../shared/components/v4/AppText";
import { formatAverageInterval, formatErectionQuality, getBestContentFreeDays } from "../homePresentation";
import { useBloomHomeFeature } from "../useBloomHomeFeature";
import { TrackingHistoryCard } from "../history/TrackingHistoryCard";
import { HomeAtmosphere } from "../components/HomeAtmosphere";
import { HomeCounter } from "../components/HomeCounter";
import { HomeStatusCapsules } from "../components/HomeStatusCapsules";

type Feature = ReturnType<typeof useBloomHomeFeature>;
const attentionCopy: Partial<Record<BloomHomeAction["id"], { title: string; button: string }>> = {
  resumeMasturbationSession: { title: "Devam eden oturum", button: "Oturuma devam et" },
  finishMasturbationSessionFeedback: { title: "Oturum geri bildirimi bekliyor", button: "Kaydı tamamla" },
  resumeUrgeControl: { title: "Devam eden dürtü kontrolü", button: "Devam et" },
  reviewResetContentFreeContinuation: { title: "15 günlük Reset'i tamamladın!", button: "Content-Free ile devam et" },
  recordResetElapsedCompletion: { title: "15 gün tamamlandı", button: "Sonucu gör" },
  completeResetBaseline: { title: "Reset başlangıç soruları hazır", button: "Devam et" },
  reviewStartingRecommendation: { title: "Başlangıç önerin hazır", button: "Öneriyi gör" },
  reviewResetRecommendation: { title: "Reset önerin hazır", button: "Detayları gör" },
};

export function BloomHomeScreen() {
  const feature = useBloomHomeFeature(), reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const priorityId = feature.model?.primaryAction?.id;
  const prioritize = priorityId !== undefined && (attentionCopy[priorityId] !== undefined || priorityId === "viewActiveReset");
  useFocusEffect(useCallback(() => {
    if (prioritize) scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [prioritize, priorityId]));
  const enter = (delay: number) => reduced ? {} : { entering: FadeInDown.delay(delay).duration(350) };
  if (feature.hydrationStatus !== "ready" || feature.model === null) {
    const loading = feature.hydrationStatus !== "ready";
    return <AppScreen style={styles.screen}><AppCard testID={loading ? "bloom.home.loading" : "bloom.home.unavailable"} style={styles.card}>
      <AppText accessibilityRole="header" style={styles.heading}>{feature.hydrationStatus === "loading" ? "Ana sayfa yükleniyor" : "Ana sayfa şu anda kullanılamıyor"}</AppText>
      <AppText style={styles.copy}>Kaydedilmiş verilerin doğrulanmadan ilerleme özeti gösterilmez.</AppText>
    </AppCard></AppScreen>;
  }
  const { model } = feature;
  const resetActive = model.trackingAvailability.resetRestriction.isRestrictionActive;
  const tracker = model.primaryTracker?.kind === "contentFree" ? model.primaryTracker : model.secondaryTracker;
  const contentFirst = resetActive || (!model.trackingAvailability.enabled && tracker !== null);
  // Recreate only the native scroll layout on Dynamic Type changes. Feature
  // controllers and save guards remain mounted; iOS remeasures scaled text.
  // Keep the top inset outside the scroll viewport: content and fog are clipped
  // below the opaque system status area, even when the user scrolls or bounces.
  return <View testID="bloom.home.safe-area" style={[styles.root, { paddingTop: insets.top }]}>
    <AppScreen key={fontScale} scroll scrollRef={scrollRef} testID="bloom.home" style={[styles.screen, styles.scrollViewport]} contentContainerStyle={styles.page}>
      <HomeAtmosphere />
      <Animated.View {...enter(0)} style={styles.header}>
        <AppText accessibilityRole="header" style={styles.greeting}>Merhaba</AppText>
      </Animated.View>
      <AttentionCard action={model.primaryAction} onAction={feature.openAction} />
      {resetActive ? <ResetHero feature={feature} /> : null}
      {contentFirst && !resetActive ? <ContentFreeCard tracker={tracker} feature={feature} /> : null}
      {model.trackingAvailability.enabled ? <TrackingCard feature={feature} restrained={resetActive} />
        : model.trackingAvailability.canEnableTracking ? <InactiveTrackingCard feature={feature} boxed={contentFirst} />
        : <AppCard testID="bloom.home.tracking.restricted" style={styles.card}><AppText style={styles.heading}>Mastürbasyon takibi kapalı</AppText><AppText style={styles.copy}>{model.trackingAvailability.resetRestriction.needsCompletionTransition ? "Reset tamamlanmasının kaydı henüz bekliyor. Takip seçenekleri doğrulanmış sonuçtan sonra açılır." : "Reset boyunca yeni takip veya oturum başlatılamaz."}</AppText></AppCard>}
      {(!contentFirst || resetActive) ? <Animated.View {...enter(100)}><ContentFreeCard tracker={tracker} feature={feature} /></Animated.View> : null}
      {!resetActive ? <UrgeEntry onPress={feature.openPanic} /> : null}
      {model.resetRecommendationAction !== null && model.primaryAction?.id !== "reviewResetRecommendation" ? <AppCard testID="bloom.home.reset-recommendation" style={[styles.card, styles.recommendation]}>
        <AppText style={styles.eyebrow}>RESET ÖNERİSİ</AppText><AppText style={styles.heading}>Bir ara vermeyi değerlendirebilirsin</AppText>
        <AppText style={styles.copy}>Son kayıtlarında Reset’i değerlendirmeye değer bir örüntü var.</AppText>
        <AppButton testID="bloom.home.reset-recommendation.action" label="Detayları gör" variant="secondary" style={styles.button} onPress={() => feature.openAction(model.resetRecommendationAction!)} />
      </AppCard> : null}
      <TrackingHistoryCard history={feature.history} />
      <AppText style={styles.footer}>Bu alan kayıtlı takiplerini özetler. Takiplerini ayrı ayrı yönetebilirsin.</AppText>
    </AppScreen>
  </View>;
}

function InactiveTrackingCard({ feature, boxed }: { feature: Feature; boxed: boolean }) {
  const activation = feature.trackingActivation;
  return <View testID="bloom.home.tracking.inactive" style={boxed ? styles.card : styles.hero}>
    <AppText accessibilityRole="header" style={boxed ? styles.heading : styles.heroLabel}>Mastürbasyon takibi</AppText>
    {!boxed ? <HomeCounter id="bloom.home.tracking.elapsed" seconds={null} observedAt={feature.observationTime} now={feature.now} emptyLabel="Takip şu anda kapalı" /> : null}
    <AppText style={[styles.copy, !boxed && styles.center]}>Takibe kendi zamanında başla. Bu takip, Content-Free sayacından bağımsız çalışır.</AppText>
    {activation.message !== null ? <AppText testID="bloom.home.tracking.activation-message" accessibilityLiveRegion="polite" style={styles.copy}>{activation.message}</AppText> : null}
    {activation.canRetry ? <AppButton testID="bloom.home.tracking.retry" label="Yeniden kaydet" loading={activation.busy} onPress={activation.retry} style={styles.button} />
      : <AppButton testID="bloom.home.tracking.enable" label="Takibi başlat" variant="secondary" loading={activation.busy} loadingLabel="Kaydediliyor…" disabled={activation.locked} onPress={activation.enable} style={[styles.button, !boxed && styles.heroButton]} />}
    {!boxed ? <AppText style={styles.helper}>{feature.tracking.completedSessionCount > 0 ? `${feature.tracking.completedSessionCount} tamamlanan kaydın korunur. Takip isteğe bağlıdır.` : "Takip isteğe bağlıdır. Henüz tamamlanan kaydın yok."}</AppText> : null}
  </View>;
}

function AttentionCard({ action, onAction }: { action: BloomHomeAction | null; onAction: Feature["openAction"] }) {
  if (action === null) return null;
  const copy = attentionCopy[action.id];
  if (!copy) return null;
  return <AppCard testID="bloom.home.primary" style={[styles.card, styles.attention]}>
    <AppText style={styles.eyebrow}>DEVAM ET</AppText><AppText accessibilityRole="header" style={styles.heading}>{copy.title}</AppText>
    <AppButton testID="bloom.home.primary.action" label={copy.button} style={styles.button} onPress={() => onAction(action)} />
  </AppCard>;
}

function ResetHero({ feature }: { feature: Feature }) {
  const model = feature.model!, progress = model.trackingAvailability.resetRestriction.progress;
  if (progress === null) return null;
  const action = model.primaryAction?.id === "viewActiveReset" ? model.primaryAction : null;
  const elapsed = Math.max(0, 15 * 86400 - progress.remainingSeconds);
  const end = new Date(Date.parse(feature.observationTime) + progress.remainingSeconds * 1000).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
  return <View testID="bloom.home.reset" style={styles.hero}>
    <AppText style={styles.heroLabel}>Reset’e başlayalı</AppText>
    <HomeCounter id="bloom.home.reset.elapsed" seconds={elapsed} observedAt={feature.observationTime} now={feature.now} maximum={15 * 86400} />
    <HomeStatusCapsules values={[
      { icon: "flag", label: "Gün", value: `${progress.currentDay}/15`, id: "bloom.home.reset.current-day", spoken: `Reset ${progress.currentDay}. gününde, toplam 15 gün` },
      { icon: "calendar", label: "Bitiş", value: end },
      { icon: "stack", label: "Kalan gün", value: String(progress.remainingDays) },
    ]} />
    <View testID="bloom.home.reset.progress" accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 15, now: progress.completedDays }} accessibilityLabel={`${progress.completedDays} tamamlanan Reset günü, ${progress.currentDay}. gündesin`} style={styles.dots}>
      {Array.from({ length: 15 }, (_, index) => <View key={index} style={[styles.dot, index < progress.completedDays && styles.dotActive, index === progress.completedDays && styles.dotCurrent]} />)}
    </View>
    <UrgeEntry onPress={feature.openPanic} hero />
    {action ? <AppButton testID="bloom.home.reset.action" label="Reset'i görüntüle" variant="ghost" onPress={() => feature.openAction(action)} /> : null}
  </View>;
}

function ContentFreeCard({ tracker, feature }: { tracker: ContentFreeHomeTracker | null; feature: Feature }) {
  const continuation = feature.contentFreeContinuation != null;
  const progress = feature.contentFreeProgress;
  const best = progress ? getBestContentFreeDays(progress.effectiveBestStreakSeconds) : null;
  const history = tracker === null && best !== null && best > 0;
  const newStreak = tracker?.progress.currentCompletedDays === 0 && tracker.progress.hasEffectiveViolation;
  return <AppCard testID="bloom.home.content-free" style={styles.card}>
    <View style={styles.rowBetween}><AppText accessibilityRole="header" style={styles.cardTitle}>İçeriksiz sayaç</AppText><View style={styles.badge}><AppText style={styles.badgeText}>{tracker ? "Aktif" : history ? "Durduruldu" : "Kapalı"}</AppText></View></View>
    <View style={styles.valueRow}><AppText testID="bloom.home.content-free.current" style={[styles.cardNumber, tracker === null && styles.muted]}>{tracker?.progress.currentCompletedDays ?? "—"}</AppText><AppText style={styles.cardUnit}>gün</AppText></View>
    <AppText style={styles.copy}>{continuation ? "Reset ile kazandığın süreyle devam edebilirsin." : newStreak ? "Yeni serin başladı. Önceki kayıtların korunur." : tracker ? "Tamamlanan içeriksiz günlerin." : "İçeriksiz günleri ayrı sayar. Mastürbasyon takibinden bağımsız çalışır."}</AppText>
    {best !== null && (tracker !== null || history) ? <AppText testID="bloom.home.content-free.best" style={styles.copy}>En uzun seri {best} gün</AppText> : null}
    <AppButton testID="bloom.home.content-free.action" label={continuation ? "Reset serinle devam et" : tracker ? "Sayacı yönet" : history ? "Yeniden başlat" : "Sayacını başlat"} variant="secondary" style={styles.button} onPress={feature.openContentFree} />
    <AppText style={styles.finePrint}>Bu sayaç içerik engellemez.</AppText>
  </AppCard>;
}

function TrackingCard({ feature, restrained }: { feature: Feature; restrained: boolean }) {
  const model = feature.model!, summary = feature.tracking;
  const action = model.primaryAction?.id === "startMasturbationSession" && model.trackingAvailability.canStartSession ? model.primaryAction : null;
  const metrics = [
    { icon: "clock" as const, label: "Ortalama", value: formatAverageInterval(summary.averageIntervalSeconds), id: "bloom.home.tracking.average-interval", spoken: `Ortalama oturum aralığı: ${formatAverageInterval(summary.averageIntervalSeconds)}` },
    { icon: "drop" as const, label: "Kalite", value: formatErectionQuality(summary.averageErectionQuality), id: "bloom.home.tracking.erection-quality", spoken: `Ortalama ereksiyon kalitesi: ${formatErectionQuality(summary.averageErectionQuality)}` },
    { icon: "calendar" as const, label: "Tüm zamanlar", value: String(summary.completedSessionCount), id: "bloom.home.tracking.completed", spoken: `${summary.completedSessionCount} tamamlanan Tracking oturumu, tüm zamanlar` },
  ];
  return <View testID="bloom.home.tracking" style={restrained ? styles.card : styles.hero}>
    {restrained ? <View style={styles.rowBetween}><AppText accessibilityRole="header" style={styles.cardTitle}>Mastürbasyon takibi</AppText><AppText style={styles.frozen}>Reset boyunca beklemede</AppText></View> : <>
      <AppText style={styles.heroLabel}>Son tamamlanan oturumdan beri</AppText>
      <HomeCounter id="bloom.home.tracking.elapsed" seconds={feature.trackingElapsedSeconds} observedAt={feature.observationTime} now={feature.now} />
    </>}
    <HomeStatusCapsules values={metrics} />
    {restrained ? <AppText style={styles.copy}>Reset boyunca yeni oturum başlatılamaz. Kayıtlı ortalamaların korunur.</AppText> : null}
    {action ? <AppButton testID="bloom.home.tracking.action" label={summary.completedSessionCount === 0 ? "İlk kaydını ekle" : "Oturum başlat"} style={[styles.button, styles.heroButton]} onPress={() => feature.openAction(action)} /> : null}
    {!restrained && summary.completedSessionCount === 0 ? <AppText style={styles.helper}>İlk tamamlanan kaydından sonra geçen süre ve kalite burada görünür. Ortalama aralık için iki kayıt gerekir.</AppText> : null}
  </View>;
}
function UrgeEntry({ onPress, hero = false }: { onPress: () => void; hero?: boolean }) {
  const [focused, setFocused] = useState(false);
  // This action has no loading indicator. Give the scaled label the entire
  // available width instead of reserving AppButton's two indicator slots.
  return <Pressable testID="bloom.home.panic" accessibilityRole="button" accessibilityLabel="Şu an zorlanıyorum, Urge Control’ü aç"
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onPress={onPress}
    style={({ pressed }) => [styles.button, styles.urge, hero && styles.heroButton, pressed && styles.urgePressed]}>
    {focused ? <View pointerEvents="none" style={styles.urgeFocus} /> : null}
    <AppText variant="label" tone="onPrimary" style={styles.urgeLabel}>Şu an zorlanıyorum</AppText>
  </Pressable>;
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#010208" }, screen: { backgroundColor: "#000" }, scrollViewport: { paddingTop: 0, overflow: "hidden" }, page: { paddingHorizontal: 16, paddingTop: 8, gap: 14 },
  header: { gap: 4, paddingHorizontal: 6, marginBottom: 12 }, greeting: { fontSize: 31, lineHeight: 42, fontFamily: "Inter_700Bold", letterSpacing: -.9 },
  hero: { alignItems: "center", gap: 14, paddingTop: 18, paddingBottom: 36 }, heroLabel: { fontSize: 15, lineHeight: 21, fontFamily: "Inter_600SemiBold", color: "#c9cbd7", textAlign: "center" }, heroButton: { alignSelf: "center", marginTop: 10 },
  card: { backgroundColor: "#141415", borderColor: "rgba(255,255,255,.07)", borderRadius: 30, padding: 20, gap: 14, width: "100%" }, attention: { borderColor: "rgba(170,179,255,.4)" }, recommendation: { borderColor: "rgba(255,191,105,.25)" },
  heading: { fontFamily: "Inter_600SemiBold", fontSize: 23, lineHeight: 31 }, cardTitle: { fontFamily: "Inter_600SemiBold", fontSize: 17, lineHeight: 24, flexShrink: 1 }, copy: { fontSize: 14.5, lineHeight: 22, color: "#8e8e93" }, center: { textAlign: "center", color: "#c9cbd7" }, eyebrow: { fontSize: 12, lineHeight: 18, fontFamily: "Inter_600SemiBold", color: "#aab3ff", letterSpacing: 1 },
  helper: { fontSize: 12, lineHeight: 18, color: "#8e8e93", textAlign: "center", paddingHorizontal: 16 }, finePrint: { fontSize: 12, lineHeight: 18, color: "#8e8e93" }, footer: { fontSize: 12, lineHeight: 18, color: "#8e8e93", textAlign: "center", marginVertical: 12 },
  button: { borderRadius: 28, minHeight: 52 }, urge: { backgroundColor: "#b72b39", width: "100%", paddingHorizontal: 8, paddingVertical: 16, alignItems: "center", justifyContent: "center" }, urgePressed: { backgroundColor: "#9d2330" }, urgeLabel: { textAlign: "center", width: "100%" }, urgeFocus: { position: "absolute", top: -3, bottom: -3, left: -3, right: -3, borderWidth: 3, borderColor: "#aab3ff", borderRadius: 31 }, rowBetween: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", justifyContent: "space-between", gap: 10 }, badge: { borderRadius: 20, backgroundColor: "rgba(170,179,255,.1)", paddingHorizontal: 10, paddingVertical: 5 }, badgeText: { color: "#aab3ff", fontSize: 12, lineHeight: 17, fontFamily: "Inter_500Medium" }, frozen: { color: "#8e8e93", fontSize: 12, lineHeight: 18, backgroundColor: "#242428", borderRadius: 14, padding: 6 },
  valueRow: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 8 }, cardNumber: { fontFamily: "Inter_700Bold", fontSize: 60, lineHeight: 72, fontVariant: ["tabular-nums"], letterSpacing: -1.2 }, cardUnit: { color: "#aab3ff", fontFamily: "Inter_600SemiBold", fontSize: 20, lineHeight: 28 }, muted: { color: "#63636d" },
  dots: { flexDirection: "row", width: "100%", maxWidth: 300, gap: 4, marginTop: 2 }, dot: { flex: 1, minWidth: 0, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,.13)" }, dotActive: { backgroundColor: "#3a4bff" }, dotCurrent: { backgroundColor: "#aab3ff" },
});
