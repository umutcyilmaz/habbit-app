import { useRef, useState } from "react";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";

import { useSafeAreaInsets } from "react-native-safe-area-context";
import { HomeIcon } from "../../home/components/HomeIcon";
import { HomeStatusCapsules } from "../../home/components/HomeStatusCapsules";
import { formatHistoryDuration } from "../../home/history/activityHistory";
import { ContentFreeActivity } from "./ContentFreeActivity";

import { AppButton } from "../../../shared/components/v4/AppButton";
import { AppCard } from "../../../shared/components/v4/AppCard";
import { AppScreen } from "../../../shared/components/v4/AppScreen";
import { AppText } from "../../../shared/components/v4/AppText";
import { theme } from "../../../shared/design-system/v4/theme";
import {
  formatContentFreeShortDate,
  formatContentFreeEventTime,
} from "../contentFreeView";
import { useContentFreeFeature } from "../useContentFreeFeature";

type ContentFreeFeature = ReturnType<typeof useContentFreeFeature>;
const daySeconds = 86400;

const saveStateLabels: Record<ContentFreeFeature["saveState"], string> = {
  loading: "Kaydedilmiş veriler yükleniyor…",
  unavailable: "Yerel veriye erişilemiyor",
  saving: "Bu cihaza kaydediliyor…",
  saved: "Bu cihaza kaydedildi",
  unconfirmed: "Kaydetme henüz doğrulanmadı",
};

export function ContentFreeScreen() {
  const feature = useContentFreeFeature();
  const { view, locked, actions } = feature;
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  const large = fontScale > 1.5;
  const { progress } = view;
  const creditedSeconds = progress?.status === "active"
    ? feature.streaks.find(entry => entry.endReason === "active" && entry.startedAt === view.currentStreakStartedAt)?.resetSeconds ?? 0
    : 0;

  return (
    <View testID="bloom.content-free.safe-area" style={[styles.root, { paddingTop: insets.top }]}><AppScreen key={fontScale} scroll includeBottomNavClearance={false} style={styles.viewport} contentContainerStyle={styles.content}>
      <View testID="bloom.content-free" style={styles.page}>
        <View style={styles.header}>
          <Pressable testID="bloom.content-free.close" accessibilityRole="button" accessibilityLabel="Kapat, ana sayfaya dön" accessibilityState={{ disabled: feature.navigationBlocked }} disabled={feature.navigationBlocked} onPress={actions.close} style={({ pressed }) => [styles.closeCircle, pressed && styles.closePressed]}>
            <HomeIcon name="back" size={24} />
          </Pressable>
          <AppText style={styles.navigationTitle} accessibilityRole="header" accessibilityLabel="İçeriksiz sayaç">Sayaç</AppText>
          <View style={styles.headerBalance} />
        </View>

        <SaveStatus feature={feature} />

        {progress === null ? (
          <AppCard variant="hero" style={styles.cardStack}>
            <AppText variant="heading1">
              {feature.saveState === "loading"
                ? "Content-Free yükleniyor"
                : "Content-Free kullanılamıyor"}
            </AppText>
            <AppText tone="secondary">
              {feature.saveState === "loading"
                ? "Kaydedilmiş verilerin açılıyor."
                : "İlerleme şu anda kontrol edilemiyor. Ekranı kapatıp tekrar dene."}
            </AppText>
          </AppCard>
        ) : feature.continuationOffer != null ? (
          <AppCard variant="hero" testID="bloom.content-free.reset-continuation" style={styles.cardStack}>
            <AppText variant="heading1">Reset ile kazandığın süreyi koru</AppText>
            <AppText tone="secondary">{feature.continuationOffer.completedDays} tamamlanmış gününü Content-Free ile devam ettirebilirsin.</AppText>
            <AppButton testID="bloom.content-free.continuation.open" label="Devam etme seçimini aç" disabled={locked} onPress={actions.openContinuation} />
          </AppCard>
        ) : progress.status === "inactive" ? (
          <View style={styles.stack}>
            <View style={styles.intro}>
              <AppText
                testID="bloom.content-free.status"
                variant="overline"
                tone={view.hasPriorActivation ? "warning" : "accent"}
              >
                {view.hasPriorActivation ? "DURDURULDU" : "HENÜZ BAŞLAMADI"}
              </AppText>
              <View style={[styles.dayHero, large && styles.largeHero]}>
                <AppText testID="bloom.content-free.last-streak" style={[styles.dayNumber, styles.mutedNumber, large && styles.largeNumber]}>{feature.streaks[0] ? Math.floor(feature.streaks[0].seconds / 86400) : "—"}</AppText>
                <AppText style={[styles.dayNumber, styles.mutedNumber, large && styles.largeNumber]}>gün</AppText>
              </View>
              <AppText variant="bodyLarge" tone="secondary">{view.hasPriorActivation ? "Son serin sona erdi. İstersen yeniden başla." : "Kendi ritminde başla."}</AppText>
              <AppText variant="bodySmall" tone="secondary">Sayaç, etkinleştirdiğin anda bilinçli açık içerik kullanımı olmadan geçen zamanı izler.</AppText>
            </View>
            <AppCard variant="hero" style={styles.cardStack}>
              <AppText variant="title">Sana ait bir sayaç</AppText>
              <AppText tone="secondary">
                Mastürbasyon takibinden bağımsızdır. Mastürbasyon tek başına
                seriyi sıfırlamaz; bilinçli açık içerik kullanımı sıfırlar.
              </AppText>
              {view.hasPriorActivation ? (
                <AppText variant="bodySmall" tone="secondary">
                  Geçmişin ve en uzun serin korunur.
                </AppText>
              ) : null}
            </AppCard>
            {feature.streaks[0] ? <View style={styles.stoppedHero}><AppText style={styles.timeChip}>{formatHistoryDuration(feature.streaks[0].seconds)} · Durduruldu</AppText></View> : null}
            <BestStreak seconds={progress.effectiveBestStreakSeconds} />
            <AppButton
              testID="bloom.content-free.activate"
              label={
                view.hasPriorActivation
                  ? "Sayacı yeniden başlat"
                  : "Sayacı başlat"
              }
              disabled={locked}
              onPress={actions.activate}
            />
          </View>
        ) : (
          <View style={styles.stack}>
            <View style={styles.hero}>
              <AppText testID="bloom.content-free.status" variant="overline" tone="accent">{progress.currentCompletedDays === 0 && view.currentActivationHasEffectiveViolation ? "YENİ SERİ" : "AKTİF SERİ"}</AppText>
              <AppText style={styles.centerText} tone="secondary">İçeriksiz geçen süre</AppText>
              <View style={[styles.dayHero, large && styles.largeHero]}>
                <AppText testID="bloom.content-free.current-streak" style={[styles.dayNumber, large && styles.largeNumber]}>{progress.currentCompletedDays}</AppText>
                <AppText style={[styles.dayNumber, large && styles.largeNumber]}>gün</AppText>
              </View>
              <View style={styles.timeChip}><AppText testID="bloom.content-free.elapsed" style={styles.timeText}>{Math.floor(progress.currentStreakSeconds % 86400 / 3600)} sa {Math.floor(progress.currentStreakSeconds % 3600 / 60)} dk {progress.currentStreakSeconds % 60} sn</AppText></View>
              <HomeStatusCapsules values={[
                { icon: "flag", label: "En uzun seri", value: `${Math.floor(progress.effectiveBestStreakSeconds / 86400)} gün`, id: "bloom.content-free.best-streak" },
                { icon: "calendar", label: "Başlangıç", value: view.currentStreakStartedAt ? formatContentFreeShortDate(view.currentStreakStartedAt) : "—" },
              ]} />
              {creditedSeconds > 0 ? <AppText testID="bloom.content-free.reset-credit" variant="bodySmall" tone="accent" style={styles.centerText}>{formatHistoryDuration(creditedSeconds)} kazanılmış Reset süresi dahil.</AppText> : null}
              <AppText variant="bodySmall" tone="secondary" style={styles.centerText}>Mastürbasyon tek başına seriyi sıfırlamaz. Yalnızca bilinçli açık içerik kullanımı sıfırlar.</AppText>
            </View>
            <AppButton
              testID="bloom.content-free.panic"
              label="Şu an zorlanıyorum"
              variant="primary"
              style={({ pressed }) => [styles.pillButton, { backgroundColor: pressed ? "#c63140" : "#ed3d4a" }]}
              disabled={locked}
              onPress={actions.openPanic}
            />
            <ManualViolationAction
              key={`manual-${view.activationId}`}
              locked={locked}
              onRecord={actions.recordManualViolation}
            />


          </View>
        )}

        {progress !== null ? <>
          <ContentFreeActivity weeks={feature.activity} week={feature.week} streaks={feature.streaks} timeZone={feature.timeZone} />
          <ViolationHistory feature={feature} />
          {progress.status === "active" ? <DeactivateAction key={`deactivate-${view.activationId}`} locked={locked} onDeactivate={actions.deactivate} /> : null}
        </> : null}
      </View>
    </AppScreen></View>
  );
}

function SaveStatus({ feature }: { feature: ContentFreeFeature }) {
  const needsAttention =
    feature.saveState !== "saved" ||
    feature.message !== null ||
    feature.canRetry;
  return (
    <View style={needsAttention ? styles.statusPanel : styles.statusLine}>
      <AppText
        testID="bloom.content-free.save-state"
        accessibilityLiveRegion="polite"
        variant="bodySmall"
        style={styles.saveLabel}
        tone={
          feature.saveState === "unconfirmed" ||
          feature.saveState === "unavailable"
            ? "warning"
            : "secondary"
        }
      >
        {saveStateLabels[feature.saveState]}
      </AppText>
      {feature.message !== null ? (
        <AppText
          testID="bloom.content-free.message"
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          variant="bodySmall"
          tone="danger"
        >
          {feature.message}
        </AppText>
      ) : null}
      {feature.recoveryGuidance !== null ? <AppText testID="bloom.persistence.recovery-guidance" accessibilityLiveRegion="polite" variant="bodySmall" tone="warning">
        {feature.recoveryGuidance}
      </AppText> : null}
      {feature.canConfirmCurrentSave ? <AppButton testID="bloom.persistence.confirm-current" label="Güncel durumu kaydet" variant="secondary" onPress={feature.actions.confirmCurrentSave} /> : null}
      {feature.canRetry ? (
        <AppButton
          testID="bloom.content-free.retry"
          label="Kaydetmeyi tekrar dene"
          variant="secondary"
          disabled={feature.busy}
          loading={feature.busy}
          onPress={feature.actions.retry}
        />
      ) : null}
    </View>
  );
}

function BestStreak({
  seconds,
  compact = false,
}: {
  seconds: number;
  compact?: boolean;
}) {
  const days = Math.floor(seconds / daySeconds);
  return (
    <AppCard style={compact ? styles.statCard : styles.cardStack}>
      <AppText variant="bodySmall" tone="secondary">
        En uzun seri
      </AppText>
      <AppText
        testID="bloom.content-free.best-streak"
        variant={compact ? "title" : "heading1"}
      >
        {days} gün
      </AppText>
    </AppCard>
  );
}

function ManualViolationAction({
  locked,
  onRecord,
}: {
  locked: boolean;
  onRecord: () => void;
}) {
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

  return confirming ? (
    <AppCard style={styles.cardStack}>
      <AppText variant="heading1">Sayacı sıfırlamak istiyor musun?</AppText>
      <AppText tone="secondary">Yalnızca bilinçli olarak açık içerik kullandıysan bunu kaydet. Kazara gördüğün içerikler sayılmaz.</AppText>
      <AppText variant="bodySmall" tone="secondary">Mevcut seri sona erer. En uzun seri ve geçmiş korunur.</AppText>
      <AppButton testID="bloom.content-free.record.confirm" label="Evet, bilinçli kullandım" variant="destructive" disabled={locked} onPress={recordConfirmed} />
      <AppButton testID="bloom.content-free.record.cancel" label="Vazgeç" variant="ghost" disabled={locked} onPress={cancelConfirmation} />
    </AppCard>
  ) : <AppButton testID="bloom.content-free.record" label="Seriyi sıfırla" variant="ghost" disabled={locked} onPress={openConfirmation} />;

}

function DeactivateAction({
  locked,
  onDeactivate,
}: {
  locked: boolean;
  onDeactivate: () => void;
}) {
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
      <AppText tone="secondary">
        Mevcut seri burada sona erer. Geçmişin ve en uzun serin korunur.
      </AppText>
      <AppButton
        testID="bloom.content-free.deactivate.confirm"
        label="Sayacı durdur"
        variant="destructive"
        disabled={locked}
        onPress={confirm}
      />
      <AppButton
        testID="bloom.content-free.deactivate.cancel"
        label="Vazgeç"
        variant="ghost"
        disabled={locked}
        onPress={cancel}
      />
    </AppCard>
  ) : (
    <AppButton
      testID="bloom.content-free.deactivate"
      label="Sayacı durdur"
      variant="ghost"
      disabled={locked}
      onPress={open}
    />
  );
}

function ViolationHistory({ feature }: { feature: ContentFreeFeature }) {
  const { view, locked, actions } = feature;
  const [expanded, setExpanded] = useState(false);
  const undoCandidate = view.history.find(
    (violation) => violation.id === view.manualUndoCandidateId,
  );
  return (
    <View style={styles.stack}>
      {!expanded && undoCandidate !== undefined ? (
        <AppCard style={styles.cardStack}>
          <AppText variant="title">Son kaydı yanlış mı girdin?</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Güvenli geri alma yalnızca son manuel kayıt için kullanılabilir.
          </AppText>
          <AppButton
            testID={`bloom.content-free.undo.${undoCandidate.id}`}
            label="Yanlış kaydettim · Geri al"
            variant="secondary"
            disabled={locked}
            onPress={() => actions.undoManualViolation(undoCandidate.id)}
          />
        </AppCard>
      ) : null}
      <AppButton
        testID="bloom.content-free.history.toggle"
        label={expanded ? "Kullanım kayıtlarını gizle" : "Kullanım kayıtlarını gör"}
        variant="ghost"
        onPress={() => setExpanded(!expanded)}
      />
      {expanded ? (
        <View style={styles.historyList}>
          <AppText variant="heading2" accessibilityRole="header">
            Geçmiş
          </AppText>
          {view.history.length === 0 ? (
            <AppText variant="bodySmall" tone="secondary">
              Henüz bilinçli kullanım kaydı yok.
            </AppText>
          ) : (
            view.history.map((violation) => (
              <AppCard
                key={violation.id}
                testID={`bloom.content-free.history.${violation.id}`}
                style={styles.cardStack}
              >
                <AppText variant="title">
                  Bilinçli açık içerik kullanımı
                </AppText>
                <AppText variant="bodySmall" tone="secondary">
                  {violation.source.kind === "masturbationSession"
                    ? "Oturum geri bildiriminden"
                    : "Manuel kayıt"}
                  {feature.durableViolations.some(saved => saved.id === violation.id && saved.status === violation.status)
                    ? violation.status === "undone" ? " · Geri alındı" : " · Kaydedildi"
                    : " · Kaydetme onayı bekleniyor"}
                </AppText>
                <AppText variant="bodySmall" tone="secondary">
                  Olay: {formatContentFreeEventTime(violation.occurredAt)}
                </AppText>
                <AppText variant="caption" tone="secondary">
                  Kayıt: {formatContentFreeEventTime(violation.recordedAt)}
                </AppText>
                {violation.status === "undone" ? (
                  <AppText variant="caption" tone="secondary">
                    Geri alma: {formatContentFreeEventTime(violation.undoneAt)}
                  </AppText>
                ) : null}
                {view.manualUndoCandidateId === violation.id ? (
                  <AppButton
                    testID={`bloom.content-free.undo.${violation.id}`}
                    label="Yanlış kaydettim · Geri al"
                    variant="secondary"
                    disabled={locked}
                    onPress={() => actions.undoManualViolation(violation.id)}
                  />
                ) : null}
              </AppCard>
            ))
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  closeCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#1a1a1c", alignItems: "center", justifyContent: "center" }, closePressed: { backgroundColor: "#303036" }, navigationTitle: { flex: 1, fontSize: 18, lineHeight: 26, fontFamily: "Inter_600SemiBold", textAlign: "center" }, headerBalance: { width: 44 }, saveLabel: { fontSize: 12, lineHeight: 18, textAlign: "center" },
  root: { flex: 1, backgroundColor: "#010208" }, viewport: { backgroundColor: "#000", paddingTop: 0, overflow: "hidden" }, content: { paddingHorizontal: 16, paddingTop: 12 },
  pillButton: { borderRadius: 28 }, timeChip: { backgroundColor: "rgba(170,179,255,.08)", borderColor: "rgba(170,179,255,.25)", borderWidth: 1, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 10, maxWidth: "100%" }, timeText: { fontFamily: "Inter_600SemiBold", fontSize: 17, lineHeight: 24, fontVariant: ["tabular-nums"], textAlign: "center" },
  mutedNumber: { color: "#9999a6" },
  largeHero: { flexDirection: "column", alignItems: "center" }, largeNumber: { fontSize: 48, lineHeight: 64 }, stoppedHero: { alignItems: "center", gap: 14, paddingVertical: 12 }, stoppedNumber: { fontSize: 32, lineHeight: 44, fontFamily: "Inter_600SemiBold", color: "#9999a6", textAlign: "center" },
  page: { gap: 14, paddingBottom: theme.spacing.xl3 },
  stack: { gap: theme.spacing.lg },
  cardStack: { gap: 14, backgroundColor: "#141415", borderColor: "rgba(255,255,255,.07)", borderRadius: 30, padding: 20 },
  header: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
  intro: { gap: theme.spacing.md },
  statusLine: { alignItems: "center" },
  statusPanel: {
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.bg.surface,
  },
  hero: { alignItems: "center", gap: 14, paddingTop: 20, paddingBottom: 24 },
  dayHero: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: theme.spacing.xs,
  },
  dayNumber: {
    fontFamily: "Inter_700Bold",
    fontSize: 76,
    lineHeight: 92,
    color: theme.colors.text.primary,
    fontVariant: ["tabular-nums"],
  },
  centerText: { textAlign: "center" },
  statCard: { flex: 1, minWidth: 0, width: "auto", gap: theme.spacing.sm },
  historyList: { gap: theme.spacing.sm },
});
