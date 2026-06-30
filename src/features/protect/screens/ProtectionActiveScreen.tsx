import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useDemoAppDispatch } from "../../../app/providers/DemoAppStateProvider";
import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { ProtectionActionRow } from "../components/ProtectionActionRow";
import { ProtectionFlowHeader } from "../components/ProtectionFlowHeader";
import { ProtectionRoutineCard } from "../components/ProtectionRoutineCard";
import { ProtectionVisual } from "../components/ProtectionVisual";

export function ProtectionActiveScreen() {
  const router = useRouter();
  const dispatch = useDemoAppDispatch();
  const { state, disableProtection } = useBloomLocalState();
  const protection = state.protection;

  const pauseProtection = () => {
    disableProtection();
    dispatch({
      type: "SET_PROTECTION_STATUS",
      payload: "paused"
    });
    router.replace(routes.protect);
  };

  if (!protection.isEnabled) {
    return (
      <AppScreen contentStyle={styles.focusedContent}>
        <ProtectionFlowHeader
          title="Protection is not set up yet"
          subtitle="Set up a pause layer before automatic moments."
          onBackPress={() => router.replace(routes.protect)}
        />

        <View style={styles.stack}>
          <View style={styles.heroPanel}>
            <ProtectionVisual label="Setup" symbol="P" size="large" />
            <View style={styles.heroCopy}>
              <AppText variant="title" align="center">
                Set up Protection first
              </AppText>
              <AppText tone="secondary" align="center">
                Bloom can remember your local support settings after setup.
              </AppText>
            </View>
          </View>

          <AppButton onPress={() => router.replace(routes.protectSetup)}>
            Set up Protection
          </AppButton>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen contentStyle={styles.focusedContent}>
      <ProtectionFlowHeader
        title="Protection is active"
        subtitle="Your support plan is running quietly during selected hours."
        onBackPress={() => router.replace(routes.protect)}
      />

      <View style={styles.stack}>
        <View style={styles.heroPanel}>
          <ProtectionVisual label="Active" symbol="P" size="large" />
          <View style={styles.heroCopy}>
            <AppText variant="title" align="center">
              Protection is ready
            </AppText>
            <AppText tone="secondary" align="center">
              Adult-content pause is on during your {formatProtectionWindow(protection.preferredWindow).toLowerCase()}.
            </AppText>
          </View>
        </View>

        <View style={styles.actionStack}>
          <ProtectionActionRow
            title="Pause protection"
            description="Take a break from the current support plan."
            iconLabel="P"
            accent="peach"
            onPress={pauseProtection}
          />
          <ProtectionActionRow
            title="Edit schedule"
            description="Adjust selected hours and support level."
            iconLabel="E"
            accent="lavender"
            onPress={() => router.push(routes.protectSetup)}
          />
        </View>

        <ProtectionRoutineCard
          title={formatProtectionWindow(protection.preferredWindow)}
          body="Bloom will help create a pause before automatic moments. This support is optional and reversible."
        />

        <AppButton onPress={() => router.replace(routes.protect)}>Back to Protect</AppButton>
      </View>
    </AppScreen>
  );
}

function formatProtectionWindow(window: string | null) {
  switch (window) {
    case "night":
      return "Night window";
    case "custom":
      return "Custom window";
    case "evening":
      return "Evening window";
    default:
      return "Selected hours";
  }
}

const styles = StyleSheet.create({
  focusedContent: {
    maxWidth: 430
  },
  stack: {
    gap: theme.spacing.xl
  },
  heroPanel: {
    alignItems: "center",
    gap: theme.spacing.xl,
    paddingVertical: theme.spacing.lg
  },
  heroCopy: {
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg
  },
  actionStack: {
    gap: theme.spacing.md
  }
});
