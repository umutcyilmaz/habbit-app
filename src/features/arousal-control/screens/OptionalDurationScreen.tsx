import { useEffect, useReducer, useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import {
  isArousalSessionReadyForCompletion,
  isValidCompletedArousalLog
} from "../../../storage/bloomState";
import { ArousalControlFlowHeader } from "../components/ArousalControlFlowHeader";
import {
  createInitialDurationInputState,
  durationInputReducer,
  resolveDurationSubmission,
  type DurationRange
} from "../practiceSubmission";

type DurationOption = DurationRange | "preferNot";

const durationOptions: readonly { value: DurationOption; label: string }[] = [
  { value: "lessThanOne", label: "Less than 1 min" },
  { value: "oneToThree", label: "1–3 min" },
  { value: "threeToFive", label: "3–5 min" },
  { value: "fiveToTen", label: "5–10 min" },
  { value: "tenToFifteen", label: "10–15 min" },
  { value: "fifteenPlus", label: "15+ min" },
  { value: "preferNot", label: "Prefer not to log" }
];

export function OptionalDurationScreen() {
  const router = useRouter();
  const {
    state,
    completeArousalSession,
    discardArousalSession
  } = useBloomLocalState();
  const draft = state.arousalControl.draft;
  const [durationInput, dispatchDuration] = useReducer(
    durationInputReducer,
    undefined,
    createInitialDurationInputState
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationMessage, setValidationMessage] =
    useState<string | undefined>();
  const submitInFlightRef = useRef(false);
  const completedSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (draft === null) {
      const completedSessionId = completedSessionIdRef.current;

      if (
        completedSessionId !== null &&
        state.arousalControl.logs.some(
          (log) =>
            log.id === completedSessionId &&
            isValidCompletedArousalLog(log)
        )
      ) {
        router.replace(routes.arousalControlSaved);
      } else if (completedSessionId === null) {
        router.replace(routes.arousalControl);
      }

      return;
    }

    if (!isArousalSessionReadyForCompletion(draft)) {
      router.replace(routes.arousalControl);
    }
  }, [draft, router, state.arousalControl.logs]);

  const selectDuration = (value: DurationOption) => {
    setValidationMessage(undefined);
    dispatchDuration(
      value === "preferNot"
        ? { type: "selectPreferNot" }
        : { type: "selectRange", range: value }
    );
  };

  const showExactTime = () => {
    setValidationMessage(undefined);
    dispatchDuration({ type: "selectExact" });
  };

  const updateMinutes = (value: string) => {
    dispatchDuration({ type: "setMinutes", value });
  };

  const updateSeconds = (value: string) => {
    dispatchDuration({ type: "setSeconds", value });
  };

  const savePractice = (skipDuration = false) => {
    if (
      draft === null ||
      !isArousalSessionReadyForCompletion(draft) ||
      submitInFlightRef.current
    ) {
      return;
    }

    const submission = resolveDurationSubmission(
      skipDuration
        ? createInitialDurationInputState()
        : durationInput
    );

    if (!submission.ok) {
      setValidationMessage(
        submission.reason === "invalidExactDuration"
          ? "Enter seconds from 0 to 59."
          : "Enter a duration before saving."
      );
      return;
    }

    submitInFlightRef.current = true;
    setIsSubmitting(true);
    completedSessionIdRef.current = draft.id;
    const result = completeArousalSession(
      draft.id,
      submission.patch
    );

    if (!result.ok) {
      completedSessionIdRef.current = null;
      submitInFlightRef.current = false;
      setIsSubmitting(false);
      setValidationMessage("This practice could not be saved yet.");
      return;
    }
  };

  const closePractice = () => {
    if (draft !== null) {
      discardArousalSession(draft.id);
    }

    router.replace(routes.exercises);
  };

  if (
    draft === null ||
    !isArousalSessionReadyForCompletion(draft)
  ) {
    return <AppScreen />;
  }

  return (
    <AppScreen contentStyle={styles.content}>
      <ArousalControlFlowHeader
        label="OPTIONAL DURATION"
        icon="◌"
        title="Log duration only if useful."
        subtitle="Duration is saved only as a personal trend. It is not rated as good or bad."
        onBackPress={() => router.replace(routes.arousalControlReflection)}
        onClosePress={closePractice}
      />

      <View style={styles.stack}>
        <AppCard style={styles.mainCard}>
          <View style={styles.cardStack}>
            <View style={styles.copy}>
              <AppText variant="title">Approximate duration</AppText>
              <AppText variant="bodySmall" tone="secondary">
                Choose a range, enter an exact time, or skip this detail.
              </AppText>
            </View>

            <View style={styles.durationGrid}>
              {durationOptions.map((option) => (
                <Pressable
                  key={option.value}
                  testID={
                    option.value === "preferNot"
                      ? "bloom.arousal.duration.mode.prefer-not"
                      : `bloom.arousal.duration.range.${option.value}`
                  }
                  accessibilityRole="button"
                  accessibilityState={{
                    selected:
                      option.value === "preferNot"
                        ? durationInput.mode === "preferNot"
                        : durationInput.mode === "range" &&
                          durationInput.selectedRange === option.value
                  }}
                  onPress={() => selectDuration(option.value)}
                  style={({ pressed }) => [
                    styles.durationChip,
                    option.value === "preferNot" ? styles.fullWidthChip : undefined,
                    (option.value === "preferNot"
                      ? durationInput.mode === "preferNot"
                      : durationInput.mode === "range" &&
                        durationInput.selectedRange === option.value)
                      ? styles.durationChipSelected
                      : undefined,
                    pressed ? styles.durationChipPressed : undefined
                  ]}
                >
                  <AppText variant="label" align="center">
                    {option.label}
                  </AppText>
                </Pressable>
              ))}
            </View>

            <AppButton
              testID="bloom.arousal.duration.mode.exact"
              variant="subtle"
              onPress={showExactTime}
            >
              Enter exact time
            </AppButton>
          </View>
        </AppCard>

        {durationInput.mode === "exact" ? (
          <AppCard
            testID="bloom.arousal.duration.exact.card"
            style={styles.exactCard}
          >
            <View style={styles.cardStack}>
              <View style={styles.copy}>
                <AppText variant="title">Exact time</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  Optional. Leave either field blank if you are not sure.
                </AppText>
              </View>

              <View style={styles.inputRow}>
                <View style={styles.inputGroup}>
                  <AppText variant="caption" tone="secondary">
                    Minutes
                  </AppText>
                  <TextInput
                    testID="bloom.arousal.duration.exact.minutes"
                    value={durationInput.minutes}
                    onChangeText={updateMinutes}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={theme.colors.textSecondary}
                    style={styles.input}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <AppText variant="caption" tone="secondary">
                    Seconds
                  </AppText>
                  <TextInput
                    testID="bloom.arousal.duration.exact.seconds"
                    value={durationInput.seconds}
                    onChangeText={updateSeconds}
                    keyboardType="number-pad"
                    placeholder="0"
                    placeholderTextColor={theme.colors.textSecondary}
                    style={styles.input}
                  />
                </View>
              </View>
            </View>
          </AppCard>
        ) : null}

        <View style={styles.supportNote}>
          <View style={styles.noteCopy}>
            <AppText variant="title" align="center">
              Duration is not a score.
            </AppText>
            <AppText tone="secondary" align="center">
              It can help you notice patterns, but progress is based on awareness, not time.
            </AppText>
          </View>
        </View>

        <View style={styles.actions}>
          {validationMessage ? (
            <AppText variant="bodySmall" tone="secondary" align="center">
              {validationMessage}
            </AppText>
          ) : null}
          <AppButton
            testID="bloom.arousal.complete"
            loading={isSubmitting}
            onPress={() => savePractice()}
          >
            Save Practice
          </AppButton>
          <AppButton
            variant="ghost"
            disabled={isSubmitting}
            onPress={() => savePractice(true)}
          >
            Skip duration
          </AppButton>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 430
  },
  stack: {
    gap: theme.spacing.lg
  },
  mainCard: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.lg
  },
  exactCard: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.lg
  },
  cardStack: {
    gap: theme.spacing.lg
  },
  copy: {
    gap: theme.spacing.sm
  },
  durationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  durationChip: {
    minHeight: 54,
    flexGrow: 1,
    flexBasis: "46%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  fullWidthChip: {
    flexBasis: "100%"
  },
  durationChipSelected: {
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted
  },
  durationChipPressed: {
    backgroundColor: theme.colors.surfaceMuted
  },
  inputRow: {
    flexDirection: "row",
    gap: theme.spacing.md
  },
  inputGroup: {
    flex: 1,
    gap: theme.spacing.sm
  },
  input: {
    minHeight: 52,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.size.body,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  supportNote: {
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.lg
  },
  noteCopy: {
    gap: theme.spacing.sm
  },
  actions: {
    gap: theme.spacing.sm
  }
});
