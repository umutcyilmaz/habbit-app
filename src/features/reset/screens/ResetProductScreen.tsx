import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { ResetViolation } from "../../../domain/models/ResetJourney";
import { AppButton } from "../../../shared/components/v4/AppButton";
import { AppCard } from "../../../shared/components/v4/AppCard";
import { AppScreen } from "../../../shared/components/v4/AppScreen";
import { AppText } from "../../../shared/components/v4/AppText";
import { theme } from "../../../shared/design-system/v4/theme";
import type { ResetBaselineAnswers } from "../resetController";
import { formatResetEventTime } from "../resetView";
import { useResetFeature } from "../useResetFeature";

type ResetFeature = ReturnType<typeof useResetFeature>;
type ResetMode = Parameters<typeof useResetFeature>[0];
type ActiveResetView = Extract<ResetFeature["view"], { kind: "active" }>;
type Choice<T extends string> = { value: T; label: string };
type BaselineStep = 1 | 2 | 3 | 4 | 5;

const titles: Record<ResetMode, string> = {
  baseline: "Başlangıç değerlendirmesi",
  progress: "15 günlük Reset",
  completion: "Reset dönemi"
};
const saveStateLabels: Record<ResetFeature["saveState"], string> = {
  loading: "Kaydedilmiş veriler yükleniyor…",
  unavailable: "Kaydetme durumu kullanılamıyor",
  saving: "Bu cihaza kaydediliyor…",
  saved: "Bu cihaza kaydedildi",
  unconfirmed: "Kaydetme henüz doğrulanmadı"
};
const violationReasons: ReadonlyArray<Choice<ResetViolation["reason"]>> = [
  { value: "masturbation", label: "Mastürbasyon" },
  { value: "intentionalExplicitContent", label: "Açık içerik" },
  { value: "masturbationWithExplicitContent", label: "İkisi de" }
];

export function ResetBaselineScreen() { return <ResetProductScreen mode="baseline" />; }
export function ResetProgressScreen() { return <ResetProductScreen mode="progress" />; }
export function ResetCompletionScreen() { return <ResetProductScreen mode="completion" />; }

function ResetProductScreen({ mode }: { mode: ResetMode }) {
  const feature = useResetFeature(mode);
  return (
    <AppScreen scroll includeBottomNavClearance={false}>
      <View testID={`bloom.reset.${mode}`} style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="overline" tone="accent">15-DAY RESET</AppText>
            <AppText variant="heading2" accessibilityRole="header">{titles[mode]}</AppText>
          </View>
          <AppButton testID="bloom.reset.close" label="Kapat" variant="ghost" style={styles.closeButton} disabled={feature.busy} onPress={feature.actions.close} />
        </View>
        <SaveStatus feature={feature} />
        <ResetContent mode={mode} feature={feature} />
      </View>
    </AppScreen>
  );
}

function ResetContent({ mode, feature }: { mode: ResetMode; feature: ResetFeature }) {
  const { view, locked, actions } = feature;
  // An accepted operation may change the attempt before the old route updates.
  // The exact accepted successor retains retry/continue controls here.
  if (mode === "completion" && view.kind === "completed" && feature.continuationOffer) return (
    <AppCard variant="hero" testID="bloom.reset.content-free-offer" style={styles.cardStack}>
      <AppText variant="heading1">15 günlük Reset'i tamamladın!</AppText>
      <AppText tone="secondary">Bu dönemde açık içerikten uzak kaldığın süreyi Content-Free ile devam ettirebilirsin.</AppText>
      <AppText testID="bloom.reset.content-free.credit" tone="secondary">{feature.continuationOffer.completedDays} tamamlanmış gün</AppText>
      <AppButton testID="bloom.reset.content-free.accept" label={feature.continuationOffer.primaryLabel} disabled={locked} onPress={() => actions.decideContinuation("accepted")} />
      <AppButton testID="bloom.reset.content-free.decline" label="Şimdilik değil" variant="secondary" disabled={locked} onPress={() => actions.decideContinuation("declined")} />
    </AppCard>
  );
  if (mode === "completion" && view.kind === "completed" && feature.recoveryTarget === null) return (
    <AppCard variant="hero" style={styles.cardStack}>
      <AppText variant="heading1">Reset tamamlandı</AppText>
      <AppButton label="Home’a dön" disabled={locked} onPress={actions.close} />
    </AppCard>
  );
  if (feature.recoveryTarget !== null) return <RecoveryCard feature={feature} />;
  if (mode === "baseline" && view.kind === "baseline") {
    return <ResetBaselineForm key={view.reset.id} locked={locked} onSubmit={actions.startFromBaseline} />;
  }
  if (mode === "progress" && view.kind === "active") {
    return (
      <View style={styles.stack}>
        <ProgressSummary view={view} />
        {view.progress.isPeriodComplete ? (
          <AppCard variant="hero" style={styles.cardStack}>
            <AppText variant="heading1">15 gün tamamlandı</AppText>
            <AppText tone="secondary">Reset döneminin sonuna geldin. Tamamlamak için sonucu görüntüle.</AppText>
            <AppButton testID="bloom.reset.continue" label="Sonucu gör" disabled={locked || !feature.canOpenCompletion} onPress={actions.continueToCompletion} />
          </AppCard>
        ) : (
          <>
            <AppButton testID="bloom.reset.panic" label="Panic" disabled={locked} onPress={actions.openPanic} />
            <AppText variant="bodySmall" tone="secondary" style={styles.centerText}>Masturbation Tracking yeni oturumlar için bu Reset boyunca beklemede.</AppText>
            <ManualViolationSection key={`${view.reset.id}:${view.reset.currentAttempt.id}`} locked={locked} onRecord={actions.recordViolation} />
          </>
        )}
        <ResetViolationHistory view={view} locked={locked} onUndo={actions.undoViolation} />
      </View>
    );
  }
  if (mode === "completion" && view.kind === "active") {
    return view.progress.isPeriodComplete ? (
      <View style={styles.stack}>
        <AppCard variant="hero" style={styles.completionHero}>
          <AppText variant="overline" tone="accent">15 DAY</AppText>
          <AppText variant="display" accessibilityRole="header" style={styles.centerText}>Reset tamamlandı</AppText>
          <AppText tone="secondary" style={styles.centerText}>15 günlük dönemini tamamladın. Bu, kendi gözlemlerine alan açan bir pratikti.</AppText>
        </AppCard>
        <AppCard style={styles.cardStack}>
          <AppText variant="title">Dönem özeti</AppText>
          <SummaryRow label="Tamamlanan gün" value={`${view.progress.completedDays} / 15`} />
          <SummaryRow label="En iyi tamamlanan gün" value={`${view.bestCompletedDays} / 15`} />
          <SummaryRow label="Bu denemenin başlangıcı" value={formatResetEventTime(view.reset.currentAttempt.startedAt)} />
          {view.reset.pastAttempts.length > 0 ?
            <SummaryRow label="Önceki yeniden başlayan denemeler" value={String(view.reset.pastAttempts.filter((attempt) => attempt.status === "restarted").length)} /> : null}
        </AppCard>
        <AppButton testID="bloom.reset.complete" label="Reset’i tamamla" disabled={locked} onPress={actions.completeElapsed} />
      </View>
    ) : (
      <View style={styles.stack}>
        <ProgressSummary view={view} />
        <AppCard style={styles.cardStack}>
          <AppText variant="heading2">Dönem sürüyor</AppText>
          <AppText tone="secondary">Tamamlama, 15 günlük dönem dolduğunda kullanılabilir.</AppText>
        </AppCard>
      </View>
    );
  }
  return (
    <AppCard variant="hero" testID="bloom.reset.unavailable" style={styles.cardStack}>
      <AppText variant="heading1">Reset bu bağlantıda kullanılamıyor</AppText>
      <AppText tone="secondary">Bu bağlantı geçerli bir Reset adımıyla eşleşmiyor. Ekranı kapatıp güncel bağlantıyı kullan.</AppText>
    </AppCard>
  );
}

function SaveStatus({ feature }: { feature: ResetFeature }) {
  const needsAttention = feature.saveState !== "saved" || feature.message !== null || feature.canRetry;
  return (
    <View style={needsAttention ? styles.statusPanel : styles.statusLine}>
      <AppText testID="bloom.reset.save-state" accessibilityLiveRegion="polite" variant="bodySmall" tone={feature.saveState === "unconfirmed" || feature.saveState === "unavailable" ? "warning" : "secondary"}>
        {saveStateLabels[feature.saveState]}
      </AppText>
      {feature.message !== null ? (
        <AppText testID="bloom.reset.message" accessibilityLiveRegion="polite" accessibilityRole="alert" variant="bodySmall" tone="danger">{feature.message}</AppText>
      ) : null}
      {feature.canRetry ? (
        <AppButton testID="bloom.reset.retry" label="Kaydetmeyi tekrar dene" variant="secondary" disabled={feature.busy} loading={feature.busy} onPress={feature.actions.retry} />
      ) : null}
    </View>
  );
}

function RecoveryCard({ feature }: { feature: ResetFeature }) {
  const target = feature.recoveryTarget;
  if (target === null) return null;
  return (
    <AppCard variant="hero" testID="bloom.reset.recovery" style={styles.cardStack}>
      <AppText variant="heading1">Sonraki adım</AppText>
      <AppText tone="secondary">{target === "today" ? "Home ekranına dönebilirsin." : "Güncel Reset ilerlemene devam edebilirsin."}</AppText>
      {!feature.canContinue ? <AppText variant="bodySmall" tone="secondary">Devam etme seçeneği kayıt doğrulandığında açılır.</AppText> : null}
      <AppButton testID="bloom.reset.continue" label={target === "today" ? "Home’a dön" : "Devam"} disabled={feature.locked || !feature.canContinue} onPress={feature.actions.continueAfterSave} />
    </AppCard>
  );
}

function ProgressSummary({ view }: { view: ActiveResetView }) {
  const { progress } = view;
  return (
    <AppCard variant="hero" style={styles.progressHero}>
      <AppText variant="overline" tone="accent">15-DAY RESET</AppText>
      <View style={styles.dayHero}>
        <AppText testID="bloom.reset.current-day" style={styles.dayNumber}>{progress.currentDay}</AppText>
        <AppText variant="heading1" tone="secondary">/ 15 gün</AppText>
      </View>
      <AppText tone="secondary" style={styles.centerText}>
        {progress.isPeriodComplete ? "15 gün tamamlandı" :
          view.restriction.isRestrictionActive ? `Reset ${progress.currentDay}. gününde.` : "Reset döneminin davranış kısıtı sona erdi."}
      </AppText>
      <View style={styles.progressSteps} accessible accessibilityLabel={`${progress.completedDays} gün tamamlandı, mevcut gün ${progress.currentDay}, ${progress.remainingDays} gün kaldı`}>
        {Array.from({ length: 15 }, (_, index) => (
          <View key={index} style={[
            styles.progressStep,
            index < progress.completedDays ? styles.stepDone :
              !progress.isPeriodComplete && index === progress.currentDay - 1 ? styles.stepCurrent : undefined
          ]} />
        ))}
      </View>
      <View style={styles.progressFacts}>
        <AppText testID="bloom.reset.completed-days" variant="bodySmall">Tamamlanan: {progress.completedDays} gün</AppText>
        <AppText testID="bloom.reset.remaining" variant="bodySmall" tone="secondary">Kalan: {progress.remainingDays} gün</AppText>
      </View>
      <View style={styles.divider} />
      <View style={styles.progressFacts}>
        <AppText testID="bloom.reset.best-days" variant="bodySmall">En iyi: {view.bestCompletedDays} gün</AppText>
        <AppText testID="bloom.reset.attempt-start" variant="bodySmall" tone="secondary">Başlangıç: {formatResetEventTime(view.reset.currentAttempt.startedAt)}</AppText>
      </View>
    </AppCard>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.summaryRow}><AppText tone="secondary" style={styles.flexOne}>{label}</AppText><AppText variant="label" style={styles.summaryValue}>{value}</AppText></View>;
}

function ResetBaselineForm({ locked, onSubmit }: { locked: boolean; onSubmit: (selfReport: ResetBaselineAnswers) => void }) {
  const [step, setStep] = useState<BaselineStep>(1);
  const [erectionDecline, setErectionDecline] = useState<ResetBaselineAnswers["erectionDecline"] | null>(null);
  const [needsStrongerOrFasterStimulation, setNeedsStrongerOrFasterStimulation] = useState<ResetBaselineAnswers["needsStrongerOrFasterStimulation"] | null>(null);
  const [climaxTakesLonger, setClimaxTakesLonger] = useState<ResetBaselineAnswers["climaxTakesLonger"] | null>(null);
  const [difficultyArousingWithoutExplicitContent, setDifficultyArousingWithoutExplicitContent] = useState<ResetBaselineAnswers["difficultyArousingWithoutExplicitContent"] | null>(null);
  const complete = erectionDecline !== null && needsStrongerOrFasterStimulation !== null &&
    climaxTakesLonger !== null && difficultyArousingWithoutExplicitContent !== null;
  const submit = () => {
    if (locked || !complete || erectionDecline === null || needsStrongerOrFasterStimulation === null ||
      climaxTakesLonger === null || difficultyArousingWithoutExplicitContent === null) return;
    onSubmit({ erectionDecline, needsStrongerOrFasterStimulation, climaxTakesLonger, difficultyArousingWithoutExplicitContent });
  };

  return (
    <View style={styles.stack}>
      {step < 5 ? (
        <View style={styles.progressHeader}>
          <AppText variant="overline" tone="accent">SORU {step} / 4</AppText>
          <View style={styles.questionProgress} accessibilityLabel={`Soru ${step} / 4`}>
            {[1, 2, 3, 4].map((value) => <View key={value} style={[styles.questionSegment, value <= step ? styles.questionSegmentDone : undefined]} />)}
          </View>
        </View>
      ) : null}

      {step === 1 ? (
        <View style={styles.stack}>
          <ResetChoice
            title="Ereksiyonunda bir düşüş fark ediyor musun?"
            testIDPrefix="bloom.reset.baseline.erectionDecline"
            value={erectionDecline}
            onChange={setErectionDecline}
            locked={locked}
            options={[{ value: "clear", label: "Evet, belirgin" }, { value: "mild", label: "Evet, hafif" }, { value: "none", label: "Hayır" }, { value: "notSure", label: "Emin değilim" }]}
          />
          <AppCard style={styles.cardStack}>
            <AppText variant="title" tone="accent">Neden soruyorum</AppText>
            <AppText variant="bodySmall" tone="secondary">Veri bir değişim gösterebilir ama senin kendi deneyimin de önemlidir.</AppText>
          </AppCard>
          <AppButton testID="bloom.reset.baseline.next" label="Devam" disabled={locked || erectionDecline === null} onPress={() => { if (!locked && erectionDecline !== null) setStep(2); }} />
        </View>
      ) : step === 2 ? (
        <View style={styles.stack}>
          <ResetChoice
            title="Aynı seviyede uyarılmak için daha sert ya da daha hızlı yapman gerekiyor mu?"
            testIDPrefix="bloom.reset.baseline.needsStrongerOrFasterStimulation"
            value={needsStrongerOrFasterStimulation}
            onChange={setNeedsStrongerOrFasterStimulation}
            locked={locked}
            options={[{ value: "clearly", label: "Evet, belirgin" }, { value: "somewhat", label: "Biraz" }, { value: "no", label: "Hayır" }]}
          />
          <AppButton testID="bloom.reset.baseline.next" label="Devam" disabled={locked || needsStrongerOrFasterStimulation === null} onPress={() => { if (!locked && needsStrongerOrFasterStimulation !== null) setStep(3); }} />
          <AppButton testID="bloom.reset.baseline.back" label="Önceki soru" variant="ghost" disabled={locked} onPress={() => { if (!locked) setStep(1); }} />
        </View>
      ) : step === 3 ? (
        <View style={styles.stack}>
          <ResetChoice
            title="Boşalmak eskisine göre daha mı uzun sürüyor?"
            testIDPrefix="bloom.reset.baseline.climaxTakesLonger"
            value={climaxTakesLonger}
            onChange={setClimaxTakesLonger}
            locked={locked}
            options={[{ value: "clearly", label: "Evet, belirgin" }, { value: "somewhat", label: "Biraz" }, { value: "no", label: "Hayır" }, { value: "notSure", label: "Emin değilim" }]}
          />
          <AppButton testID="bloom.reset.baseline.next" label="Devam" disabled={locked || climaxTakesLonger === null} onPress={() => { if (!locked && climaxTakesLonger !== null) setStep(4); }} />
          <AppButton testID="bloom.reset.baseline.back" label="Önceki soru" variant="ghost" disabled={locked} onPress={() => { if (!locked) setStep(2); }} />
        </View>
      ) : step === 4 ? (
        <View style={styles.stack}>
          <ResetChoice
            title="İçerik olmadan uyarılmakta zorlanıyor musun?"
            testIDPrefix="bloom.reset.baseline.difficultyArousingWithoutExplicitContent"
            value={difficultyArousingWithoutExplicitContent}
            onChange={setDifficultyArousingWithoutExplicitContent}
            locked={locked}
            options={[{ value: "yes", label: "Evet" }, { value: "sometimes", label: "Bazen" }, { value: "no", label: "Hayır" }, { value: "notTried", label: "Denemedim" }]}
          />
          <AppText variant="bodySmall" tone="secondary">Burada “içerik”, bilerek kullanılan açık cinsel içerik anlamına gelir.</AppText>
          <AppButton testID="bloom.reset.baseline.next" label="Devam" disabled={locked || difficultyArousingWithoutExplicitContent === null} onPress={() => { if (!locked && difficultyArousingWithoutExplicitContent !== null) setStep(5); }} />
          <AppButton testID="bloom.reset.baseline.back" label="Önceki soru" variant="ghost" disabled={locked} onPress={() => { if (!locked) setStep(3); }} />
        </View>
      ) : (
        <View style={styles.stack}>
          <AppCard variant="hero" style={styles.cardStack}>
            <AppText variant="overline" tone="accent">BAŞLAMADAN ÖNCE</AppText>
            <AppText variant="heading1" accessibilityRole="header">Mastürbasyon Değerlendirmesi</AppText>
            <AppText tone="secondary">15 günlük Reset, kendi deneyimini gözlemleyebileceğin isteğe bağlı yapılandırılmış bir dönemdir. Yanıtların bir tanı veya sorun kanıtı değildir.</AppText>
            <AppText variant="bodySmall" tone="secondary">Reset yalnızca “Reset’i başlat” dediğinde başlar.</AppText>
          </AppCard>
          <AppButton testID="bloom.reset.baseline.submit" label="Reset’i başlat" disabled={locked || !complete} onPress={submit} />
          <AppButton testID="bloom.reset.baseline.back" label="Yanıtları gözden geçir" variant="ghost" disabled={locked} onPress={() => { if (!locked) setStep(4); }} />
        </View>
      )}
    </View>
  );
}

function ManualViolationSection({ locked, onRecord }: { locked: boolean; onRecord: (reason: ResetViolation["reason"]) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.manualSection}>
      <AppButton testID="bloom.reset.violation.toggle" label={expanded ? "Manuel kaydı gizle" : "Manuel kayıt"} variant="ghost" onPress={() => setExpanded(!expanded)} />
      {expanded ? <ResetViolationForm locked={locked} onRecord={onRecord} /> : null}
    </View>
  );
}

function ResetViolationForm({ locked, onRecord }: { locked: boolean; onRecord: (reason: ResetViolation["reason"]) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState<ResetViolation["reason"] | null>(null);
  const confirmationOpen = useRef(false);
  const openConfirmation = () => {
    if (locked) return;
    confirmationOpen.current = true;
    setReason(null);
    setConfirming(true);
  };
  const cancelConfirmation = () => {
    if (locked) return;
    confirmationOpen.current = false;
    setConfirming(false);
    setReason(null);
  };
  const confirm = () => {
    if (locked || !confirmationOpen.current || reason === null) return;
    confirmationOpen.current = false;
    setConfirming(false);
    setReason(null);
    onRecord(reason);
  };
  return confirming ? (
    <View style={styles.stack}>
      <ResetChoice title="Ne oldu?" testIDPrefix="bloom.reset.violation.reason" value={reason} onChange={setReason} locked={locked} options={violationReasons} />
      <AppCard style={styles.cardStack}>
        <AppText variant="heading2">Bu denemeyi yeniden başlatmak istiyor musun?</AppText>
        <AppText tone="secondary">Bu Reset denemesi 1. günden yeniden başlar.</AppText>
        <AppText variant="bodySmall" tone="secondary">Olay bilinçli açık içerik kullanımını içeriyorsa, etkin Content-Free serisi mevcut kayıt işlemiyle birlikte güncellenebilir. Kazara görme buna dahil değildir.</AppText>
        <AppButton testID="bloom.reset.violation.confirm" label="Kaydet ve 1. günden başlat" variant="destructive" disabled={locked || reason === null} onPress={confirm} />
        <AppButton testID="bloom.reset.violation.cancel" label="Vazgeç" variant="ghost" disabled={locked} onPress={cancelConfirmation} />
      </AppCard>
    </View>
  ) : (
    <AppButton testID="bloom.reset.violation.open" label="Reset ihlali kaydet" variant="secondary" disabled={locked} onPress={openConfirmation} />
  );
}

function ResetViolationHistory({ view, locked, onUndo }: {
  view: ActiveResetView;
  locked: boolean;
  onUndo: (violationId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const undoCandidate = view.history.find((violation) => violation.id === view.undoCandidateId);
  return (
    <View style={styles.stack}>
      {!expanded && undoCandidate !== undefined ? (
        <AppCard style={styles.cardStack}>
          <AppText variant="title">Son kaydı geri almak mı istiyorsun?</AppText>
          <AppText variant="bodySmall" tone="secondary">Yalnızca geçerli geri alma adayı kullanılabilir.</AppText>
          <AppButton testID={`bloom.reset.undo.${undoCandidate.id}`} label="Son kaydı geri al" variant="secondary" disabled={locked} onPress={() => onUndo(undoCandidate.id)} />
        </AppCard>
      ) : null}
      <AppButton testID="bloom.reset.history.toggle" label={expanded ? "Geçmişi gizle" : "Geçmişi gör"} variant="ghost" onPress={() => setExpanded(!expanded)} />
      {expanded ? (
        <View style={styles.historyList}>
          <AppText variant="heading2" accessibilityRole="header">Reset geçmişi</AppText>
          {view.history.length === 0 ? <AppText variant="bodySmall" tone="secondary">Henüz Reset ihlali kaydedilmedi.</AppText>
            : view.history.map((violation) => (
              <AppCard key={violation.id} testID={`bloom.reset.history.${violation.id}`} style={styles.cardStack}>
                <AppText variant="title">{violationReasons.find((option) => option.value === violation.reason)?.label}</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {violation.source.kind === "masturbationSession" ? "Oturumdan" : "Manuel kayıt"}
                  {violation.status === "undone" ? " · Geri alındı" : " · Kaydedildi"}
                </AppText>
                <AppText variant="bodySmall" tone="secondary">Olay: {formatResetEventTime(violation.occurredAt)}</AppText>
                <AppText variant="caption" tone="secondary">Kayıt: {formatResetEventTime(violation.recordedAt)}</AppText>
                {violation.status === "undone" ? <AppText variant="caption" tone="secondary">Geri alma: {formatResetEventTime(violation.undoneAt)}</AppText> : null}
                {view.undoCandidateId === violation.id ? (
                  <AppButton testID={`bloom.reset.undo.${violation.id}`} label="Bu kaydı geri al" variant="secondary" disabled={locked} onPress={() => onUndo(violation.id)} />
                ) : null}
              </AppCard>
            ))}
        </View>
      ) : null}
    </View>
  );
}

function ResetChoice<T extends string>({ title, testIDPrefix, value, onChange, options, locked }: {
  title: string;
  testIDPrefix: string;
  value: T | null;
  onChange: (value: T) => void;
  options: ReadonlyArray<Choice<T>>;
  locked: boolean;
}) {
  return (
    <View style={styles.cardStack}>
      <AppText variant="heading1" accessibilityRole="header">{title}</AppText>
      <View style={styles.choiceList} accessibilityRole="radiogroup" accessibilityLabel={title}>
        {options.map((option) => (
          <AppButton
            key={option.value}
            testID={`${testIDPrefix}.${option.value}`}
            label={option.label}
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ checked: value === option.value }}
            variant={value === option.value ? "primary" : "secondary"}
            disabled={locked}
            onPress={() => { if (!locked) onChange(option.value); }}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: theme.spacing.xl2, paddingBottom: theme.spacing.xl3 },
  stack: { gap: theme.spacing.lg },
  cardStack: { gap: theme.spacing.md },
  header: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  headerText: { flex: 1, gap: theme.spacing.xs2 },
  closeButton: { width: "auto", paddingHorizontal: theme.spacing.sm },
  statusLine: { alignItems: "center" },
  statusPanel: { gap: theme.spacing.sm, padding: theme.spacing.md, borderRadius: theme.radius.lg, backgroundColor: theme.colors.bg.surface },
  centerText: { textAlign: "center" },
  progressHero: { alignItems: "center", gap: theme.spacing.lg },
  dayHero: { flexDirection: "row", alignItems: "baseline", gap: theme.spacing.xs },
  dayNumber: { fontFamily: theme.typography.numericTimer.fontFamily, fontSize: theme.typography.numericTimer.fontSize * 2, lineHeight: theme.typography.numericTimer.lineHeight * 2, color: theme.colors.text.primary, fontVariant: ["tabular-nums"] },
  progressSteps: { width: "100%", flexDirection: "row", gap: theme.spacing.xs2 },
  progressStep: { flex: 1, height: theme.size.progress.height, borderRadius: theme.radius.pill, backgroundColor: theme.colors.bg.surfaceElevated },
  stepDone: { backgroundColor: theme.colors.accent.success },
  stepCurrent: { backgroundColor: theme.colors.accent.primary },
  progressFacts: { width: "100%", flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: theme.spacing.sm },
  divider: { width: "100%", height: theme.size.stroke.hairline, backgroundColor: theme.colors.border.default },
  completionHero: { alignItems: "center", gap: theme.spacing.md },
  summaryRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: theme.spacing.md },
  flexOne: { flex: 1 },
  summaryValue: { flexShrink: 1, textAlign: "right" },
  progressHeader: { gap: theme.spacing.sm },
  questionProgress: { flexDirection: "row", gap: theme.spacing.xs, height: theme.size.progress.height },
  questionSegment: { flex: 1, borderRadius: theme.radius.pill, backgroundColor: theme.colors.bg.surfaceElevated },
  questionSegmentDone: { backgroundColor: theme.colors.accent.primary },
  choiceList: { gap: theme.spacing.sm },
  manualSection: { gap: theme.spacing.sm },
  historyList: { gap: theme.spacing.sm }
});
