import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { ArousalControlFlowHeader } from "../components/ArousalControlFlowHeader";

type DurationOption =
  | "lessThanOne"
  | "oneToThree"
  | "threeToFive"
  | "fiveToTen"
  | "tenToFifteen"
  | "fifteenPlus"
  | "preferNot";

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
  const [duration, setDuration] = useState<DurationOption>("preferNot");
  const [exactTimeVisible, setExactTimeVisible] = useState(false);
  const [minutes, setMinutes] = useState("");
  const [seconds, setSeconds] = useState("");

  const selectDuration = (value: DurationOption) => {
    setDuration(value);
  };

  const showExactTime = () => {
    setExactTimeVisible(true);
  };

  const updateMinutes = (value: string) => {
    setMinutes(value.replace(/\D/g, "").slice(0, 3));
  };

  const updateSeconds = (value: string) => {
    setSeconds(value.replace(/\D/g, "").slice(0, 2));
  };

  const savePractice = () => {
    router.push(routes.arousalControlSaved);
  };

  return (
    <AppScreen contentStyle={styles.content}>
      <ArousalControlFlowHeader
        label="OPTIONAL DURATION"
        icon="◌"
        title="Log duration only if useful."
        subtitle="Duration is saved only as a personal trend. It is not rated as good or bad."
        onBackPress={() => router.replace(routes.arousalControlReflection)}
        onClosePress={() => router.replace(routes.exercises)}
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
                  accessibilityRole="button"
                  accessibilityState={{ selected: duration === option.value }}
                  onPress={() => selectDuration(option.value)}
                  style={({ pressed }) => [
                    styles.durationChip,
                    option.value === "preferNot" ? styles.fullWidthChip : undefined,
                    duration === option.value ? styles.durationChipSelected : undefined,
                    pressed ? styles.durationChipPressed : undefined
                  ]}
                >
                  <AppText variant="label" align="center">
                    {option.label}
                  </AppText>
                </Pressable>
              ))}
            </View>

            <AppButton variant="subtle" onPress={showExactTime}>
              Enter exact time
            </AppButton>
          </View>
        </AppCard>

        {exactTimeVisible ? (
          <AppCard style={styles.exactCard}>
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
                    value={minutes}
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
                    value={seconds}
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
          <AppButton onPress={savePractice}>Save Practice</AppButton>
          <AppButton variant="ghost" onPress={savePractice}>
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
