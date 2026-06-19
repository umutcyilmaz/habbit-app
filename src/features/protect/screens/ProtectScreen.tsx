import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import {
  useDemoAppDispatch,
  useDemoAppState
} from "../../../app/providers/DemoAppStateProvider";
import { routes } from "../../../constants/navigation";
import {
  selectProtectionState,
  selectSuggestedSensitiveWindow
} from "../../../domain/demo/demoSelectors";
import type { DemoProtectionLevel, DemoProtectionStatus } from "../../../domain/demo/demoTypes";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

const levelOptions: ReadonlyArray<{
  id: DemoProtectionLevel;
  label: string;
}> = [
  {
    id: "gentle",
    label: "Gentle"
  },
  {
    id: "balanced",
    label: "Balanced"
  },
  {
    id: "strong",
    label: "Strong"
  }
];

const statusLabels: Record<DemoProtectionStatus, string> = {
  suggested: "Suggested",
  setup: "Setup",
  active: "Active",
  paused: "Paused",
  off: "Off"
};

export function ProtectScreen() {
  const router = useRouter();
  const state = useDemoAppState();
  const dispatch = useDemoAppDispatch();
  const protection = selectProtectionState(state);
  const sensitiveWindow = selectSuggestedSensitiveWindow(state);

  return (
    <AppScreen>
      <AppHeader
        title="Protect"
        subtitle="Optional support around sensitive windows while you remain in control."
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        <AppCard style={styles.windowCard}>
          <View style={styles.cardStack}>
            <AppText variant="caption" tone="secondary">
              {statusLabels[protection.status]}
            </AppText>
            <AppText variant="title">{sensitiveWindow.label}</AppText>
            <AppText tone="secondary">
              Demo activity suggests support between {sensitiveWindow.startTime} and{" "}
              {sensitiveWindow.endTime}.
            </AppText>
            <AppText variant="bodySmall" tone="secondary">
              Current support level: {protection.level}
            </AppText>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Support level</AppText>
            <View style={styles.optionGroup}>
              {levelOptions.map((option) => (
                <AppButton
                  key={option.id}
                  variant={protection.level === option.id ? "primary" : "secondary"}
                  onPress={() =>
                    dispatch({
                      type: "SET_PROTECTION_LEVEL",
                      payload: option.id
                    })
                  }
                >
                  {option.label}
                </AppButton>
              ))}
            </View>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Demo controls</AppText>
            <AppText tone="secondary">
              These buttons update shared demo state only. No app blocking or notification
              scheduling is connected yet.
            </AppText>
            <View style={styles.optionGroup}>
              <AppButton
                onPress={() =>
                  dispatch({
                    type: "SET_PROTECTION_STATUS",
                    payload: "active"
                  })
                }
              >
                Save support window
              </AppButton>
              <AppButton
                variant="secondary"
                onPress={() =>
                  dispatch({
                    type: "SET_PROTECTION_STATUS",
                    payload: "paused"
                  })
                }
              >
                Pause for tonight
              </AppButton>
              <AppButton
                variant="ghost"
                onPress={() =>
                  dispatch({
                    type: "SET_PROTECTION_STATUS",
                    payload: "off"
                  })
                }
              >
                Turn off
              </AppButton>
            </View>
          </View>
        </AppCard>

        {protection.status === "active" ? (
          <AppCard style={styles.previewCard}>
            <View style={styles.cardStack}>
              <AppText variant="title">During this window</AppText>
              <AppText tone="secondary">
                A pause can help create space before the next choice.
              </AppText>
              <AppButton variant="secondary" onPress={() => router.push(routes.pause)}>
                Start pause
              </AppButton>
            </View>
          </AppCard>
        ) : null}
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
  optionGroup: {
    gap: theme.spacing.sm
  },
  windowCard: {
    backgroundColor: theme.colors.peachMuted,
    borderColor: theme.colors.peach
  },
  previewCard: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  }
});
