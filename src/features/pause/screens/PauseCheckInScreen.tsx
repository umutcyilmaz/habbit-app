import { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import {
  useBloomLocalState,
  type BloomPersistedMutationResult,
  type BloomPersistenceRetryToken
} from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { usePersistenceNavigationGuard } from "../../../shared/navigation/usePersistenceNavigationGuard";
import { NextStepOptionCard } from "../components/NextStepOptionCard";
import { PauseFlowHeader } from "../components/PauseFlowHeader";
import { TriggerChipGroup } from "../components/TriggerChipGroup";
import { UrgeStrengthControl } from "../components/UrgeStrengthControl";
import {
  pauseHelpfulActionLabels,
  pauseTriggerLabels
} from "../pausePresentation";
import { getPausePersistenceErrorMessage } from "../pausePersistenceFeedback";
import { createPauseSavedCompletionHref } from "../pauseSavedRoute";
import {
  createBloomRecordId,
  type PauseHelpfulActionId,
  type PauseSessionPatch,
  type PauseTriggerId
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
    saveAndClosePauseSession,
    retryPersistedMutation,
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
  const completionAttemptRef = useRef(false);
  const completionRecordIdRef = useRef<string | null>(null);
  const completionPromiseRef =
    useRef<Promise<BloomPersistedMutationResult> | null>(null);
  const isMountedRef = useRef(true);
  const [isSaving, setIsSaving] = useState(false);
  const [completionAccepted, setCompletionAccepted] = useState(false);
  const [retryToken, setRetryToken] =
    useState<BloomPersistenceRetryToken | null>(null);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);
  const persistenceNavigationBlocked = isSaving;
  const allowPersistenceNavigation = usePersistenceNavigationGuard(
    persistenceNavigationBlocked
  );

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
    if (completionPromiseRef.current !== null || completionAttemptRef.current) {
      return;
    }

    getOrCreateSessionId("timer");
    router.push(routes.pauseTimer);
  };

  const saveAndClose = async () => {
    if (completionPromiseRef.current !== null) {
      return;
    }

    let persistencePromise: Promise<BloomPersistedMutationResult>;

    if (retryToken !== null) {
      persistencePromise = retryPersistedMutation(retryToken);
    } else {
      if (completionAttemptRef.current) {
        return;
      }

      completionAttemptRef.current = true;
      const recordId =
        activeSession?.id ?? createBloomRecordId("pause");
      completionRecordIdRef.current = recordId;
      persistencePromise = saveAndClosePauseSession(
        recordId,
        getSessionPatch("checkIn"),
        { durationSeconds: 0 }
      );
    }

    completionPromiseRef.current = persistencePromise;
    setIsSaving(true);
    setPersistenceError(null);

    try {
      const result = await persistencePromise;

      if (!isMountedRef.current) {
        return;
      }

      if (result.ok) {
        const recordId = completionRecordIdRef.current;

        if (recordId === null) {
          setPersistenceError(
            "Bloom saved this Pause, but couldn’t identify its saved record. You can leave safely."
          );
          return;
        }

        setRetryToken(null);
        allowPersistenceNavigation();
        router.replace(createPauseSavedCompletionHref(recordId));
        return;
      }

      if (result.accepted) {
        setCompletionAccepted(true);
        setRetryToken(result.retryable ? result.retryToken : null);
      } else {
        completionAttemptRef.current = false;
        completionRecordIdRef.current = null;
        setCompletionAccepted(false);
        setRetryToken(null);
      }

      setPersistenceError(getPausePersistenceErrorMessage(result));
    } finally {
      if (completionPromiseRef.current === persistencePromise) {
        completionPromiseRef.current = null;

        if (isMountedRef.current) {
          setIsSaving(false);
        }
      }
    }
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
        disabled={isSaving}
        onBackPress={() => router.back()}
        onClosePress={closePause}
      />

      <View style={styles.stack}>
        <AppCard testID="bloom.pause.check-in">
          <View style={styles.cardStack}>
            <AppText variant="title">Urge strength now</AppText>
            <UrgeStrengthControl
              value={urgeStrength}
              disabled={isSaving || completionAccepted}
              onChange={setUrgeStrength}
              testIDPrefix="bloom.pause.intensity"
            />
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">What might have triggered it?</AppText>
            <TriggerChipGroup
              values={triggers}
              selectedValues={selectedTriggers}
              disabled={isSaving || completionAccepted}
              onToggle={toggleTrigger}
              getLabel={(trigger) => pauseTriggerLabels[trigger]}
              testIDPrefix="bloom.pause.trigger"
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
                  disabled={isSaving || completionAccepted}
                  onSelect={setSelectedAction}
                  testIDPrefix="bloom.pause.action"
                />
              ))}
            </View>
            {persistenceError !== null ? (
              <AppText
                accessibilityLiveRegion="polite"
                accessibilityRole="alert"
                variant="bodySmall"
                tone="danger"
              >
                {persistenceError}
              </AppText>
            ) : null}
            <View style={styles.actions}>
              <AppButton
                testID="bloom.pause.check-in.continue"
                disabled={isSaving || completionAccepted}
                onPress={startTimer}
              >
                Start 90-Second Pause
              </AppButton>
              <AppButton
                variant="ghost"
                disabled={completionAccepted && retryToken === null}
                loading={isSaving}
                onPress={saveAndClose}
              >
                {retryToken !== null ? "Try saving again" : "Save and close"}
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
