import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useDemoAppStateValue } from "../../../app/providers/DemoAppStateProvider";
import { routes } from "../../../constants/navigation";
import type { DemoMode } from "../../../domain/demo/demoModes";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { DebugModeOption } from "../components/DebugModeOption";
import type { DebugModeOptionConfig } from "../types";

const modeLabels: Record<DemoMode, string> = {
  normal: "Normal demo",
  firstUse: "First use",
  lowData: "Low data",
  protectionActive: "Protection active",
  protectionPaused: "Protection paused",
  protectionOff: "Protection off",
  offlinePreview: "Offline preview"
};

const modeOptions: readonly DebugModeOptionConfig[] = [
  {
    mode: "normal",
    label: modeLabels.normal,
    description: "Week 1, day 3 with two check-ins, one pause, and an evening support window."
  },
  {
    mode: "firstUse",
    label: modeLabels.firstUse,
    description: "Week 1, day 1 with no check-ins, pauses, logs, or insights yet."
  },
  {
    mode: "lowData",
    label: modeLabels.lowData,
    description: "A sparse state with one check-in and no meaningful progress insights."
  },
  {
    mode: "protectionActive",
    label: modeLabels.protectionActive,
    description: "Support window saved and active for the evening."
  },
  {
    mode: "protectionPaused",
    label: modeLabels.protectionPaused,
    description: "Support is paused while the rest of the app keeps its normal activity."
  },
  {
    mode: "protectionOff",
    label: modeLabels.protectionOff,
    description: "Protection is turned off with activity still available elsewhere."
  },
  {
    mode: "offlinePreview",
    label: modeLabels.offlinePreview,
    description: "Normal activity with offline preview messaging enabled where supported."
  }
] as const;

export function DebugScreen() {
  const router = useRouter();
  const { state, demoMode, dispatch } = useDemoAppStateValue();
  const supportWindow = `${state.protection.sensitiveWindow.startTime}-${state.protection.sensitiveWindow.endTime}`;

  const summaryItems = [
    {
      label: "Current mode",
      value: modeLabels[demoMode]
    },
    {
      label: "Check-ins",
      value: String(state.checkIns.length)
    },
    {
      label: "Pauses",
      value: String(state.pauseSessions.length)
    },
    {
      label: "Protection status",
      value: state.protection.status
    },
    {
      label: "Support window",
      value: supportWindow
    },
    {
      label: "Offline preview",
      value: state.isOfflinePreview ? "Yes" : "No"
    }
  ] as const;

  const quickLinks = [
    {
      label: "Today",
      onPress: () => router.push(routes.home)
    },
    {
      label: "Log",
      onPress: () => router.push(routes.log)
    },
    {
      label: "Progress",
      onPress: () => router.push(routes.progress)
    },
    {
      label: "Protect",
      onPress: () => router.push(routes.protect)
    },
    {
      label: "Settings",
      onPress: () => router.push(routes.settings)
    }
  ] as const;

  return (
    <AppScreen>
      <AppHeader
        title="Debug Preview"
        subtitle="Switch demo states during development."
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        <View style={styles.sectionStack}>
          <AppText variant="title">Demo mode</AppText>
          {modeOptions.map((option) => (
            <DebugModeOption
              key={option.mode}
              {...option}
              currentMode={demoMode}
              onSelect={(mode) =>
                dispatch({
                  type: "SET_DEMO_MODE",
                  payload: mode
                })
              }
            />
          ))}
        </View>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Current state summary</AppText>
            <View style={styles.summaryStack}>
              {summaryItems.map((item) => (
                <View key={item.label} style={styles.summaryRow}>
                  <AppText variant="bodySmall" tone="secondary">
                    {item.label}
                  </AppText>
                  <AppText variant="bodySmall">{item.value}</AppText>
                </View>
              ))}
            </View>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Quick links</AppText>
            <View style={styles.actions}>
              {quickLinks.map((link) => (
                <AppButton key={link.label} variant="secondary" onPress={link.onPress}>
                  {link.label}
                </AppButton>
              ))}
            </View>
          </View>
        </AppCard>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.xl
  },
  sectionStack: {
    gap: theme.spacing.md
  },
  cardStack: {
    gap: theme.spacing.lg
  },
  summaryStack: {
    gap: theme.spacing.sm
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.lg
  },
  actions: {
    gap: theme.spacing.md
  }
});
