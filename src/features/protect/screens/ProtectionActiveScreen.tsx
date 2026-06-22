import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useDemoAppDispatch } from "../../../app/providers/DemoAppStateProvider";
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

  const pauseProtection = () => {
    dispatch({
      type: "SET_PROTECTION_STATUS",
      payload: "paused"
    });
    router.replace(routes.protect);
  };

  return (
    <AppScreen contentStyle={styles.focusedContent}>
      <ProtectionFlowHeader
        title="Protection is active"
        subtitle="Your support plan is running quietly during selected hours."
        onBackPress={() => router.replace(routes.protect)}
      />

      <View style={styles.stack}>
        <View style={styles.heroPanel}>
          <ProtectionVisual label="Active" symbol="◇" size="large" />
          <View style={styles.heroCopy}>
            <AppText variant="title" align="center">
              Gentle support is on
            </AppText>
            <AppText tone="secondary" align="center">
              You can pause or adjust this support anytime.
            </AppText>
          </View>
        </View>

        <View style={styles.actionStack}>
          <ProtectionActionRow
            title="Pause protection"
            description="Take a break from the current support plan."
            iconLabel="Ⅱ"
            accent="peach"
            onPress={pauseProtection}
          />
          <ProtectionActionRow
            title="Edit schedule"
            description="Adjust selected hours and support level."
            iconLabel="◷"
            accent="lavender"
            onPress={() => router.push(routes.protectSetup)}
          />
        </View>

        <ProtectionRoutineCard
          title="Automated routine"
          body="Protection is scheduled to remain active until your quiet hours end."
        />

        <AppButton onPress={() => router.replace(routes.protect)}>Back to Protect</AppButton>
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
