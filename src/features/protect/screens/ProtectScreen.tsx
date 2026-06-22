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
import type { DemoProtectionStatus } from "../../../domain/demo/demoTypes";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { ProtectionActionRow } from "../components/ProtectionActionRow";
import { ProtectionStatusHero } from "../components/ProtectionStatusHero";

function getStatusCopy(status: DemoProtectionStatus) {
  switch (status) {
    case "active":
      return {
        statusLabel: "Active",
        title: "Protection is active",
        body: "Active during selected hours.",
        primaryAction: "Manage protection"
      };
    case "paused":
      return {
        statusLabel: "Paused",
        title: "Support paused",
        body: "Protection is paused. You can turn it back on anytime.",
        primaryAction: "Turn support back on"
      };
    case "off":
    case "setup":
    case "suggested":
    default:
      return {
        statusLabel: "Off",
        title: "Protection is off",
        body: "Add gentle support during selected hours when you want it.",
        primaryAction: "Enable protection"
      };
  }
}

function formatLevel(level: string) {
  return `${level.charAt(0).toUpperCase()}${level.slice(1)}`;
}

export function ProtectScreen() {
  const router = useRouter();
  const state = useDemoAppState();
  const dispatch = useDemoAppDispatch();
  const protection = selectProtectionState(state);
  const window = selectSuggestedSensitiveWindow(state);
  const statusCopy = getStatusCopy(protection.status);
  const activeHours = `${window.startTime}–${window.endTime}`;
  const isActive = protection.status === "active";
  const isPaused = protection.status === "paused";
  const statusVariant =
    protection.status === "active" ? "active" : protection.status === "paused" ? "paused" : "off";

  return (
    <AppScreen>
      <AppHeader
        title="Protection"
        subtitle="Create space before automatic habits."
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        <ProtectionStatusHero
          statusLabel={statusCopy.statusLabel}
          title={statusCopy.title}
          body={statusCopy.body}
          variant={statusVariant}
        />

        <View style={styles.actions}>
          <AppButton
            onPress={() => {
              if (isPaused) {
                dispatch({
                  type: "SET_PROTECTION_STATUS",
                  payload: "active"
                });
                return;
              }

              router.push(routes.protectSetup);
            }}
          >
            {statusCopy.primaryAction}
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push(routes.protectIntercept)}>
            Start temporary support
          </AppButton>
          {isActive ? (
            <>
              <AppButton
                variant="ghost"
                onPress={() =>
                  dispatch({
                    type: "SET_PROTECTION_STATUS",
                    payload: "paused"
                  })
                }
              >
                Pause protection
              </AppButton>
              <AppButton variant="ghost" onPress={() => router.push(routes.protectSetup)}>
                Edit schedule
              </AppButton>
            </>
          ) : null}
        </View>

        <AppCard style={styles.settingsCard}>
          <View style={styles.cardStack}>
            <View style={styles.sectionCopy}>
              <AppText variant="title">Current settings</AppText>
              <AppText tone="secondary">
                You can change this anytime.
              </AppText>
            </View>
            <View style={styles.rowStack}>
              <ProtectionActionRow
                title="Active hours"
                description="Support hours"
                value={activeHours}
                iconLabel="◷"
                accent="lavender"
                onPress={() => router.push(routes.protectSetup)}
              />
              <ProtectionActionRow
                title="Protection level"
                description="How firmly support guides the pause"
                value={formatLevel(protection.level)}
                iconLabel="◇"
                accent="sage"
                onPress={() => router.push(routes.protectSetup)}
              />
              <ProtectionActionRow
                title="Night Protection"
                description="A softer bedtime support plan"
                value="Optional"
                iconLabel="☾"
                accent="peach"
                onPress={() => router.push(routes.protectNightSetup)}
              />
            </View>
          </View>
        </AppCard>

        <AppCard style={styles.noteCard}>
          <View style={styles.noteStack}>
            <AppText variant="title">You remain in control</AppText>
            <AppText tone="secondary">
              Protection creates a pause before continuing. It is optional, reversible, and yours
              to adjust.
            </AppText>
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
  actions: {
    gap: theme.spacing.md
  },
  settingsCard: {
    borderRadius: theme.radius.xxl,
    padding: 26
  },
  sectionCopy: {
    gap: theme.spacing.sm
  },
  rowStack: {
    gap: theme.spacing.md
  },
  noteStack: {
    gap: theme.spacing.sm
  },
  noteCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.lg
  }
});
