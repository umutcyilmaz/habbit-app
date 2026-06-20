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
import type { DemoProtectionStatus, DemoSupportLevel } from "../../../domain/demo/demoTypes";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

const supportLevels: ReadonlyArray<{
  id: DemoSupportLevel;
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

function getProtectionStatusCopy(status: DemoProtectionStatus) {
  switch (status) {
    case "active":
      return {
        caption: "Active",
        title: "Evening support is active",
        body: "Support is ready around your sensitive window while you remain in control.",
        primaryAction: "Save support window"
      };
    case "paused":
      return {
        caption: "Paused",
        title: "Support is paused for now",
        body: "You can resume the evening window whenever it feels useful.",
        primaryAction: "Resume support window"
      };
    case "off":
      return {
        caption: "Off",
        title: "Protection is off",
        body: "The suggested evening window is still available if you want support later.",
        primaryAction: "Turn support on"
      };
    case "setup":
      return {
        caption: "Setup",
        title: "Review your support window",
        body: "Recent activity suggests support may help during this part of the evening.",
        primaryAction: "Save support window"
      };
    case "suggested":
    default:
      return {
        caption: "Suggested",
        title: "Evening support",
        body: "Recent activity suggests support may help during this part of the evening.",
        primaryAction: "Save support window"
      };
  }
}

export function ProtectScreen() {
  const router = useRouter();
  const state = useDemoAppState();
  const dispatch = useDemoAppDispatch();
  const protection = selectProtectionState(state);
  const window = selectSuggestedSensitiveWindow(state);
  const statusCopy = getProtectionStatusCopy(protection.status);

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
              {statusCopy.caption}
            </AppText>
            <AppText variant="title">{statusCopy.title}</AppText>
            <AppText tone="secondary">
              {statusCopy.body} Suggested time: {window.startTime} to {window.endTime}.
            </AppText>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Support level</AppText>
            <View style={styles.optionGrid}>
              {supportLevels.map((level) => (
                <AppButton
                  key={level.id}
                  variant={protection.level === level.id ? "primary" : "subtle"}
                  style={styles.optionButton}
                  onPress={() =>
                    dispatch({
                      type: "SET_PROTECTION_LEVEL",
                      payload: level.id
                    })
                  }
                >
                  {level.label}
                </AppButton>
              ))}
            </View>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Actions</AppText>
            <AppText tone="secondary">
              These controls are here to help you adjust support when needed.
            </AppText>
            <View style={styles.actions}>
              <AppButton
                onPress={() =>
                  dispatch({
                    type: "SET_PROTECTION_STATUS",
                    payload: "active"
                  })
                }
              >
                {statusCopy.primaryAction}
              </AppButton>
              <AppButton variant="secondary" onPress={() => router.push(routes.pause)}>
                Start 90-Second Pause
              </AppButton>
              <AppButton variant="secondary" onPress={() => router.push(routes.log)}>
                Quick Check-In
              </AppButton>
              <AppButton
                variant="ghost"
                onPress={() =>
                  dispatch({
                    type: "SET_PROTECTION_STATUS",
                    payload: "paused"
                  })
                }
              >
                Pause for tonight
              </AppButton>
              <AppButton variant="ghost" onPress={() => router.push(routes.home)}>
                Back to Today
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
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  optionButton: {
    minWidth: 104,
    flexGrow: 1
  },
  actions: {
    gap: theme.spacing.md
  },
  windowCard: {
    backgroundColor: theme.colors.peachMuted,
    borderColor: theme.colors.peach
  }
});
