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
import type { DemoSupportLevel } from "../../../domain/demo/demoTypes";
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

export function ProtectScreen() {
  const router = useRouter();
  const state = useDemoAppState();
  const dispatch = useDemoAppDispatch();
  const protection = selectProtectionState(state);
  const window = selectSuggestedSensitiveWindow(state);

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
              {protection.status}
            </AppText>
            <AppText variant="title">{window.label}</AppText>
            <AppText tone="secondary">
              Recent activity suggests support between {window.startTime} and {window.endTime}.
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
                Save support window
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
