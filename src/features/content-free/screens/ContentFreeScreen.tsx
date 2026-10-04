import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppButton } from "../../../shared/components/v4/AppButton";
import { AppCard } from "../../../shared/components/v4/AppCard";
import { AppScreen } from "../../../shared/components/v4/AppScreen";
import { AppText } from "../../../shared/components/v4/AppText";
import { theme } from "../../../shared/design-system/v4/theme";
import { formatContentFreeDate, formatContentFreeEventTime } from "../contentFreeView";
import { useContentFreeFeature } from "../useContentFreeFeature";

type ContentFreeFeature = ReturnType<typeof useContentFreeFeature>;
const daySeconds = 86400;

const saveStateLabels: Record<ContentFreeFeature["saveState"], string> = {
  loading: "Kaydedilmiş veriler yükleniyor…",
  unavailable: "Yerel veriye erişilemiyor",
  saving: "Bu cihaza kaydediliyor…",
  saved: "Bu cihaza kaydedildi",
  unconfirmed: "Kaydetme henüz doğrulanmadı"
};

export function ContentFreeScreen() {
  const feature = useContentFreeFeature();
  const { view, busy, locked, actions } = feature;
  const { progress } = view;

  return (
    <AppScreen scroll includeBottomNavClearance={false}>
      <View testID="bloom.content-free" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <AppText variant="overline" tone="accent">CONTENT-FREE</AppText>
            <AppText variant="heading2" accessibilityRole="header">Porn-free sayacı</AppText>
          </View>
          <AppButton testID="bloom.content-free.close" label="Kapat" variant="ghost" style={styles.closeButton} disabled={busy} onPress={actions.close} />
        </View>

        <SaveStatus feature={feature} />

        {progress === null ? (
          <AppCard variant="hero" style={styles.cardStack}>
            <AppText variant="heading1">{feature.saveState === "loading" ? "Content-Free yükleniyor" : "Content-Free kullanılamıyor"}</AppText>
            <AppText tone="secondary">{feature.saveState === "loading" ? "Kaydedilmiş verilerin açılıyor." : "İlerleme şu anda kontrol edilemiyor. Ekranı kapatıp tekrar dene."}</AppText>
          </AppCard>
        ) : progress.status === "inactive" ? (
          <View style={styles.stack}>
            <View style={styles.intro}>
              <AppText testID="bloom.content-free.status" variant="overline" tone={view.hasPriorActivation ? "warning" : "accent"}>
                {view.hasPriorActivation ? "DURDURULDU" : "HENÜZ BAŞLAMADI"}
              </AppText>
              <AppText variant="display" accessibilityRole="header">{view.hasPriorActivation ? "İstersen yeniden başla." : "Kendi ritminde başla."}</AppText>
              <AppText variant="bodyLarge" tone="secondary">Sayaç, etkinleştirdiğin anda bilinçli açık içerik kullanımı olmadan geçen zamanı izler.</AppText>
            </View>
            <AppCard variant="hero" style={styles.cardStack}>
              <AppText variant="title">Sana ait bir sayaç</AppText>
              <AppText tone="secondary">Mastürbasyon takibinden bağımsızdır. Mastürbasyon tek başına seriyi sıfırlamaz; bilinçli açık içerik kullanımı sıfırlar.</AppText>
              {view.hasPriorActivation ? <AppText variant="bodySmall" tone="secondary">Geçmişin ve en uzun serin korunur.</AppText> : null}
            </AppCard>
            <BestStreak seconds={progress.effectiveBestStreakSeconds} />
            <AppButton testID="bloom.content-free.activate" label={view.hasPriorActivation ? "Sayacı yeniden başlat" : "Sayacı başlat"} disabled={locked} onPress={actions.activate} />
          </View>
        ) : (
          <View style={styles.stack}>
            <AppCard variant="hero" style={styles.hero}>
              <AppText testID="bloom.content-free.status" variant="overline" tone="success">AKTİF SERİ</AppText>
              <View style={styles.dayHero}>
                <AppText testID="bloom.content-free.current-streak" style={styles.dayNumber}>{progress.currentCompletedDays}</AppText>
                <AppText variant="heading1" tone="secondary">gün</AppText>
              </View>
              <AppText variant="bodySmall" tone="secondary" style={styles.centerText}>Bilinçli açık içerik kullanımı olmadan tamamlanan günler</AppText>
              {progress.currentCompletedDays === 0 && view.currentActivationHasEffectiveViolation ?
                <View style={styles.newStreakBadge}><AppText variant="labelSmall" tone="success">Yeni seri başladı</AppText></View> : null}
            </AppCard>
            <View style={styles.statRow}>
              <BestStreak seconds={progress.effectiveBestStreakSeconds} compact />
              {view.currentStreakStartedAt !== null ? (
                <AppCard style={styles.statCard}>
                  <AppText variant="bodySmall" tone="secondary">Başlangıç</AppText>
                  <AppText variant="label">{formatContentFreeDate(view.currentStreakStartedAt)}</AppText>
                </AppCard>
              ) : null}
            </View>
            <AppButton testID="bloom.content-free.panic" label="Panic" disabled={locked} onPress={actions.openPanic} />
            <ManualViolationAction key={view.activationId} locked={locked} onRecord={actions.recordManualViolation} />
            <DeactivateAction key={view.activationId} locked={locked} onDeactivate={actions.deactivate} />
          </View>
        )}

        {progress !== null ? <ViolationHistory feature={feature} /> : null}
      </View>
    </AppScreen>
  );
}

function SaveStatus({ feature }: { feature: ContentFreeFeature }) {
  const needsAttention = feature.saveState !== "saved" || feature.message !== null || feature.canRetry;
  return (
    <View style={needsAttention ? styles.statusPanel : styles.statusLine}>
      <AppText testID="bloom.content-free.save-state" accessibilityLiveRegion="polite" variant="bodySmall" tone={feature.saveState === "unconfirmed" || feature.saveState === "unavailable" ? "warning" : "secondary"}>
        {saveStateLabels[feature.saveState]}
      </AppText>
      {feature.message !== null ? (
        <AppText testID="bloom.content-free.message" accessibilityLiveRegion="polite" accessibilityRole="alert" variant="bodySmall" tone="danger">{feature.message}</AppText>
      ) : null}
      {feature.canRetry ? (
        <AppButton testID="bloom.content-free.retry" label="Kaydetmeyi tekrar dene" variant="secondary" disabled={feature.busy} loading={feature.busy} onPress={feature.actions.retry} />
      ) : null}
    </View>
  );
}

function BestStreak({ seconds, compact = false }: { seconds: number; compact?: boolean }) {
  const days = Math.floor(seconds / daySeconds);
  return (
    <AppCard style={compact ? styles.statCard : styles.cardStack}>
      <AppText variant="bodySmall" tone="secondary">En uzun seri</AppText>
      <AppText testID="bloom.content-free.best-streak" variant={compact ? "title" : "heading1"}>{days} gün</AppText>
    </AppCard>
  );
}

function ManualViolationAction({ locked, onRecord }: { locked: boolean; onRecord: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const confirmationOpen = useRef(false);
  const openConfirmation = () => {
    if (locked) return;
    confirmationOpen.current = true;
    setConfirming(true);
  };
  const cancelConfirmation = () => {
    if (locked) return;
    confirmationOpen.current = false;
    setConfirming(false);
  };
  const recordConfirmed = () => {
    if (locked || !confirmationOpen.current) return;
    // Consume the local confirmation before dispatch so repeated/stale presses
    // cannot issue a second command before React renders its closed state.
    confirmationOpen.current = false;
    setConfirming(false);
    onRecord();
  };

  return (
    <AppCard style={styles.cardStack}>
      {confirming ? (
        <>
          <AppText variant="heading1">Sayacı sıfırlamak istiyor musun?</AppText>
          <AppText tone="secondary">Yalnızca bilinçli olarak açık içerik kullandıysan bunu kaydet. Kazara gördüysen kaydetmene gerek yok.</AppText>
          <AppText variant="bodySmall" tone="secondary">Mevcut seri sona erer. En uzun seri ve geçmiş korunur.</AppText>
          <AppButton testID="bloom.content-free.record.confirm" label="Evet, bilinçli kullandım" variant="destructive" disabled={locked} onPress={recordConfirmed} />
          <AppButton testID="bloom.content-free.record.cancel" label="Vazgeç" variant="ghost" disabled={locked} onPress={cancelConfirmation} />
        </>
      ) : (
        <>
          <AppText variant="title">Bir ihlal mi oldu?</AppText>
          <AppText variant="bodySmall" tone="secondary">Yalnızca bilinçli açık içerik kullanımını kaydet. Kazara gördüğün içerikler sayılmaz.</AppText>
          <AppButton testID="bloom.content-free.record" label="Bir ihlal oldu · sıfırla" variant="destructive" disabled={locked} onPress={openConfirmation} />
        </>
      )}
    </AppCard>
  );
}

function DeactivateAction({ locked, onDeactivate }: { locked: boolean; onDeactivate: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const confirmationOpen = useRef(false);
  const open = () => {
    if (locked) return;
    confirmationOpen.current = true;
    setConfirming(true);
  };
  const cancel = () => {
    if (locked) return;
    confirmationOpen.current = false;
    setConfirming(false);
  };
  const confirm = () => {
    if (locked || !confirmationOpen.current) return;
    confirmationOpen.current = false;
    setConfirming(false);
    onDeactivate();
  };
  return confirming ? (
    <AppCard style={styles.cardStack}>
      <AppText variant="heading1">Sayacı durdurmak istiyor musun?</AppText>
      <AppText tone="secondary">Mevcut seri burada sona erer. Geçmişin ve en uzun serin korunur.</AppText>
      <AppButton testID="bloom.content-free.deactivate.confirm" label="Sayacı durdur" variant="destructive" disabled={locked} onPress={confirm} />
      <AppButton testID="bloom.content-free.deactivate.cancel" label="Vazgeç" variant="ghost" disabled={locked} onPress={cancel} />
    </AppCard>
  ) : (
    <AppButton testID="bloom.content-free.deactivate" label="Sayacı durdur" variant="ghost" disabled={locked} onPress={open} />
  );
}

function ViolationHistory({ feature }: { feature: ContentFreeFeature }) {
  const { view, locked, actions } = feature;
  const [expanded, setExpanded] = useState(false);
  const undoCandidate = view.history.find((violation) => violation.id === view.manualUndoCandidateId);
  return (
    <View style={styles.stack}>
      {!expanded && undoCandidate !== undefined ? (
        <AppCard style={styles.cardStack}>
          <AppText variant="title">Son kaydı yanlış mı girdin?</AppText>
          <AppText variant="bodySmall" tone="secondary">Güvenli geri alma yalnızca son manuel kayıt için kullanılabilir.</AppText>
          <AppButton testID={`bloom.content-free.undo.${undoCandidate.id}`} label="Yanlış kaydettim · Geri al" variant="secondary" disabled={locked} onPress={() => actions.undoManualViolation(undoCandidate.id)} />
        </AppCard>
      ) : null}
      <AppButton testID="bloom.content-free.history.toggle" label={expanded ? "Geçmişi gizle" : "Geçmişi gör"} variant="ghost" onPress={() => setExpanded(!expanded)} />
      {expanded ? (
        <View style={styles.historyList}>
          <AppText variant="heading2" accessibilityRole="header">Geçmiş</AppText>
          {view.history.length === 0 ? <AppText variant="bodySmall" tone="secondary">Henüz bilinçli kullanım kaydı yok.</AppText>
            : view.history.map((violation) => (
              <AppCard key={violation.id} testID={`bloom.content-free.history.${violation.id}`} style={styles.cardStack}>
                <AppText variant="title">Bilinçli açık içerik kullanımı</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {violation.source.kind === "masturbationSession" ? "Oturum geri bildiriminden" : "Manuel kayıt"}
                  {violation.status === "undone" ? " · Geri alındı" : " · Kaydedildi"}
                </AppText>
                <AppText variant="bodySmall" tone="secondary">Olay: {formatContentFreeEventTime(violation.occurredAt)}</AppText>
                <AppText variant="caption" tone="secondary">Kayıt: {formatContentFreeEventTime(violation.recordedAt)}</AppText>
                {violation.status === "undone" ? <AppText variant="caption" tone="secondary">Geri alma: {formatContentFreeEventTime(violation.undoneAt)}</AppText> : null}
                {view.manualUndoCandidateId === violation.id ? (
                  <AppButton testID={`bloom.content-free.undo.${violation.id}`} label="Yanlış kaydettim · Geri al" variant="secondary" disabled={locked} onPress={() => actions.undoManualViolation(violation.id)} />
                ) : null}
              </AppCard>
            ))}
        </View>
      ) : null}
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
  intro: { gap: theme.spacing.md },
  statusLine: { alignItems: "center" },
  statusPanel: { gap: theme.spacing.sm, padding: theme.spacing.md, borderRadius: theme.radius.lg, backgroundColor: theme.colors.bg.surface },
  hero: { alignItems: "center", gap: theme.spacing.md },
  dayHero: { flexDirection: "row", alignItems: "baseline", gap: theme.spacing.xs },
  dayNumber: { fontFamily: theme.typography.numericTimer.fontFamily, fontSize: theme.typography.numericTimer.fontSize * 2, lineHeight: theme.typography.numericTimer.lineHeight * 2, color: theme.colors.text.primary, fontVariant: ["tabular-nums"] },
  centerText: { textAlign: "center" },
  newStreakBadge: { backgroundColor: theme.colors.bg.successSubtle, borderColor: theme.colors.border.success, borderWidth: theme.size.stroke.hairline, borderRadius: theme.radius.pill, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs },
  statRow: { flexDirection: "row", gap: theme.spacing.sm },
  statCard: { flex: 1, width: "auto", gap: theme.spacing.sm },
  historyList: { gap: theme.spacing.sm }
});
