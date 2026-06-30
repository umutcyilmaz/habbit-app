import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import {
  useDemoAppDispatch,
  useDemoAppState
} from "../../../app/providers/DemoAppStateProvider";
import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { selectSuggestedSensitiveWindow } from "../../../domain/demo/demoSelectors";
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
        primaryAction: "Manage protection"
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

function formatProtectionWindow(window: string | null) {
  switch (window) {
    case "night":
      return "Night";
    case "custom":
      return "Custom";
    case "evening":
      return "Evening";
    default:
      return "Not set";
  }
}

export function ProtectScreen() {
  const router = useRouter();
  const demoState = useDemoAppState();
  const dispatch = useDemoAppDispatch();
  const { state, disableProtection } = useBloomLocalState();
  const window = selectSuggestedSensitiveWindow(demoState);
  const protection = state.protection;
  const persistedStatus = protection.isEnabled ? "active" : "off";
  const statusCopy = protection.isEnabled
    ? {
        statusLabel: "Ready",
        title: "Protection is ready.",
        body: "Bloom will help create a pause before automatic moments.",
        primaryAction: "View active protection"
      }
    : getStatusCopy(persistedStatus);
  const activeHours =
    protection.preferredWindow === "night"
      ? "22:00-08:00"
      : `${window.startTime}-${window.endTime}`;
  const statusVariant = protection.isEnabled ? "active" : "off";

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
            onPress={() =>
              router.push(protection.isEnabled ? routes.protectActive : routes.protectSetup)
            }
          >
            {statusCopy.primaryAction}
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push(routes.protectIntercept)}>
            Start temporary support
          </AppButton>
          {protection.isEnabled ? (
            <>
              <AppButton
                variant="ghost"
                onPress={() => {
                  disableProtection();
                  dispatch({
                    type: "SET_PROTECTION_STATUS",
                    payload: "paused"
                  });
                }}
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
                iconLabel="H"
                accent="lavender"
                onPress={() => router.push(routes.protectSetup)}
              />
              <ProtectionActionRow
                title="Adult-content pause"
                description="Pause layer before automatic moments"
                value={protection.adultContentPauseEnabled ? "On" : "Off"}
                iconLabel="B"
                accent="sage"
                onPress={() => router.push(routes.protectSetup)}
              />
              <ProtectionActionRow
                title="Window"
                description="Preferred support window"
                value={formatProtectionWindow(protection.preferredWindow)}
                iconLabel="N"
                accent="peach"
                onPress={() => router.push(routes.protectNightSetup)}
              />
            </View>
          </View>
        </AppCard>

        <AppCard style={styles.noteCard}>
          <View style={styles.cardStack}>
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
  noteCard: {
    backgroundColor: theme.colors.peachMuted,
    borderColor: theme.colors.peach,
    borderRadius: theme.radius.xxl,
    padding: 26
  }
});
