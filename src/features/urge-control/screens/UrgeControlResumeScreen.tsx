import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { CurrentUrgeControlTrigger, LegacyUrgeControlTrigger, UrgeControlOutcome, UrgeControlTechnique } from "../../../domain/models/UrgeControlEvent";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { useUrgeControlFeature } from "../useUrgeControlFeature";

const outcomes: Array<[UrgeControlOutcome, string]> = [["reduced", "Azaldı"], ["stillStrong", "Hâlâ güçlü"], ["stronger", "Daha güçlü"], ["unchanged", "Değişmedi"]];
const currentTriggers: Array<[CurrentUrgeControlTrigger, string]> = [["boredom", "Can sıkıntısı"], ["stress", "Stres"], ["loneliness", "Yalnızlık"], ["fatigue", "Yorgunluk"], ["explicitContentCue", "İçerik gördüm"], ["habitAutomatic", "Alışkanlık"], ["specificSituation", "Belirli bir durum"], ["other", "Diğer"]];
const techniques: Array<[UrgeControlTechnique, string]> = [["changeEnvironment", "Ortam değiştir"], ["grounding54321", "Duyularına odaklan"], ["cognitiveTask", "Kısa bir zihinsel görev"], ["urgeSurfing", "Dürtüyü gözlemle"], ["personalReminder", "Kişisel hatırlatıcı"]];
const legacyTriggers: Array<[LegacyUrgeControlTrigger, string]> = [["boredom", "Can sıkıntısı"], ["stress", "Stres"], ["loneliness", "Yalnızlık"], ["sleeplessnessNighttime", "Uykusuzluk / gece"], ["sexualDesire", "Cinsel istek"], ["habitAutomatic", "Alışkanlık"], ["notSure", "Emin değilim"]];
const saveLabels = { loading: "Kayıt yükleniyor…", unavailable: "Yerel veriler kullanılamıyor", saving: "Kaydediliyor…", saved: "Bu cihazda kaydedildi", unconfirmed: "Kaydetme henüz doğrulanmadı" };
const stageLabels = { interrupt: "Kısa bir ara", outcome: "Şu an nasıl?", triggers: "Tetikleyiciler", readyToComplete: "Tamamlamaya hazır",
  technique: "Bir yöntem seç", phoneAwayReady: "Telefonu uzağa koy", phoneAwayActive: "Kısa mola", trigger: "Tetikleyici" };

export function UrgeControlResumeScreen() {
  const feature = useUrgeControlFeature();
  const { view, actions, locked } = feature;
  const active = view.kind === "current" || view.kind === "legacy";
  return <AppScreen><View testID="bloom.urge.resume" style={styles.stack}>
    <AppText variant="heading" accessibilityRole="header">Şu an tetiklendim</AppText>
    <AppCard style={styles.stack}>
      <AppText testID="bloom.urge.save-state" accessibilityLiveRegion="polite">{saveLabels[feature.saveState]}</AppText>
      {feature.message !== null ? <AppText testID="bloom.urge.message" accessibilityRole="alert">{feature.message}</AppText> : null}
      {feature.canRetry ? <AppButton testID="bloom.urge.retry" disabled={feature.busy} onPress={actions.retry}>Yeniden kaydet</AppButton> : null}
      {feature.canContinue ? <AppButton testID="bloom.urge.continue" onPress={actions.continueAfterSave}>Devam et</AppButton> : null}
    </AppCard>
    {feature.terminalReceipt ? <AppText testID="bloom.urge.receipt">{feature.canContinue ? "Kayıt hazır." : "Kaydın kaydedilmesi bekleniyor."}</AppText> : active ? <AppCard style={styles.stack}>
      <AppText testID="bloom.urge.stage" variant="label">{stageLabels[view.progress.stage]}</AppText>
      {view.progress.stage === "interrupt" ? <>
        <AppText>Kısa bir ara ver. Dürtüyü fark et ve bir sonraki adımı seçmek için kendine alan tanı.</AppText>
        <AppButton testID="bloom.urge.interrupt.complete" disabled={locked} onPress={actions.completeInterrupt}>Tamamla</AppButton>
      </> : null}
      {view.progress.stage === "outcome" ? <><AppText>Şu an nasıl?</AppText>{outcomes.map(([value, label]) =>
        <AppButton key={value} testID={`bloom.urge.outcome.${value}`} disabled={locked} onPress={() => actions.recordOutcome(value)}>{label}</AppButton>)}</> : null}
      {view.kind === "current" && view.progress.stage === "triggers" ? <TriggerSelection key={view.event.id} locked={locked} onSubmit={actions.recordTriggers} /> : null}
      {view.kind === "legacy" && view.progress.stage === "technique" ? techniques.map(([value, label]) =>
        <AppButton key={value} testID={`bloom.urge.technique.${value}`} disabled={locked} onPress={() => actions.selectTechnique(value)}>{label}</AppButton>) : null}
      {view.kind === "legacy" && view.progress.stage === "phoneAwayReady" ? <AppButton testID="bloom.urge.phone-away.start" disabled={locked} onPress={actions.startPhoneAway}>Telefonu uzağa koyma adımını başlat</AppButton> : null}
      {view.kind === "legacy" && view.progress.stage === "phoneAwayActive" ? <>
        <AppText>{view.progress.phoneAwayElapsedSeconds} saniye</AppText>
        <AppButton testID="bloom.urge.phone-away.end" disabled={locked} onPress={actions.endPhoneAway}>Bu adımı tamamla</AppButton>
      </> : null}
      {view.kind === "legacy" && view.progress.stage === "trigger" ? legacyTriggers.map(([value, label]) =>
        <AppButton key={value} testID={`bloom.urge.trigger.${value}`} disabled={locked} onPress={() => actions.recordTrigger(value)}>{label}</AppButton>) : null}
      {view.progress.stage === "readyToComplete" ? <AppButton testID="bloom.urge.complete" disabled={locked} onPress={actions.complete}>Tamamla</AppButton> : null}
      <AppButton testID="bloom.urge.discard" variant="ghost" disabled={locked} onPress={actions.discardActive}>Çık ve bu kaydı bırak</AppButton>
    </AppCard> : <AppCard style={styles.stack}>
      <AppText testID="bloom.urge.unavailable">{feature.saveState === "loading" ? "Kayıt yükleniyor." : "Bu bağlantı için devam edilebilecek bir kayıt bulunamadı."}</AppText>
      <AppButton testID="bloom.urge.close" variant="ghost" disabled={locked} onPress={actions.closeUnavailable}>Today ekranına dön</AppButton>
    </AppCard>}
  </View></AppScreen>;
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
  return <View style={styles.stack}>
    <AppText>Ne tetiklemiş olabilir? Birden fazla seçenek seçebilir veya bu adımı atlayabilirsin.</AppText>
    {currentTriggers.map(([value, label]) => <AppButton key={value} testID={`bloom.urge.triggers.${value}`} variant={selected.includes(value) ? "secondary" : "subtle"}
      accessibilityState={{ selected: selected.includes(value) }} disabled={locked} onPress={() => toggle(value)}>{label}</AppButton>)}
    <AppButton testID="bloom.urge.triggers.save" disabled={locked} onPress={() => submit(false)}>Kaydet</AppButton>
    <AppButton testID="bloom.urge.triggers.skip" variant="ghost" disabled={locked} onPress={() => submit(true)}>Bu adımı atla</AppButton>
  </View>;
}

const styles = StyleSheet.create({ stack: { gap: theme.spacing.lg } });
