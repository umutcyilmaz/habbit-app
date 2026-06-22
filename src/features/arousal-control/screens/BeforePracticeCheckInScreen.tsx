import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { ArousalControlFlowHeader } from "../components/ArousalControlFlowHeader";
import { PracticeOptionChip } from "../components/PracticeOptionChip";
import { PracticeQuestionCard } from "../components/PracticeQuestionCard";
import { PracticeSetupConfirmation } from "../components/PracticeSetupConfirmation";

type FocusOption =
  | "noticeRising"
  | "onePause"
  | "reduceRushing"
  | "stayRelaxed"
  | "withoutAdultContent"
  | "justObserve";

type AdultContentOption = "no" | "yes" | "notSure";
type FirmnessPlanOption = "finish" | "tryAgain" | "appSuggest";

const focusOptions: readonly { value: FocusOption; label: string }[] = [
  { value: "noticeRising", label: "Notice arousal rising" },
  { value: "onePause", label: "Try one pause" },
  { value: "reduceRushing", label: "Reduce rushing" },
  { value: "stayRelaxed", label: "Stay more relaxed" },
  { value: "withoutAdultContent", label: "Practice without adult content" },
  { value: "justObserve", label: "Just observe" }
];

const adultContentOptions: readonly { value: AdultContentOption; label: string }[] = [
  { value: "no", label: "No" },
  { value: "yes", label: "Yes" },
  { value: "notSure", label: "Not sure" }
];

const firmnessPlanOptions: readonly { value: FirmnessPlanOption; label: string }[] = [
  { value: "finish", label: "Finish the practice" },
  { value: "tryAgain", label: "Try again gently" },
  { value: "appSuggest", label: "Let the app suggest options" }
];

export function BeforePracticeCheckInScreen() {
  const router = useRouter();
  const [focus, setFocus] = useState<FocusOption>("noticeRising");
  const [adultContent, setAdultContent] = useState<AdultContentOption>("no");
  const [firmnessPlan, setFirmnessPlan] = useState<FirmnessPlanOption>("appSuggest");
  const [setupSaved, setSetupSaved] = useState(false);

  return (
    <AppScreen contentStyle={styles.content}>
      <ArousalControlFlowHeader
        label="BEFORE PRACTICE"
        icon="✓"
        title="Set a gentle intention."
        subtitle="A short check-in can help you practice with less pressure and more awareness."
        onBackPress={() => router.replace(routes.arousalControlMode)}
        onClosePress={() => router.replace(routes.exercises)}
      />

      <View style={styles.stack}>
        <PracticeQuestionCard title="What is today’s focus?">
          <View style={styles.chipGrid}>
            {focusOptions.map((option) => (
              <PracticeOptionChip
                key={option.value}
                value={option.value}
                label={option.label}
                selected={focus === option.value}
                onSelect={setFocus}
              />
            ))}
          </View>
        </PracticeQuestionCard>

        <PracticeQuestionCard title="Will you use adult content during this practice?">
          <View style={styles.chipGrid}>
            {adultContentOptions.map((option) => (
              <PracticeOptionChip
                key={option.value}
                value={option.value}
                label={option.label}
                selected={adultContent === option.value}
                onSelect={setAdultContent}
              />
            ))}
          </View>
          {adultContent === "yes" ? (
            <View style={styles.supportNote}>
              <AppText variant="bodySmall" tone="secondary">
                That’s okay. Today, simply notice how quickly arousal rises and how it affects
                control.
              </AppText>
            </View>
          ) : null}
        </PracticeQuestionCard>

        <PracticeQuestionCard title="If firmness decreases during a pause, what would feel safest?">
          <View style={styles.chipGrid}>
            {firmnessPlanOptions.map((option) => (
              <PracticeOptionChip
                key={option.value}
                value={option.value}
                label={option.label}
                selected={firmnessPlan === option.value}
                onSelect={setFirmnessPlan}
              />
            ))}
          </View>
        </PracticeQuestionCard>

        <AppText variant="bodySmall" tone="secondary" align="center">
          You can stop anytime. This is not a test.
        </AppText>

        {setupSaved ? (
          <PracticeSetupConfirmation onBackToExercises={() => router.replace(routes.exercises)} />
        ) : (
          <AppButton onPress={() => setSetupSaved(true)}>Begin Practice</AppButton>
        )}
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 430
  },
  stack: {
    gap: theme.spacing.xl
  },
  chipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  supportNote: {
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted,
    padding: theme.spacing.md
  }
});
