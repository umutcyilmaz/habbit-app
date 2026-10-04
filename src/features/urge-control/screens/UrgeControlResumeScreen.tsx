import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import type { CurrentUrgeControlTrigger, LegacyUrgeControlTrigger, UrgeControlOutcome, UrgeControlTechnique } from "../../../domain/models/UrgeControlEvent";
import { AppButton } from "../../../shared/components/v4/AppButton";
import { AppCard } from "../../../shared/components/v4/AppCard";
import { AppScreen } from "../../../shared/components/v4/AppScreen";
import { AppText } from "../../../shared/components/v4/AppText";
import { theme } from "../../../shared/design-system/v4/theme";
import { useUrgeControlFeature } from "../useUrgeControlFeature";

const outcomes: Array<[UrgeControlOutcome, string]> = [["reduced", "Azaldı"], ["stillStrong", "Hâlâ güçlü"], ["stronger", "Daha güçlü"], ["unchanged", "Değişmedi"]];
const currentTriggers: Array<[CurrentUrgeControlTrigger, string]> = [["boredom", "Can sıkıntısı"], ["stress", "Stres"], ["loneliness", "Yalnızlık"], ["fatigue", "Yorgunluk"], ["explicitContentCue", "İçerik gördüm"], ["habitAutomatic", "Alışkanlık"], ["specificSituation", "Belirli bir durum"], ["other", "Diğer"]];
const techniques: Array<[UrgeControlTechnique, string]> = [["changeEnvironment", "Ortam değiştir"], ["grounding54321", "Duyularına odaklan"], ["cognitiveTask", "Kısa bir zihinsel görev"], ["urgeSurfing", "Dürtüyü gözlemle"], ["personalReminder", "Kişisel hatırlatıcı"]];
const legacyTriggers: Array<[LegacyUrgeControlTrigger, string]> = [["boredom", "Can sıkıntısı"], ["stress", "Stres"], ["loneliness", "Yalnızlık"], ["sleeplessnessNighttime", "Uykusuzluk / gece"], ["sexualDesire", "Cinsel istek"], ["habitAutomatic", "Alışkanlık"], ["notSure", "Emin değilim"]];
const saveLabels = { loading: "Kayıt yükleniyor…", unavailable: "Yerel veriler kullanılamıyor", saving: "Kaydediliyor…", saved: "Bu cihaza kaydedildi", unconfirmed: "Kaydetme henüz doğrulanmadı" };
const stageLabels = { interrupt: "Kısa bir ara", outcome: "Durum kontrolü", triggers: "Tetikleyiciler", readyToComplete: "Son adım",
  technique: "Bir yöntem seç", phoneAwayReady: "Telefonu uzağa koy", phoneAwayActive: "Kısa mola", trigger: "Tetikleyici" };

export function UrgeControlResumeScreen() {
  const feature = useUrgeControlFeature();
  const { view, actions, locked } = feature;
  const [touched, setTouched] = useState<0 | 1 | 2>(0);
  const active = view.kind === "current" || view.kind === "legacy";
  const needsStatusPanel = feature.saveState !== "saved" || feature.message !== null || feature.canRetry || feature.terminalReceipt;

  return (
    <AppScreen scroll includeBottomNavClearance={false}>
      <View testID="bloom.urge.resume" style={styles.page}>
        <View style={styles.header}>
          <AppText variant="overline" tone="accent">URGE CONTROL</AppText>
          <AppText variant="heading1" accessibilityRole="header">Şu an tetiklendim</AppText>
        </View>
        <View style={needsStatusPanel ? styles.statusPanel : styles.statusLine}>
          <AppText testID="bloom.urge.save-state" accessibilityLiveRegion="polite" variant="bodySmall" tone={feature.saveState === "unconfirmed" ? "warning" : "secondary"}>
            {saveLabels[feature.saveState]}
          </AppText>
          {feature.message !== null ? <AppText testID="bloom.urge.message" accessibilityRole="alert" tone="danger">{feature.message}</AppText> : null}
          {feature.canRetry ? <AppButton testID="bloom.urge.retry" label="Yeniden kaydet" variant="secondary" disabled={feature.busy} onPress={actions.retry} /> : null}
          {feature.canContinue ? <AppButton testID="bloom.urge.continue" label="Devam et" onPress={actions.continueAfterSave} /> : null}
        </View>

        {feature.terminalReceipt ? (
          <AppCard variant="hero" style={styles.cardStack}>
            <AppText testID="bloom.urge.receipt" variant="heading2">{feature.canContinue ? "Kayıt hazır." : "Kaydın kaydedilmesi bekleniyor."}</AppText>
            <AppText tone="secondary">{feature.canContinue ? "Devam etmeye hazırsın." : "Kaydetme doğrulandığında devam edebilirsin."}</AppText>
          </AppCard>
        ) : active ? (
          <View style={styles.stack}>
            <AppText testID="bloom.urge.stage" variant="overline" tone="accent">{stageLabels[view.progress.stage]}</AppText>
            {view.progress.stage === "interrupt" ? (
              <View style={styles.stack}>
                <View style={styles.cardStack}>
                  <AppText variant="display" accessibilityRole="header">Şunu bitir</AppText>
                  <AppText variant="bodyLarge" tone="secondary">Dürtüyü fark et. Bir nefes al, sonra dikkatini çevrene taşı. Hazır olduğunda devam et.</AppText>
                </View>
                <View style={styles.circleRow}>
                  <AppButton testID="bloom.urge.interrupt.breathe" label="Nefes al" accessibilityLabel="Nefes almaya odaklan" variant={touched === 1 ? "primary" : "secondary"} style={styles.circleButton} onPress={() => setTouched(1)} />
                  <AppButton testID="bloom.urge.interrupt.notice" label="Çevrene bak" accessibilityLabel="Çevreni fark et" variant={touched === 2 ? "primary" : "secondary"} style={styles.circleButton} onPress={() => setTouched(2)} />
                </View>
                <AppText variant="bodySmall" tone="secondary" style={styles.centerText}>Bir süre hedefi yok. Bu kısa ara sana ait.</AppText>
                <AppButton testID="bloom.urge.interrupt.complete" label="Devam et" disabled={locked} onPress={actions.completeInterrupt} />
              </View>
            ) : null}
            {view.progress.stage === "outcome" ? (
              <View style={styles.stack}>
                <View style={styles.cardStack}>
                  <AppText variant="display" accessibilityRole="header">Şimdi nasıl hissediyorsun?</AppText>
                  <AppText tone="secondary">Kısa aradan sonra şu anki deneyimine en yakın seçeneği seç.</AppText>
                </View>
                <View style={styles.choiceList} accessibilityRole="radiogroup" accessibilityLabel="Şimdi nasıl hissediyorsun?">
                  {outcomes.map(([value, label]) => (
                    <AppButton key={value} testID={`bloom.urge.outcome.${value}`} label={label} accessibilityRole="radio" accessibilityLabel={label} disabled={locked} variant="secondary" onPress={() => actions.recordOutcome(value)} />
                  ))}
                </View>
              </View>
            ) : null}
            {view.kind === "current" && view.progress.stage === "triggers" ? (
              <TriggerSelection key={view.event.id} locked={locked} onSubmit={actions.recordTriggers} />
            ) : null}
            {view.kind === "legacy" && view.progress.stage === "technique" ? (
              <AppCard style={styles.cardStack}>
                <AppText variant="heading2">Bir yöntem seç</AppText>
                <AppText variant="bodySmall" tone="secondary">Bu, daha önce başlatılmış kaydın devam adımıdır.</AppText>
                {techniques.map(([value, label]) => <AppButton key={value} testID={`bloom.urge.technique.${value}`} label={label} variant="secondary" disabled={locked} onPress={() => actions.selectTechnique(value)} />)}
              </AppCard>
            ) : null}
            {view.kind === "legacy" && view.progress.stage === "phoneAwayReady" ? (
              <AppCard style={styles.cardStack}>
                <AppText variant="heading2">Telefonu uzağa koy</AppText>
                <AppButton testID="bloom.urge.phone-away.start" label="Bu adımı başlat" disabled={locked} onPress={actions.startPhoneAway} />
              </AppCard>
            ) : null}
            {view.kind === "legacy" && view.progress.stage === "phoneAwayActive" ? (
              <AppCard style={styles.cardStack}>
                <AppText variant="heading2">Kısa mola</AppText>
                <AppText variant="bodySmall" tone="secondary">{view.progress.phoneAwayElapsedSeconds} saniye geçti</AppText>
                <AppButton testID="bloom.urge.phone-away.end" label="Bu adımı tamamla" disabled={locked} onPress={actions.endPhoneAway} />
              </AppCard>
            ) : null}
            {view.kind === "legacy" && view.progress.stage === "trigger" ? (
              <AppCard style={styles.cardStack}>
                <AppText variant="heading2">Tetikleyici</AppText>
                {legacyTriggers.map(([value, label]) => <AppButton key={value} testID={`bloom.urge.trigger.${value}`} label={label} variant="secondary" disabled={locked} onPress={() => actions.recordTrigger(value)} />)}
              </AppCard>
            ) : null}
            {view.progress.stage === "readyToComplete" ? (
              <View style={styles.stack}>
                <AppCard variant="hero" style={styles.reviewHero}>
                  <AppText variant="overline" tone="accent">SON ADIM</AppText>
                  <AppText variant="display" accessibilityRole="header" style={styles.centerText}>
                    {view.event.outcome === "reduced" ? "Dalga geçti" : "Dalgayı gözlemledin"}
                  </AppText>
                  <AppText tone="secondary" style={styles.centerText}>Bu ara ve gözlemlerin kayda hazır.</AppText>
                </AppCard>
                <AppCard style={styles.cardStack}>
                  <AppText variant="title">Kayıt özeti</AppText>
                  <View style={styles.summaryRow}>
                    <AppText tone="secondary">Şu an</AppText>
                    <AppText variant="label">{outcomes.find(([value]) => value === view.event.outcome)?.[1] ?? "Belirtilmedi"}</AppText>
                  </View>
                  {view.kind === "current" ? (
                    <View style={styles.cardStack}>
                      <AppText tone="secondary">Tetikleyiciler</AppText>
                      <AppText variant="label">{view.event.triggers?.length
                        ? view.event.triggers.map((trigger) => currentTriggers.find(([value]) => value === trigger)?.[1] ?? trigger).join(", ")
                        : "Tetikleyici seçilmedi"}</AppText>
                    </View>
                  ) : (
                    <View style={styles.cardStack}>
                      <AppText tone="secondary">Tetikleyici</AppText>
                      <AppText variant="label">{legacyTriggers.find(([value]) => value === view.event.trigger)?.[1] ?? "Belirtilmedi"}</AppText>
                    </View>
                  )}
                </AppCard>
                <AppButton testID="bloom.urge.complete" label="Anasayfaya dön" disabled={locked} onPress={actions.complete} />
              </View>
            ) : null}
            <AppButton testID="bloom.urge.discard" label="Çık ve bu kaydı bırak" variant="ghost" disabled={locked} onPress={actions.discardActive} />
          </View>
        ) : (
          <AppCard variant="hero" style={styles.cardStack}>
            <AppText testID="bloom.urge.unavailable" variant="heading2">{feature.saveState === "loading" ? "Kayıt yükleniyor." : "Bu bağlantı için devam edilebilecek bir kayıt bulunamadı."}</AppText>
            <AppButton testID="bloom.urge.close" label="Bugün ekranına dön" variant="ghost" disabled={locked} onPress={actions.closeUnavailable} />
          </AppCard>
        )}
      </View>
    </AppScreen>
  );
}

function TriggerSelection({ locked, onSubmit }: { locked: boolean; onSubmit: (triggers: CurrentUrgeControlTrigger[]) => void }) {
  const [selected, setSelected] = useState<CurrentUrgeControlTrigger[]>([]);
  const draft = useRef<CurrentUrgeControlTrigger[]>([]);
  const toggle = (value: CurrentUrgeControlTrigger) => {
    if (locked) return;
    draft.current = draft.current.includes(value) ? draft.current.filter((entry) => entry !== value) : [...draft.current, value];
    setSelected(draft.current);
  };
  const submit = (skip: boolean) => {
    if (locked) return;
    onSubmit(skip ? [] : [...draft.current]);
  };
  return (
    <View style={styles.stack}>
      <View style={styles.cardStack}>
        <AppText variant="display" accessibilityRole="header">Seni ne tetikledi?</AppText>
        <AppText tone="secondary">Birden fazla seçebilirsin. Opsiyonel.</AppText>
      </View>
      <View style={styles.triggerGrid}>
        {currentTriggers.map(([value, label]) => (
          <AppButton key={value} testID={`bloom.urge.triggers.${value}`} label={label}
            variant={selected.includes(value) ? "primary" : "secondary"} style={styles.triggerChoice}
            accessibilityRole="checkbox" accessibilityLabel={label}
            accessibilityState={{ checked: selected.includes(value) }}
            disabled={locked} onPress={() => toggle(value)} />
        ))}
      </View>
      <AppButton testID="bloom.urge.triggers.save" label="Kaydet" disabled={locked} onPress={() => submit(false)} />
      <AppButton testID="bloom.urge.triggers.skip" label="Bu adımı atla" variant="ghost" disabled={locked} onPress={() => submit(true)} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: theme.spacing.xl2, paddingBottom: theme.spacing.xl3 },
  header: { gap: theme.spacing.xs },
  stack: { gap: theme.spacing.lg },
  cardStack: { gap: theme.spacing.md },
  statusLine: { alignItems: "center" },
  statusPanel: { gap: theme.spacing.sm, padding: theme.spacing.md, borderRadius: theme.radius.lg, backgroundColor: theme.colors.bg.surface },
  circleRow: { flexDirection: "row", justifyContent: "center", gap: theme.spacing.md },
  circleButton: { width: 116, height: 116, borderRadius: theme.radius.pill, paddingHorizontal: theme.spacing.sm },
  centerText: { textAlign: "center" },
  choiceList: { gap: theme.spacing.sm },
  triggerGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: theme.spacing.xs },
  triggerChoice: { width: "48%", paddingHorizontal: theme.spacing.sm },
  reviewHero: { alignItems: "center", gap: theme.spacing.md },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.md }
});
