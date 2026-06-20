import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { NextStepOptionCard } from "../components/NextStepOptionCard";
import { PauseFlowHeader } from "../components/PauseFlowHeader";
import { TriggerChipGroup } from "../components/TriggerChipGroup";
import { UrgeStrengthControl } from "../components/UrgeStrengthControl";

const triggers = [
  "Boredom",
  "Stress",
  "Loneliness",
  "Nighttime",
  "Social media",
  "Tiredness",
  "Desire",
  "Habit",
  "Not sure"
] as const;

const helpfulActions = [
  {
    value: "Pause for 90 seconds",
    description: "Create a short space before continuing."
  },
  {
    value: "Breathe for 3 minutes",
    description: "Stay with the breath a little longer."
  },
  {
    value: "Log and close",
    description: "Record what is here and return to Today."
  },
  {
    value: "Continue mindfully",
    description: "Move forward with more awareness."
  }
] as const;

type Trigger = (typeof triggers)[number];
type HelpfulAction = (typeof helpfulActions)[number]["value"];

export function PauseCheckInScreen() {
  const router = useRouter();
  const [urgeStrength, setUrgeStrength] = useState(7);
  const [selectedTriggers, setSelectedTriggers] = useState<Trigger[]>(["Nighttime"]);
  const [selectedAction, setSelectedAction] = useState<HelpfulAction>("Pause for 90 seconds");

  const toggleTrigger = (trigger: Trigger) => {
    setSelectedTriggers((currentTriggers) =>
      currentTriggers.includes(trigger)
        ? currentTriggers.filter((currentTrigger) => currentTrigger !== trigger)
        : [...currentTriggers, trigger]
    );
  };

  return (
    <AppScreen>
      <PauseFlowHeader
        title="How strong is the urge right now?"
        subtitle="Take a moment to reflect on what is present."
        onBackPress={() => router.back()}
        onClosePress={() => router.replace(routes.home)}
      />

      <View style={styles.stack}>
        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Urge strength now</AppText>
            <UrgeStrengthControl value={urgeStrength} onChange={setUrgeStrength} />
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">What might have triggered it?</AppText>
            <TriggerChipGroup
              values={triggers}
              selectedValues={selectedTriggers}
              onToggle={toggleTrigger}
            />
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">What feels most helpful right now?</AppText>
            <View style={styles.optionStack}>
              {helpfulActions.map((action) => (
                <NextStepOptionCard
                  key={action.value}
                  value={action.value}
                  title={action.value}
                  description={action.description}
                  selected={selectedAction === action.value}
                  onSelect={setSelectedAction}
                />
              ))}
            </View>
            <View style={styles.actions}>
              <AppButton onPress={() => router.push(routes.pauseTimer)}>
                Start 90-Second Pause
              </AppButton>
              <AppButton variant="ghost" onPress={() => router.replace(routes.pauseSaved)}>
                Save and close
              </AppButton>
            </View>
          </View>
        </AppCard>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  },
  cardStack: {
    gap: theme.spacing.lg
  },
  optionStack: {
    gap: theme.spacing.sm
  },
  actions: {
    gap: theme.spacing.sm
  }
});
