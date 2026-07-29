import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
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
import {
  pauseHelpfulActionLabels,
  pauseTriggerLabels
} from "../pausePresentation";
import type {
  PauseHelpfulActionId,
  PauseSessionPatch,
  PauseTriggerId
} from "../../../storage/bloomState";

const triggers: readonly PauseTriggerId[] = [
  "boredom",
  "stress",
  "loneliness",
  "nighttime",
  "socialMedia",
  "tiredness",
  "desire",
  "habit",
  "notSure"
] as const;

const helpfulActions: readonly {
  value: PauseHelpfulActionId;
  description: string;
}[] = [
  {
    value: "pause90",
    description: "Create a short space before continuing."
  },
  {
    value: "breathe3",
    description: "Stay with the breath a little longer."
  },
  {
    value: "logAndClose",
    description: "Record what is here and return to Today."
  },
  {
    value: "continueMindfully",
    description: "Move forward with more awareness."
  }
] as const;

export function PauseCheckInScreen() {
  const router = useRouter();
  const {
    state,
    startPauseSession,
    updatePauseSession,
    completePauseSession,
    discardPauseSession
  } = useBloomLocalState();
  const activeSession = state.pause.activeSession;
  const [urgeStrength, setUrgeStrength] = useState(
    activeSession?.intensityBefore ?? 7
  );
  const [selectedTriggers, setSelectedTriggers] = useState<PauseTriggerId[]>(
    activeSession?.triggers.length
      ? activeSession.triggers
      : ["nighttime"]
  );
  const [selectedAction, setSelectedAction] =
    useState<PauseHelpfulActionId>(
      activeSession?.selectedAction ?? "pause90"
    );

  const toggleTrigger = (trigger: PauseTriggerId) => {
    setSelectedTriggers((currentTriggers) =>
      currentTriggers.includes(trigger)
        ? currentTriggers.filter((currentTrigger) => currentTrigger !== trigger)
        : [...currentTriggers, trigger]
    );
  };

  const getSessionPatch = (phase: "checkIn" | "timer"): PauseSessionPatch => ({
    phase,
    intensityBefore: urgeStrength,
    triggers: selectedTriggers,
    selectedAction
  });

  const getOrCreateSessionId = (phase: "checkIn" | "timer") => {
    const sessionPatch = getSessionPatch(phase);

    if (activeSession !== null) {
      updatePauseSession(activeSession.id, sessionPatch);
      return activeSession.id;
    }

    return startPauseSession(sessionPatch);
  };

  const startTimer = () => {
    getOrCreateSessionId("timer");
    router.push(routes.pauseTimer);
  };

  const saveAndClose = () => {
    const sessionId = getOrCreateSessionId("checkIn");
    completePauseSession(sessionId, { durationSeconds: 0 });
    router.replace(routes.pauseSaved);
  };

  const closePause = () => {
    if (activeSession !== null) {
      discardPauseSession(activeSession.id);
    }

    router.replace(routes.home);
  };

  return (
    <AppScreen>
      <PauseFlowHeader
        title="How strong is the urge right now?"
        subtitle="Take a moment to reflect on what is present."
        onBackPress={() => router.back()}
        onClosePress={closePause}
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
              getLabel={(trigger) => pauseTriggerLabels[trigger]}
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
                  title={pauseHelpfulActionLabels[action.value]}
                  description={action.description}
                  selected={selectedAction === action.value}
                  onSelect={setSelectedAction}
                />
              ))}
            </View>
            <View style={styles.actions}>
              <AppButton onPress={startTimer}>
                Start 90-Second Pause
              </AppButton>
              <AppButton variant="ghost" onPress={saveAndClose}>
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
