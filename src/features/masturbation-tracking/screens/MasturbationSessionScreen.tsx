import { useState, type PropsWithChildren } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { ErectionQuality, MasturbationEndingReason, MasturbationSessionFeedback } from "../../../domain/models/MasturbationSession";
import type { MasturbationTrackingStartBlockReason } from "../../../domain/productPolicy/getMasturbationTrackingAvailability";
import { AppButton } from "../../../shared/components/v4/AppButton";
import { AppCard } from "../../../shared/components/v4/AppCard";
import { AppScreen } from "../../../shared/components/v4/AppScreen";
import { AppText } from "../../../shared/components/v4/AppText";
import { theme } from "../../../shared/design-system/v4/theme";
import { formatMasturbationElapsedSeconds } from "../masturbationSessionView";
import { useMasturbationSessionFeature } from "../useMasturbationSessionFeature";

type SessionFeature = ReturnType<typeof useMasturbationSessionFeature>;
type FeedbackStep = 1 | 2 | 3;
const erectionQualities: readonly ErectionQuality[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const endingReasons: ReadonlyArray<{ value: MasturbationEndingReason; label: string }> = [
  { value: "climaxed", label: "Boşaldım" },
  { value: "stoppedBeforeClimax", label: "Boşalmadan durdum" },
  { value: "firmnessDecreased", label: "Sertlik azaldı" },
  { value: "feltAnxious", label: "Kaygılı hissettim" },
  { value: "stoppedByChoice", label: "Kendi isteğimle bıraktım" },
  { value: "other", label: "Diğer" }
];

export function MasturbationSessionStartScreen() {
  const feature = useMasturbationSessionFeature("start");
  const { view, availability, busy, locked, actions } = feature;
  return (
    <SessionPage feature={feature} title="Mastürbasyon takibi" testID="bloom.masturbation.start">
      {view.kind === "active" || view.kind === "awaitingFeedback" ? <ContinueSessionCard feature={feature} />
        : view.kind === "completed" ? <CompletedSessionCard feature={feature} />
        : view.kind === "invalid" || view.kind === "mismatch" ? <UnavailableSessionCard kind={view.kind} />
        : <View style={styles.stack}>
            <View style={styles.intro}>
              <AppText variant="overline" tone="accent">KENDİ RİTMİNDE</AppText>
              <AppText variant="display" accessibilityRole="header">Yükselişi daha erken fark et.</AppText>
              <AppText variant="bodyLarge" tone="secondary">Bu pratik, bedenindeki değişimi fark etmek ve gerektiğinde duraklamak için bir alan.</AppText>
            </View>
            <View style={styles.introCards}>
              <IntroCard title="Süre hedefi yok" detail="Kendine bir süre belirlemek zorunda değilsin." />
              <IntroCard title="Duraklama pratiğin kendisi" detail="İhtiyaç duyduğunda ara verip sonra devam edebilirsin." />
              <IntroCard title="Sertlik değişebilir" detail="Değişimleri yargılamadan gözlemle." />
              <IntroCard title="Süre sadece bir trend" detail="Kaydedilen süre, zaman içindeki eğilimi görmen içindir." />
            </View>
            {availability?.canStartSession !== true ?
              <AppCard><AppText testID="bloom.masturbation.start.unavailable" variant="bodySmall" tone="secondary">{getStartBlockMessage(availability?.blockReason)}</AppText></AppCard> : null}
            <AppButton testID="bloom.masturbation.start.begin" label="Başla" disabled={locked || availability?.canStartSession !== true} loading={busy} onPress={actions.start} />
          </View>}
    </SessionPage>
  );
}

export function MasturbationSessionActiveScreen() {
  const feature = useMasturbationSessionFeature("active");
  const { view, locked, actions } = feature;
  return (
    <SessionPage feature={feature} title={view.kind === "active" && view.paused ? "Duraklama" : "Pratiğin"} testID="bloom.masturbation.active">
      {view.kind === "active" ? view.paused ?
        <View style={styles.pauseContent}>
          <AppText variant="overline" tone="accent" style={styles.centerText}>BİR AN DUR</AppText>
          <View style={styles.breathOuter} accessible accessibilityLabel="Nefes al. Kendini daha sakin hissettiğinde devam edebilirsin.">
            <View style={styles.breathMiddle}><View style={styles.breathInner}>
              <AppText variant="heading1" style={styles.centerText}>Nefes al</AppText>
            </View></View>
          </View>
          <AppText variant="bodyLarge" tone="secondary" style={styles.centerText}>Kendini daha sakin hissettiğinde devam edebilirsin.</AppText>
          <View style={styles.actions}>
            <AppButton testID="bloom.masturbation.active.resume" label="Oturuma devam et" disabled={locked} onPress={actions.endPause} />
            <AppButton testID="bloom.masturbation.active.end" label="Pratiği bitir" variant="secondary" disabled={locked} onPress={actions.end} />
          </View>
        </View> :
        <View style={styles.stack}>
          <View style={styles.intro}>
            <AppText variant="overline" tone="accent">BEDENİNİ GÖZLEMLE</AppText>
            <AppText variant="display" accessibilityRole="header">Uyarılma seviyen</AppText>
            <AppText variant="bodyLarge" tone="secondary">Yükselişi fark et. Duraklama aralığına yaklaştığını hissettiğinde ara verebilirsin.</AppText>
          </View>
          <AppCard variant="hero" style={styles.scaleCard}>
            <AppText variant="overline" tone="accent" style={styles.centerText}>DURAKLAMA ARALIĞIN</AppText>
            <View style={styles.scaleTrack} accessible accessibilityLabel="1'den 10'a statik uyarılma rehberi. 7 civarı duraklama aralığıdır.">
              {erectionQualities.map((value) => <View key={value} style={styles.scaleCell}>
                <View style={[styles.scaleBar, { height: 20 + value * 4 }, value >= 7 ? styles.scaleBarPause : undefined, value === 7 ? styles.scaleBarMarker : undefined]} />
                <AppText variant="labelSmall" tone={value === 7 ? "accent" : "secondary"}>{value}</AppText>
              </View>)}
            </View>
            <View style={styles.scaleEnds}><AppText variant="bodySmall" tone="secondary">1 · Sakin</AppText><AppText variant="bodySmall" tone="secondary">10 · Çok yakın</AppText></View>
          </AppCard>
          <AppText variant="bodySmall" tone="secondary" style={styles.centerText}>Bu ölçek yalnızca görsel bir rehberdir; bir seviye seçmen gerekmiyor.</AppText>
          <View style={styles.actions}>
            <AppButton testID="bloom.masturbation.active.pause" label="Duraklama başlat" disabled={locked} onPress={actions.startPause} />
            <AppButton testID="bloom.masturbation.active.end" label="Pratiği bitir" variant="secondary" disabled={locked} onPress={actions.end} />
          </View>
        </View>
        : view.kind === "awaitingFeedback" ? <ContinueSessionCard feature={feature} />
        : view.kind === "completed" ? <CompletedSessionCard feature={feature} />
        : <UnavailableSessionCard kind={view.kind} />}
    </SessionPage>
  );
}

export function MasturbationSessionFeedbackScreen() {
  const feature = useMasturbationSessionFeature("feedback");
  const { view, locked, actions } = feature;
  return (
    <SessionPage feature={feature} title="Oturum değerlendirmesi" testID="bloom.masturbation.feedback">
      {view.kind === "awaitingFeedback" ? <FeedbackForm key={view.session.id} durationSeconds={view.session.durationSeconds} locked={locked} onSubmit={actions.completeFeedback} />
        : view.kind === "active" ? <ContinueSessionCard feature={feature} />
        : view.kind === "completed" ? <CompletedSessionCard feature={feature} />
        : <UnavailableSessionCard kind={view.kind} />}
    </SessionPage>
  );
}

function SessionPage({ feature, title, testID, children }: PropsWithChildren<{ feature: SessionFeature; title: string; testID: string }>) {
  return <AppScreen scroll includeBottomNavClearance={false}>
    <View testID={testID} style={styles.page}>
      <View style={styles.header}>
        <View style={styles.headerText}><AppText variant="overline" tone="accent">MASTURBATION TRACKING</AppText><AppText variant="heading2" accessibilityRole="header">{title}</AppText></View>
        <AppButton testID="bloom.masturbation.close" label="Kapat" variant="ghost" style={styles.closeButton} disabled={feature.busy} onPress={feature.actions.close} />
      </View>
      {feature.busy || feature.message !== null || feature.canRetry ? <AppCard style={styles.cardStack}>
        {feature.busy ? <AppText accessibilityLiveRegion="polite" variant="bodySmall">Bu cihaza kaydediliyor…</AppText> : null}
        {feature.message !== null ? <AppText testID="bloom.masturbation.message" accessibilityLiveRegion="polite" accessibilityRole="alert" variant="bodySmall" tone="danger">{feature.message}</AppText> : null}
        {feature.canRetry ? <AppButton testID="bloom.masturbation.retry" label="Kaydetmeyi tekrar dene" variant="secondary" disabled={feature.busy} loading={feature.busy} onPress={feature.actions.retry} /> : null}
      </AppCard> : null}
      {children}
    </View>
  </AppScreen>;
}

function IntroCard({ title, detail }: { title: string; detail: string }) {
  return <AppCard style={styles.introCard}><View style={styles.introDot} /><View style={styles.flexOne}><AppText variant="title">{title}</AppText><AppText variant="bodySmall" tone="secondary">{detail}</AppText></View></AppCard>;
}

function ContinueSessionCard({ feature }: { feature: SessionFeature }) {
  const { view } = feature;
  if (view.kind !== "active" && view.kind !== "awaitingFeedback") return null;
  const awaitingFeedback = view.kind === "awaitingFeedback";
  return <AppCard variant="hero" style={styles.cardStack}>
    <AppText variant="overline" tone="accent">{awaitingFeedback ? "DEĞERLENDİRME BEKLİYOR" : "DEVAM EDEN OTURUM"}</AppText>
    <AppText variant="heading1">{awaitingFeedback ? "Pratiğin tamamlandı" : view.paused ? "Duraklaman sürüyor" : "Pratiğin sürüyor"}</AppText>
    <AppText tone="secondary">{awaitingFeedback ? "Kaydı tamamlamak için üç kısa soruyu yanıtla." : "Hazır olduğunda mevcut oturumuna devam edebilirsin."}</AppText>
    {awaitingFeedback ? <AppText variant="bodySmall" tone="secondary">Toplam süre: {formatMasturbationElapsedSeconds(view.session.durationSeconds)}</AppText> : null}
    <AppButton testID="bloom.masturbation.continue" label={awaitingFeedback ? "Sorulara devam et" : "Oturuma devam et"} disabled={feature.locked || !feature.canContinue} onPress={feature.actions.continueSession} />
  </AppCard>;
}

function CompletedSessionCard({ feature }: { feature: SessionFeature }) {
  const { view } = feature;
  if (view.kind !== "completed") return null;
  const session = view.session;
  const endingLabel = endingReasons.find((item) => item.value === session.endingReason)?.label ?? "Diğer";
  return <View style={styles.stack}>
    <View style={styles.summaryHeading}>
      <View style={styles.successMark}><AppText variant="heading1">✓</AppText></View>
      <AppText variant="display" accessibilityRole="header">{feature.isDurablyCompleted ? "Oturum kaydedildi" : "Kaydetme onayı bekleniyor"}</AppText>
      <AppText tone="secondary" style={styles.centerText}>{feature.isDurablyCompleted ? "Pratiğine ait kaydı aşağıda görebilirsin." : "Yanıtların oturumda duruyor. Cihaza kaydedilmesi henüz doğrulanmadı."}</AppText>
    </View>
    <AppCard style={styles.cardStack}>
      <AppText variant="title">Oturum özeti</AppText>
      <SummaryRow label="Ereksiyon" value={`${session.erectionQuality} / 10`} />
      <SummaryRow label="Açık içerik" value={session.usedExplicitContent ? "Evet" : "Hayır"} />
      <SummaryRow label="Bitiş" value={endingLabel} />
      <View style={styles.divider} />
      <SummaryRow label="Toplam süre" value={formatMasturbationElapsedSeconds(session.durationSeconds)} />
    </AppCard>
    {session.pauses.length > 0 ? <AppCard style={styles.cardStack}>
      <AppText variant="title">Duraklamalar</AppText>
      {session.pauses.map((pause, index) => <SummaryRow key={`${pause.startedAt}-${index}`} label={`${index + 1}. Duraklama`} value={formatMasturbationElapsedSeconds(pause.durationSeconds)} />)}
    </AppCard> : null}
    <AppButton label={feature.isDurablyCompleted ? "Tamam" : "Kapat"} disabled={feature.busy} onPress={feature.actions.close} />
  </View>;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.summaryRow}><AppText tone="secondary" style={styles.flexOne}>{label}</AppText><AppText variant="label" style={styles.summaryValue}>{value}</AppText></View>;
}

function UnavailableSessionCard({ kind }: { kind: "missing" | "invalid" | "mismatch" }) {
  return <AppCard variant="hero" style={styles.cardStack} testID="bloom.masturbation.unavailable">
    <AppText variant="heading1">Oturum bulunamadı</AppText>
    <AppText tone="secondary">{kind === "missing" ? "Bu bağlantıda tamamlanmamış bir oturum yok. Ekranı kapatabilirsin." : "Bu bağlantı kullanılabilir bir oturumla eşleşmiyor. Ekranı kapatıp güncel oturum bağlantısını kullan."}</AppText>
  </AppCard>;
}

function FeedbackForm({ durationSeconds, locked, onSubmit }: {
  durationSeconds: number;
  locked: boolean;
  onSubmit: (feedback: MasturbationSessionFeedback) => void;
}) {
  const [step, setStep] = useState<FeedbackStep>(1);
  const [erectionQuality, setErectionQuality] = useState<ErectionQuality | null>(null);
  const [usedExplicitContent, setUsedExplicitContent] = useState<boolean | null>(null);
  const [endingReason, setEndingReason] = useState<MasturbationEndingReason | null>(null);
  const submit = () => {
    if (locked || erectionQuality === null || usedExplicitContent === null || endingReason === null) return;
    onSubmit({ erectionQuality, usedExplicitContent, endingReason });
  };

  return <View style={styles.stack}>
    <View style={styles.progressHeader}>
      <AppText variant="overline" tone="accent">SORU {step} / 3</AppText>
      <AppText variant="bodySmall" tone="secondary">Tamamlanan oturum · {formatMasturbationElapsedSeconds(durationSeconds)}</AppText>
      <View style={styles.progressTrack} accessibilityLabel={`Soru ${step} / 3`}>
        {[1, 2, 3].map((value) => <View key={value} style={[styles.progressSegment, value <= step ? styles.progressSegmentActive : undefined]} />)}
      </View>
    </View>
    {step === 1 ? <View style={styles.stack}>
      <View style={styles.questionHeading}>
        <AppText variant="heading1" accessibilityRole="header">Ereksiyon kalitesi nasıldı?</AppText>
        <AppText tone="secondary">Oturum sırasındaki genel izlenimin.</AppText>
      </View>
      <View style={styles.ratingGrid} accessibilityRole="radiogroup" accessibilityLabel="Ereksiyon kalitesi">
        {erectionQualities.map((value) => <Pressable
          key={value}
          testID={`bloom.masturbation.feedback.erection.${value}`}
          accessibilityRole="radio"
          accessibilityLabel={`Ereksiyon kalitesi ${value} / 10`}
          accessibilityState={{ checked: erectionQuality === value, disabled: locked }}
          disabled={locked}
          onPress={() => setErectionQuality(value)}
          style={[styles.ratingChoice, erectionQuality === value ? styles.ratingChoiceSelected : undefined]}
        ><AppText variant="label" tone={erectionQuality === value ? "onPrimary" : "primary"}>{value}</AppText></Pressable>)}
      </View>
      <View style={styles.scaleEnds}><AppText variant="bodySmall" tone="secondary">1 · Zayıf</AppText><AppText variant="bodySmall" tone="secondary">10 · Tam</AppText></View>
      <AppCard style={styles.cardStack}>
        <AppText variant="title" tone="accent">Bu bir test değil</AppText>
        <AppText variant="bodySmall" tone="secondary">Bir skor elde etmeye çalışma. Yalnızca kendi deneyimini kaydet.</AppText>
      </AppCard>
      <AppButton label="Devam et" disabled={locked || erectionQuality === null} onPress={() => setStep(2)} />
    </View> : step === 2 ? <View style={styles.stack}>
      <View style={styles.questionHeading}>
        <AppText variant="heading1" accessibilityRole="header">Açık içerik kullandın mı?</AppText>
        <AppText tone="secondary">Kasıtlı kullanımını düşün. Kazara gördüğün içerikler buna dahil değil.</AppText>
      </View>
      <View style={styles.choiceRow} accessibilityRole="radiogroup" accessibilityLabel="Kasıtlı açık içerik kullanımı">
        {[false, true].map((value) => <Pressable
          key={String(value)}
          testID={`bloom.masturbation.feedback.content.${value ? "yes" : "no"}`}
          accessibilityRole="radio"
          accessibilityLabel={value ? "Evet" : "Hayır"}
          accessibilityState={{ checked: usedExplicitContent === value, disabled: locked }}
          disabled={locked}
          onPress={() => setUsedExplicitContent(value)}
          style={[styles.contentChoice, usedExplicitContent === value ? styles.optionSelected : undefined]}
        ><AppText variant="title" tone={usedExplicitContent === value ? "accent" : "primary"}>{value ? "Evet" : "Hayır"}</AppText></Pressable>)}
      </View>
      <AppCard style={styles.cardStack}>
        <AppText variant="title" tone="accent">Content-Free hakkında</AppText>
        <AppText variant="bodySmall" tone="secondary">Kasıtlı açık içerik kullanımı, etkin bir Content-Free sayacını etkileyebilir. Kaydın tamamlandığında bu bilgi otomatik olarak değerlendirilir.</AppText>
      </AppCard>
      <AppButton label="Devam et" disabled={locked || usedExplicitContent === null} onPress={() => setStep(3)} />
      <AppButton label="Önceki soru" variant="ghost" disabled={locked} onPress={() => setStep(1)} />
    </View> : <View style={styles.stack}>
      <View style={styles.questionHeading}>
        <AppText variant="heading1" accessibilityRole="header">Oturum nasıl bitti?</AppText>
        <AppText tone="secondary">Deneyimine en yakın seçeneği işaretle.</AppText>
      </View>
      <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel="Oturumun bitiş nedeni">
        {endingReasons.map(({ value, label }) => <Pressable
          key={value}
          testID={`bloom.masturbation.feedback.ending.${value}`}
          accessibilityRole="radio"
          accessibilityLabel={label}
          accessibilityState={{ checked: endingReason === value, disabled: locked }}
          disabled={locked}
          onPress={() => setEndingReason(value)}
          style={[styles.endingChoice, endingReason === value ? styles.optionSelected : undefined]}
        ><View style={[styles.radioMark, endingReason === value ? styles.radioMarkSelected : undefined]} /><AppText variant="label" tone={endingReason === value ? "accent" : "primary"}>{label}</AppText></Pressable>)}
      </View>
      <AppButton testID="bloom.masturbation.feedback.submit" label="Kaydet" disabled={locked || erectionQuality === null || usedExplicitContent === null || endingReason === null} onPress={submit} />
      <AppButton label="Önceki soru" variant="ghost" disabled={locked} onPress={() => setStep(2)} />
    </View>}
  </View>;
}

function getStartBlockMessage(reason: MasturbationTrackingStartBlockReason | undefined): string {
  switch (reason) {
    case "trackingDisabled": return "Takip kapalı. Şu anda yeni bir oturum başlatılamıyor.";
    case "activeSession": return "Yeni bir oturum başlatmadan önce mevcut oturumuna devam et.";
    case "awaitingFeedback": return "Yeni bir oturum başlatmadan önce mevcut oturumun sorularını tamamla.";
    case "resetRestriction": return "Reset dönemin sürüyor. Bu dönemde yeni bir oturum başlatılamıyor.";
    default: return "Oturum durumu kontrol edilemedi. Ekranı kapatıp tekrar dene.";
  }
}

const styles = StyleSheet.create({
  page: { gap: theme.spacing.xl2, paddingBottom: theme.spacing.xl3 },
  stack: { gap: theme.spacing.lg },
  cardStack: { gap: theme.spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  headerText: { flex: 1, gap: theme.spacing.xs2 },
  closeButton: { width: "auto", paddingHorizontal: theme.spacing.sm },
  intro: { gap: theme.spacing.md },
  introCards: { gap: theme.spacing.sm },
  introCard: { flexDirection: "row", alignItems: "flex-start", gap: theme.spacing.md, minHeight: 72 },
  introDot: { width: 10, height: 10, borderRadius: theme.radius.pill, backgroundColor: theme.colors.accent.primary, marginTop: theme.spacing.xs },
  flexOne: { flex: 1, gap: theme.spacing.xs2 },
  scaleCard: { gap: theme.spacing.xl },
  scaleTrack: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: theme.spacing.xs2, minHeight: 80 },
  scaleCell: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: theme.spacing.xs },
  scaleBar: { alignSelf: "stretch", borderRadius: theme.radius.sm, backgroundColor: theme.colors.bg.surfaceElevated },
  scaleBarPause: { backgroundColor: theme.colors.bg.accentSubtle, borderColor: theme.colors.border.accent, borderWidth: theme.size.stroke.hairline },
  scaleBarMarker: { backgroundColor: theme.colors.accent.primary, borderColor: theme.colors.accent.primary },
  scaleEnds: { flexDirection: "row", justifyContent: "space-between", gap: theme.spacing.sm },
  centerText: { textAlign: "center" },
  actions: { gap: theme.spacing.sm, alignSelf: "stretch" },
  pauseContent: { alignItems: "center", gap: theme.spacing.xl2 },
  breathOuter: { width: theme.size.ring.timer, height: theme.size.ring.timer, borderRadius: theme.radius.pill, backgroundColor: theme.colors.bg.surfaceSunken, borderColor: theme.colors.border.accent, borderWidth: theme.size.stroke.hairline, alignItems: "center", justifyContent: "center" },
  breathMiddle: { width: 176, height: 176, borderRadius: theme.radius.pill, backgroundColor: theme.colors.bg.accentSubtle, alignItems: "center", justifyContent: "center" },
  breathInner: { width: 136, height: 136, borderRadius: theme.radius.pill, backgroundColor: theme.colors.bg.surfaceRaised, alignItems: "center", justifyContent: "center" },
  progressHeader: { gap: theme.spacing.sm },
  progressTrack: { flexDirection: "row", gap: theme.spacing.xs, height: theme.size.progress.height },
  progressSegment: { flex: 1, borderRadius: theme.radius.pill, backgroundColor: theme.colors.bg.surfaceElevated },
  progressSegmentActive: { backgroundColor: theme.colors.accent.primary },
  questionHeading: { gap: theme.spacing.sm },
  ratingGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: theme.spacing.xs },
  ratingChoice: { width: "22%", minWidth: theme.size.touch.min, minHeight: theme.size.touch.min, borderRadius: theme.radius.md, borderColor: theme.colors.border.strong, borderWidth: theme.size.stroke.hairline, backgroundColor: theme.colors.bg.surface, alignItems: "center", justifyContent: "center" },
  ratingChoiceSelected: { backgroundColor: theme.colors.action.primary, borderColor: theme.colors.border.accent },
  choiceRow: { flexDirection: "row", gap: theme.spacing.sm },
  contentChoice: { flex: 1, minHeight: theme.size.control.lg, borderRadius: theme.radius.lg, borderColor: theme.colors.border.strong, borderWidth: theme.size.stroke.hairline, backgroundColor: theme.colors.bg.surface, alignItems: "center", justifyContent: "center" },
  optionSelected: { borderColor: theme.colors.border.accent, borderWidth: 1.5, backgroundColor: theme.colors.bg.accentSubtle },
  options: { gap: theme.spacing.sm },
  endingChoice: { minHeight: theme.size.control.lg, borderRadius: theme.radius.lg, borderColor: theme.colors.border.default, borderWidth: theme.size.stroke.hairline, backgroundColor: theme.colors.bg.surface, flexDirection: "row", alignItems: "center", gap: theme.spacing.md, paddingHorizontal: theme.spacing.md },
  radioMark: { width: theme.size.radio, height: theme.size.radio, borderRadius: theme.radius.pill, borderColor: theme.colors.border.strong, borderWidth: 2 },
  radioMarkSelected: { borderColor: theme.colors.accent.primary, backgroundColor: theme.colors.accent.primary },
  summaryHeading: { alignItems: "center", gap: theme.spacing.md },
  successMark: { width: theme.size.badge.lg, height: theme.size.badge.lg, borderRadius: theme.radius.pill, backgroundColor: theme.colors.bg.successSubtle, borderColor: theme.colors.border.success, borderWidth: theme.size.stroke.hairline, alignItems: "center", justifyContent: "center" },
  summaryRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: theme.spacing.md },
  summaryValue: { flexShrink: 1, textAlign: "right" },
  divider: { height: theme.size.stroke.hairline, backgroundColor: theme.colors.border.default }
});
