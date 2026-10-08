import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useBloomProductFlowActions } from "../../app/flows/useBloomProductFlowActions";
import { useBloomLocalState } from "../../app/providers/BloomLocalStateProvider";
import { routes } from "../../constants/navigation";
import { AppButton } from "../../shared/components/v4/AppButton";
import { AppScreen } from "../../shared/components/v4/AppScreen";
import { AppText } from "../../shared/components/v4/AppText";
import { theme } from "../../shared/design-system/v4/theme";
import { usePersistenceNavigationGuard } from "../../shared/navigation/usePersistenceNavigationGuard";
import { labelForAnswer, questionCopy } from "./productOnboardingCopy";
import { completedProductAnswers, isProductQuestionAnswered, productQuestions, selectProductAnswer, type DraftAnswers } from "./productOnboardingQuiz";
import { productOnboardingSubmission } from "./productOnboardingSubmission";

export function ProductOnboardingQuizScreen() {
  const router = useRouter();
  const flowActions = useBloomProductFlowActions();
  const { state, durableState, getAcceptedState, retryPersistedMutation, hydrationStatus } = useBloomLocalState();
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<DraftAnswers>({});
  const [message, setMessage] = useState<string | null>(null);
  const submission = useSyncExternalStore(productOnboardingSubmission.subscribe, productOnboardingSubmission.getSnapshot, productOnboardingSubmission.getSnapshot);
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (hydrationStatus === "ready" && submission.persisted &&
      durableState.productOnboarding.status === "notCompleted" && getAcceptedState().productOnboarding.status === "notCompleted") {
      productOnboardingSubmission.clearIfObsolete(durableState.productOnboarding);
    }
  }, [durableState.productOnboarding, getAcceptedState, hydrationStatus, submission.persisted]);
  const savedResult = durableState.productOnboarding.status === "completed" && durableState.productOnboarding.planAcceptance === null;
  const savedSubmission = submission.persisted && submission.result !== null && savedResult &&
    durableState.productOnboarding.status === "completed" && durableState.productOnboarding.result.completedAt === submission.result.completedAt;
  const unconfirmed = submission.accepted !== null && !savedResult;
  const allowNavigation = usePersistenceNavigationGuard(submission.busy || unconfirmed);
  useEffect(() => {
    if (savedSubmission && mounted.current) {
      allowNavigation();
      router.replace("/bloom/starting-recommendation");
    }
  }, [allowNavigation, router, savedSubmission]);

  const dependencies = {
    save: flowActions.onboarding.saveProductOnboardingResult,
    retry: retryPersistedMutation,
    getOnboarding: () => getAcceptedState().productOnboarding
  };
  const ready = hydrationStatus === "ready";
  const question = productQuestions[index] ?? productQuestions[0]!;
  const hasCurrentAnswer = isProductQuestionAnswered(answers, index);
  const locked = !ready || submission.busy || submission.accepted !== null || savedResult || state.productOnboarding.status === "completed";
  const advance = () => {
    if (locked) return;
    if (!hasCurrentAnswer) { setMessage("Devam etmek için bir yanıt seç."); return; }
    if (index < productQuestions.length - 1) { setIndex(index + 1); setMessage(null); return; }
    const complete = completedProductAnswers(answers);
    if (complete === null) { setMessage("Tüm soruları yanıtlayıp tekrar dene."); return; }
    setMessage(null);
    const pending = productOnboardingSubmission.submit(complete, dependencies);
    if (pending !== null) void pending.catch(() => {});
  };

  if (!ready) return <AppScreen testID="bloom.onboarding.quiz.loading"><AppText>{hydrationStatus === "error" ? "Yerel kayıtlar açılamıyor." : "Yerel kayıtlar yükleniyor…"}</AppText></AppScreen>;
  if (savedResult && !savedSubmission) return <AppScreen scroll includeBottomNavClearance={false}><View style={styles.page}><AppText variant="heading1">Yanıtların kaydedildi</AppText><AppButton testID="bloom.onboarding.result-navigation" label="Başlangıç önerine geç" onPress={() => router.replace("/bloom/starting-recommendation")} /></View></AppScreen>;
  if (state.productOnboarding.status === "completed" && submission.accepted === null) return <AppScreen testID="bloom.onboarding.quiz.unconfirmed"><AppText tone="warning">Önceki kaydın henüz doğrulanmadı. Bu ekrandan yeni bir sonuç oluşturulamaz.</AppText></AppScreen>;

  const copy = questionCopy[question.id];
  const selected = answers[question.id];
  return (
    <AppScreen scroll includeBottomNavClearance={false}>
      <View testID="bloom.onboarding.quiz" style={styles.page}>
        <View style={styles.header}>
          <AppText variant="overline" tone="accent">BAŞLANGIÇ SORULARI</AppText>
          <AppText testID="bloom.onboarding.progress" variant="label" accessibilityLabel={`${index + 1} / ${productQuestions.length}`} accessibilityLiveRegion="polite">{index + 1} / {productQuestions.length}</AppText>
        </View>
        <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: productQuestions.length, now: index + 1 }}>
          <View style={[styles.fill, { width: `${((index + 1) / productQuestions.length) * 100}%` }]} />
        </View>
        <View style={styles.question}>
          <AppText testID={`bloom.onboarding.question.${question.id}`} variant="heading1" accessibilityRole="header">{copy.prompt}</AppText>
          {copy.supportingText ? <AppText tone="secondary">{copy.supportingText}</AppText> : null}
          {question.type === "multi_select" ? <AppText variant="bodySmall" tone="accent">Birden fazla seçenek işaretleyebilirsin.</AppText> : null}
        </View>
        <View style={question.id === "erectionQuality" ? styles.numberOptions : styles.options}>
          {question.options.map((option) => {
            const active = Array.isArray(selected) ? selected.includes(option.value as never) : selected === option.value;
            return (
              <Pressable
                key={String(option.value)}
                testID={`bloom.onboarding.answer.${question.id}.${option.value}`}
                accessibilityRole={question.type === "multi_select" ? "checkbox" : "radio"}
                accessibilityLabel={labelForAnswer(option.value)}
                accessibilityState={{ checked: active, disabled: locked }}
                disabled={locked}
                onPress={() => { setAnswers((previous) => selectProductAnswer(previous, index, option.value)); setMessage(null); }}
                style={({ pressed }) => [styles.option, question.id === "erectionQuality" && typeof option.value === "number" ? styles.numberOption : undefined, active ? styles.selected : undefined, pressed ? styles.pressed : undefined]}
              >
                <AppText variant="label" style={styles.optionText}>{labelForAnswer(option.value)}</AppText>
                {active ? <AppText tone="accent" accessibilityElementsHidden>✓</AppText> : null}
              </Pressable>
            );
          })}
        </View>
        {message || submission.message ? <AppText testID="bloom.onboarding.save-error" tone="warning" accessibilityRole="alert">{message ?? submission.message}</AppText> : null}
        {submission.busy ? <AppText testID="bloom.onboarding.saving" tone="secondary" accessibilityLiveRegion="polite">Yanıtların bu cihaza kaydediliyor…</AppText> : null}
        {submission.accepted !== null && !submission.persisted ? <AppText testID="bloom.onboarding.unconfirmed" tone="warning">Kayıt henüz doğrulanmadı. Devam etmeden önce yeniden kaydet.</AppText> : null}
        {submission.retryToken !== null ? <AppButton testID="bloom.onboarding.retry" label="Yeniden kaydet" disabled={submission.busy} onPress={() => { const pending = productOnboardingSubmission.retry(dependencies); if (pending !== null) void pending.catch(() => {}); }} /> : null}
        <View style={styles.actions}>
          <AppButton testID="bloom.onboarding.back" label="Geri" variant="secondary" disabled={index === 0 || locked} onPress={() => { setIndex(index - 1); setMessage(null); }} />
          <AppButton testID={index === productQuestions.length - 1 ? "bloom.onboarding.submit" : "bloom.onboarding.next"} label={index === productQuestions.length - 1 ? "Önerimi gör" : "Devam et"} disabled={!hasCurrentAnswer || locked} loading={submission.busy} onPress={advance} />
        </View>
        <AppText variant="bodySmall" tone="secondary">Yanıtların bir sağlık tanısı oluşturmaz.</AppText>
        {submission.persisted && savedResult ? <AppButton testID="bloom.onboarding.result-navigation" label="Başlangıç önerine geç" onPress={() => { allowNavigation(); router.replace("/bloom/starting-recommendation"); }} /> : null}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  page: { width: "100%", maxWidth: 480, alignSelf: "center", gap: theme.spacing.xl, paddingBottom: theme.spacing.xl },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: theme.spacing.md },
  track: { height: theme.spacing.xs, borderRadius: theme.radius.pill, backgroundColor: theme.colors.bg.surfaceElevated, overflow: "hidden" },
  fill: { height: "100%", backgroundColor: theme.colors.accent.primary },
  question: { gap: theme.spacing.md },
  options: { gap: theme.spacing.sm },
  numberOptions: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
  option: { minHeight: 52, borderWidth: 1, borderColor: theme.colors.border.default, backgroundColor: theme.colors.bg.surface, borderRadius: theme.radius.lg, paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: theme.spacing.sm },
  numberOption: { width: "17%", justifyContent: "center" },
  selected: { borderColor: theme.colors.border.accent, backgroundColor: theme.colors.bg.accentSubtle },
  pressed: { opacity: 0.8 },
  optionText: { flexShrink: 1 },
  actions: { gap: theme.spacing.sm }
});
