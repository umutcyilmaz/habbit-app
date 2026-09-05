import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { theme } from "../../../shared/design-system/theme";
import { usePersistenceNavigationGuard } from "../../../shared/navigation/usePersistenceNavigationGuard";
import type {
  ProtectionLevel,
  ProtectionStatus,
  ProtectionWindow
} from "../../../storage/bloomState";
import { ProtectionFlowHeader } from "../components/ProtectionFlowHeader";
import { ProtectionLevelCard } from "../components/ProtectionLevelCard";
import { ProtectionPersistenceFeedback } from "../components/ProtectionPersistenceFeedback";
import { ProtectionScheduleRow } from "../components/ProtectionScheduleRow";
import { ProtectionSetupSection } from "../components/ProtectionSetupSection";
import type {
  ProtectionLevelOption,
  ProtectionSchedule,
  ProtectionScheduleOption
} from "../types";
import { useProtectionPersistenceAction } from "../useProtectionPersistenceAction";

const protectionLevels: readonly ProtectionLevelOption[] = [
  {
    id: "gentle",
    title: "Gentle",
    description: "Save a brief in-app pause preference."
  },
  {
    id: "balanced",
    title: "Balanced",
    description: "Pair the in-app pause with a short reflection."
  },
  {
    id: "strong",
    title: "Strong",
    description: "Save a more direct reminder preference."
  }
] as const;

const scheduleOptions: readonly ProtectionScheduleOption[] = [
  {
    id: "night",
    title: "Night mode",
    description: "22:00–08:00"
  },
  {
    id: "custom",
    title: "Custom hours",
    description: "Save a custom-window preference. Exact times are coming soon."
  },
  {
    id: "alwaysOn",
    title: "Always on",
    description: "Keep the in-app pause plan easy to reach throughout the day."
  }
] as const;

export function ProtectionSetupScreen() {
  const router = useRouter();
  const { state, durableState, configureProtection } = useBloomLocalState();
  const protection = state.protection;
  const durableProtection = durableState.protection;
  const [selectedLevel, setSelectedLevel] = useState<ProtectionLevel>(
    protection.level ?? "balanced"
  );
  const [selectedSchedule, setSelectedSchedule] = useState<ProtectionSchedule>(
    getProtectionSchedule(protection.preferredWindow)
  );
  const [statusOverride, setStatusOverride] =
    useState<ProtectionStatus | null>(null);
  const {
    activeAction,
    isLocked,
    isNavigationLocked,
    message,
    pendingRetryAction,
    retry,
    runAction
  } = useProtectionPersistenceAction();
  const allowPersistenceNavigation =
    usePersistenceNavigationGuard(isNavigationLocked);
  const visibleStatus = statusOverride ?? durableProtection.status;

  const activateProtection = async () => {
    const previousStatus = durableProtection.status;
    setStatusOverride(previousStatus);

    await runAction(
      "configure",
      () =>
        configureProtection({
          preferredWindow: selectedSchedule,
          level: selectedLevel,
          adultContentPauseEnabled: true,
          nightStartTime:
            protection.nightStartTime ??
            (selectedSchedule === "night" ? "22:00" : null),
          nightEndTime:
            protection.nightEndTime ??
            (selectedSchedule === "night" ? "08:00" : null)
        }),
      {
        onSuccess: () => {
          setStatusOverride(null);
          allowPersistenceNavigation();
          router.replace(routes.home);
        },
        onFailure: () => setStatusOverride(null)
      }
    );
  };

  return (
    <AppScreen contentStyle={styles.focusedContent}>
      <ProtectionFlowHeader
        title="Protection Setup"
        subtitle="Choose the support that feels right for selected hours."
        onBackPress={() => router.replace(routes.protect)}
        disabled={isNavigationLocked}
      />

      <View style={styles.stack}>
        <ProtectionSetupSection
          title="Protection Level"
          body="Choose the reminder style Bloom should save for this pause plan."
        >
          <View style={styles.optionStack}>
            {protectionLevels.map((level) => (
              <ProtectionLevelCard
                key={level.id}
                id={level.id}
                title={level.title}
                description={level.description}
                selected={selectedLevel === level.id}
                disabled={isLocked}
                onSelect={setSelectedLevel}
              />
            ))}
          </View>
        </ProtectionSetupSection>

        <ProtectionSetupSection
          title="Schedule"
          body="Save when you would like this in-app pause plan to be easiest to reach."
        >
          <View style={styles.optionStack}>
            {scheduleOptions.map((schedule) => (
              <ProtectionScheduleRow
                key={schedule.id}
                id={schedule.id}
                title={schedule.title}
                description={schedule.description}
                iconLabel={schedule.id === "night" ? "N" : schedule.id === "custom" ? "C" : "A"}
                selected={selectedSchedule === schedule.id}
                disabled={isLocked}
                onSelect={setSelectedSchedule}
              />
            ))}
          </View>
        </ProtectionSetupSection>

        <ProtectionPersistenceFeedback
          message={message}
          canRetry={pendingRetryAction === "configure"}
          retrying={
            activeAction === "configure" && pendingRetryAction === "configure"
          }
          onRetry={() => void retry()}
        />

        <AppButton
          testID="bloom.protection.setup.complete"
          loading={activeAction === "configure" && pendingRetryAction === null}
          disabled={isLocked}
          accessibilityState={{
            busy: activeAction === "configure",
            disabled: isLocked
          }}
          onPress={() => void activateProtection()}
        >
          {visibleStatus === "off" ? "Save and activate" : "Save settings"}
        </AppButton>
      </View>
    </AppScreen>
  );
}

function getProtectionSchedule(
  window: ProtectionWindow | null
): ProtectionSchedule {
  if (window === null) {
    return "night";
  }

  return window === "night" || window === "alwaysOn" ? window : "custom";
}

const styles = StyleSheet.create({
  focusedContent: {
    maxWidth: 430
  },
  stack: {
    gap: theme.spacing.xl
  },
  optionStack: {
    gap: theme.spacing.md
  }
});
