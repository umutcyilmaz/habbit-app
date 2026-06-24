import type { PropsWithChildren } from "react";
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { ArousalControlFlowHeader } from "../components/ArousalControlFlowHeader";
import { ArousalLevelPicker } from "../components/ArousalLevelPicker";

type PauseCountOption = "none" | "one" | "two" | "threePlus";
type PressureOption = "low" | "medium" | "high" | "veryHigh";
type AfterFeelingOption =
  | "calm"
  | "satisfied"
  | "neutral"
  | "empty"
  | "uneasy"
  | "anxious"
  | "frustrated"
  | "notSure";

const pauseCountOptions: readonly { value: PauseCountOption; label: string }[] = [
  { value: "none", label: "0" },
  { value: "one", label: "1" },
  { value: "two", label: "2" },
  { value: "threePlus", label: "3+" }
];

const pressureOptions: readonly { value: PressureOption; label: string }[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "veryHigh", label: "Very high" }
];

const afterFeelingOptions: readonly { value: AfterFeelingOption; label: string }[] = [
  { value: "calm", label: "Calm" },
  { value: "satisfied", label: "Satisfied" },
  { value: "neutral", label: "Neutral" },
  { value: "empty", label: "Empty" },
  { value: "uneasy", label: "Uneasy" },
  { value: "anxious", label: "Anxious" },
  { value: "frustrated", label: "Frustrated" },
  { value: "notSure", label: "Not sure" }
];

const controlFeelingGroups = [
  { label: "1–3", detail: "Low" },
  { label: "4–6", detail: "Steady" },
  { label: "7–10", detail: "Strong" }
] as const;

export function SessionReflectionScreen() {
  const router = useRouter();
  const [pauseCount, setPauseCount] = useState<PauseCountOption>("one");
  const [highestArousal, setHighestArousal] = useState(7);
  const [controlFeeling, setControlFeeling] = useState(6);
  const [pleasureQuality, setPleasureQuality] = useState(7);
  const [pressure, setPressure] = useState<PressureOption>("medium");
  const [afterFeeling, setAfterFeeling] = useState<AfterFeelingOption>("neutral");
  const [reflectionConfirmed, setReflectionConfirmed] = useState(false);

  const updatePauseCount = (value: PauseCountOption) => {
    setPauseCount(value);
    setReflectionConfirmed(false);
  };

  const updateHighestArousal = (value: number) => {
    setHighestArousal(value);
    setReflectionConfirmed(false);
  };

  const updateControlFeeling = (value: number) => {
    setControlFeeling(value);
    setReflectionConfirmed(false);
  };

  const updatePleasureQuality = (value: number) => {
    setPleasureQuality(value);
    setReflectionConfirmed(false);
  };

  const updatePressure = (value: PressureOption) => {
    setPressure(value);
    setReflectionConfirmed(false);
  };

  const updateAfterFeeling = (value: AfterFeelingOption) => {
    setAfterFeeling(value);
    setReflectionConfirmed(false);
  };

  return (
    <AppScreen contentStyle={styles.content}>
      <ArousalControlFlowHeader
        label="REFLECTION"
        icon="○"
        title="What did you notice?"
        subtitle="A few details can help you understand your pattern without judging it."
        onBackPress={() => router.replace(routes.arousalControlFinish)}
        onClosePress={() => router.replace(routes.exercises)}
      />

      <View style={styles.stack}>
        <ReflectionSection title="How many pauses did you take?">
          <ChipGroup options={pauseCountOptions} selected={pauseCount} onSelect={updatePauseCount} />
        </ReflectionSection>

        <ReflectionSection title="Highest arousal level you noticed">
          <ArousalLevelPicker value={highestArousal} onChange={updateHighestArousal} />
        </ReflectionSection>

        <ReflectionSection title="Control feeling">
          <ArousalLevelPicker
            value={controlFeeling}
            onChange={updateControlFeeling}
            minLabel="0 = low control"
            maxLabel="10 = strong control"
            groups={controlFeelingGroups}
          />
        </ReflectionSection>

        <ReflectionSection title="Pleasure quality">
          <ArousalLevelPicker
            value={pleasureQuality}
            onChange={updatePleasureQuality}
            minLabel="0 = low"
            maxLabel="10 = high"
            groups={[]}
          />
        </ReflectionSection>

        <ReflectionSection title="Pressure or rushing">
          <ChipGroup options={pressureOptions} selected={pressure} onSelect={updatePressure} />
        </ReflectionSection>

        <ReflectionSection title="How do you feel afterward?">
          <ChipGroup options={afterFeelingOptions} selected={afterFeeling} onSelect={updateAfterFeeling} />
        </ReflectionSection>

        <View style={styles.supportNote}>
          <View style={styles.noteCopy}>
            <AppText variant="title" align="center">
              There is no score here.
            </AppText>
            <AppText tone="secondary" align="center">
              These answers are only for noticing patterns over time.
            </AppText>
          </View>
        </View>

        {reflectionConfirmed ? (
          <View style={styles.confirmation}>
            <View style={styles.noteCopy}>
              <AppText variant="title" align="center">
                Reflection saved.
              </AppText>
              <AppText tone="secondary" align="center">
                You can return to Exercises when ready.
              </AppText>
            </View>
            <AppButton onPress={() => router.replace(routes.exercises)}>Back to Exercises</AppButton>
          </View>
        ) : (
          <AppButton onPress={() => setReflectionConfirmed(true)}>Continue</AppButton>
        )}
      </View>
    </AppScreen>
  );
}

type ReflectionSectionProps = PropsWithChildren<{
  title: string;
}>;

function ReflectionSection({ title, children }: ReflectionSectionProps) {
  return (
    <AppCard style={styles.sectionCard}>
      <View style={styles.sectionStack}>
        <AppText variant="title">{title}</AppText>
        {children}
      </View>
    </AppCard>
  );
}

type ChipOption<T extends string> = {
  value: T;
  label: string;
};

type ChipGroupProps<T extends string> = {
  options: readonly ChipOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
};

function ChipGroup<T extends string>({ options, selected, onSelect }: ChipGroupProps<T>) {
  return (
    <View style={styles.chipGroup}>
      {options.map((option) => (
        <Pressable
          key={option.value}
          accessibilityRole="button"
          accessibilityState={{ selected: selected === option.value }}
          onPress={() => onSelect(option.value)}
          style={({ pressed }) => [
            styles.chip,
            selected === option.value ? styles.chipSelected : undefined,
            pressed ? styles.chipPressed : undefined
          ]}
        >
          <AppText variant="label" align="center">
            {option.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 430
  },
  stack: {
    gap: theme.spacing.lg
  },
  sectionCard: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.lg
  },
  sectionStack: {
    gap: theme.spacing.md
  },
  chipGroup: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  chip: {
    minHeight: 42,
    minWidth: 72,
    flexGrow: 1,
    flexBasis: "28%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  chipSelected: {
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted
  },
  chipPressed: {
    backgroundColor: theme.colors.surfaceMuted
  },
  supportNote: {
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.lg
  },
  confirmation: {
    gap: theme.spacing.lg,
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    ...theme.shadows.card
  },
  noteCopy: {
    gap: theme.spacing.sm
  }
});
