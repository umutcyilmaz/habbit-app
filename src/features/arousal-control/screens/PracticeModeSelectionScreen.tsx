import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { ArousalControlFlowHeader } from "../components/ArousalControlFlowHeader";
import { PracticeModeCard, type PracticeModeId } from "../components/PracticeModeCard";

const modes = [
  {
    id: "softAwareness",
    title: "Soft Awareness",
    description: "Simply notice your arousal level. Pause is optional.",
    bestFor: "New users, firmness confidence concerns, or moments where pressure feels high."
  },
  {
    id: "onePause",
    title: "One Pause Practice",
    description: "Try to notice the rise and take one short pause.",
    bestFor: "Fast arousal, rushing, or practicing control without pressure.",
    badge: "Recommended"
  },
  {
    id: "practicePlus",
    title: "Practice+",
    description: "Use two or more pause cycles if it feels comfortable.",
    bestFor: "Users already comfortable with pause practice.",
    badge: "Optional"
  }
] as const satisfies ReadonlyArray<{
  id: PracticeModeId;
  title: string;
  description: string;
  bestFor: string;
  badge?: string;
}>;

export function PracticeModeSelectionScreen() {
  const router = useRouter();
  const [selectedMode, setSelectedMode] = useState<PracticeModeId>("onePause");
  const [continueMessage, setContinueMessage] = useState<string | undefined>();

  return (
    <AppScreen contentStyle={styles.content}>
      <ArousalControlFlowHeader
        label="PRACTICE MODE"
        title="Choose a gentle starting point."
        subtitle="There is no perfect mode. Choose the one that feels safest today."
        onBackPress={() => router.replace(routes.arousalControl)}
        onClosePress={() => router.replace(routes.exercises)}
      />

      <View style={styles.stack}>
        <View style={styles.modeStack}>
          {modes.map((mode) => (
            <PracticeModeCard
              key={mode.id}
              id={mode.id}
              title={mode.title}
              description={mode.description}
              bestFor={mode.bestFor}
              selected={selectedMode === mode.id}
              onSelect={setSelectedMode}
              {...("badge" in mode ? { badge: mode.badge } : {})}
            />
          ))}
        </View>

        {continueMessage ? (
          <View style={styles.placeholderNote}>
            <AppText variant="bodySmall" tone="secondary" align="center">
              {continueMessage}
            </AppText>
          </View>
        ) : null}

        <View style={styles.actions}>
          <AppButton
            onPress={() => setContinueMessage("Practice setup saved.")}
          >
            Continue
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.replace(routes.exercises)}>
            Back to Exercises
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
    gap: theme.spacing.xl
  },
  modeStack: {
    gap: theme.spacing.md
  },
  placeholderNote: {
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md
  },
  actions: {
    gap: theme.spacing.sm
  }
});
