import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import {
  useDemoAppDispatch,
  useDemoAppState
} from "../../../app/providers/DemoAppStateProvider";
import { routes } from "../../../constants/navigation";
import type { DemoSupportLevel } from "../../../domain/demo/demoTypes";
import { AppButton } from "../../../shared/components/AppButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { theme } from "../../../shared/design-system/theme";
import { ProtectionFlowHeader } from "../components/ProtectionFlowHeader";
import { ProtectionLevelCard } from "../components/ProtectionLevelCard";
import { ProtectionScheduleRow } from "../components/ProtectionScheduleRow";
import { ProtectionSetupSection } from "../components/ProtectionSetupSection";
import type {
  ProtectionLevelOption,
  ProtectionSchedule,
  ProtectionScheduleOption
} from "../types";

const protectionLevels: readonly ProtectionLevelOption[] = [
  {
    id: "gentle",
    title: "Gentle",
    description: "Adds a short pause before access."
  },
  {
    id: "balanced",
    title: "Balanced",
    description: "Encourages pause + reflection."
  },
  {
    id: "strong",
    title: "Strong",
    description: "Adds a longer delay and extra confirmation."
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
    description: "Choose selected hours later."
  },
  {
    id: "alwaysOn",
    title: "Always on",
    description: "Keep gentle support available throughout the day."
  }
] as const;

export function ProtectionSetupScreen() {
  const router = useRouter();
  const state = useDemoAppState();
  const dispatch = useDemoAppDispatch();
  const [selectedLevel, setSelectedLevel] = useState<DemoSupportLevel>(state.protection.level);
  const [selectedSchedule, setSelectedSchedule] = useState<ProtectionSchedule>("night");

  const activateProtection = () => {
    dispatch({
      type: "SET_PROTECTION_LEVEL",
      payload: selectedLevel
    });
    dispatch({
      type: "SET_PROTECTION_STATUS",
      payload: "active"
    });
    router.replace(routes.protectActive);
  };

  return (
    <AppScreen contentStyle={styles.focusedContent}>
      <ProtectionFlowHeader
        title="Protection Setup"
        subtitle="Choose the support that feels right for selected hours."
        onBackPress={() => router.replace(routes.protect)}
      />

      <View style={styles.stack}>
        <ProtectionSetupSection
          title="Protection Level"
          body="Choose how firmly you want to be guided away from automatic loops."
        >
          <View style={styles.optionStack}>
            {protectionLevels.map((level) => (
              <ProtectionLevelCard
                key={level.id}
                id={level.id}
                title={level.title}
                description={level.description}
                selected={selectedLevel === level.id}
                onSelect={setSelectedLevel}
              />
            ))}
          </View>
        </ProtectionSetupSection>

        <ProtectionSetupSection
          title="Schedule"
          body="Set when these support layers are active."
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
                onSelect={setSelectedSchedule}
              />
            ))}
          </View>
        </ProtectionSetupSection>

        <AppButton onPress={activateProtection}>Activate</AppButton>
      </View>
    </AppScreen>
  );
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
