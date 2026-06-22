import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { ProtectionActionRow } from "../components/ProtectionActionRow";
import { ProtectionFlowHeader } from "../components/ProtectionFlowHeader";
import { ProtectionReassuranceCard } from "../components/ProtectionReassuranceCard";
import { ProtectionVisual } from "../components/ProtectionVisual";

export function ProtectionInterceptScreen() {
  const router = useRouter();

  return (
    <AppScreen contentStyle={styles.focusedContent}>
      <ProtectionFlowHeader
        title="Pause before you continue"
        subtitle="This may be a sensitive moment. Take a moment to choose what helps."
        onBackPress={() => router.replace(routes.protect)}
        onClosePress={() => router.replace(routes.home)}
      />

      <View style={styles.stack}>
        <AppCard style={styles.visualCard}>
          <View style={styles.cardStack}>
            <ProtectionVisual label="Pause" symbol="II" />
            <AppText tone="secondary" align="center">
              You remain in control. Choose the next helpful step.
            </AppText>
          </View>
        </AppCard>

        <View style={styles.actionStack}>
          <ProtectionActionRow
            title="Start 90-sec pause"
            description="Breathe, reset, and ride the urge."
            iconLabel="90"
            accent="sage"
            onPress={() => router.push(routes.pause)}
          />
          <ProtectionActionRow
            title="Put phone away"
            description="Step back and breathe."
            iconLabel="P"
            accent="lavender"
            onPress={() => router.replace(routes.home)}
          />
          <ProtectionActionRow
            title="Message support"
            description="Talk with someone who gets it."
            iconLabel="M"
            accent="lavender"
            onPress={() => router.replace(routes.home)}
          />
          <ProtectionActionRow
            title="Continue anyway"
            description="You remain in control."
            iconLabel="C"
            accent="peach"
            onPress={() => router.replace(routes.home)}
          />
        </View>

        <ProtectionReassuranceCard body="You’re not alone. This moment can pass." />
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
  cardStack: {
    alignItems: "center",
    gap: theme.spacing.lg
  },
  actionStack: {
    gap: theme.spacing.md
  },
  visualCard: {
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.sage,
    borderRadius: theme.radius.xxl,
    padding: 26
  }
});
