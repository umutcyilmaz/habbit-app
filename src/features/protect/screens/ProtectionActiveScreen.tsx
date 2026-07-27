import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

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
  const {
    state,
    pauseProtection,
    resumeProtection,
    turnOffProtection
  } = useBloomLocalState();
  const protection = state.protection;

  if (protection.status === "off") {
    const hasSavedConfiguration = protection.setupCompletedAt !== null;

    return (
      <AppScreen contentStyle={styles.focusedContent}>
        <ProtectionFlowHeader
          title={
            hasSavedConfiguration
              ? "Protection is off"
              : "Protection is not set up yet"
          }
          subtitle={
            hasSavedConfiguration
              ? "Your saved in-app pause preferences are still available."
              : "Set up an optional pause plan for sensitive moments."
          }
          onBackPress={() => router.replace(routes.protect)}
        />

        <View style={styles.stack}>
          <View style={styles.heroPanel}>
            <ProtectionVisual label="Setup" symbol="P" size="large" />
            <View style={styles.heroCopy}>
              <AppText variant="title" align="center">
                {hasSavedConfiguration
                  ? "Review your saved settings"
                  : "Set up Protection first"}
              </AppText>
              <AppText tone="secondary" align="center">
                {hasSavedConfiguration
                  ? "Saving again will make the pause plan ready inside Bloom."
                  : "Bloom can remember your local pause-plan settings after setup."}
              </AppText>
            </View>
          </View>

          <AppButton onPress={() => router.replace(routes.protectSetup)}>
            {hasSavedConfiguration ? "Review settings" : "Set up Protection"}
          </AppButton>
        </View>
      </AppScreen>
    );
  }

  if (protection.status === "paused") {
    return (
      <AppScreen contentStyle={styles.focusedContent}>
        <ProtectionFlowHeader
          title="Protection is paused"
          subtitle="Your in-app pause plan and preferences are still saved."
          onBackPress={() => router.replace(routes.protect)}
        />

        <View style={styles.stack}>
          <View style={styles.heroPanel}>
            <ProtectionVisual label="Paused" symbol="P" size="large" />
            <View style={styles.heroCopy}>
              <AppText variant="title" align="center">
                Resume when it feels useful
              </AppText>
              <AppText tone="secondary" align="center">
                Resuming makes your saved pause plan ready inside Bloom again.
              </AppText>
            </View>
          </View>

          <View style={styles.actionStack}>
            <ProtectionActionRow
              title="Resume Protection"
              description="Make the saved in-app pause plan ready again."
              iconLabel="R"
              accent="sage"
              onPress={resumeProtection}
            />
            <ProtectionActionRow
              title="Edit settings"
              description="Adjust the saved window and reminder style."
              iconLabel="E"
              accent="lavender"
              onPress={() => router.push(routes.protectSetup)}
            />
            <ProtectionActionRow
              title="Turn off Protection"
              description="Keep the configuration but mark Protection as off."
              iconLabel="O"
              accent="peach"
              onPress={() => {
                turnOffProtection();
                router.replace(routes.protect);
              }}
            />
          </View>

          <AppButton onPress={() => router.replace(routes.protect)}>
            Back to Protect
          </AppButton>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen contentStyle={styles.focusedContent}>
      <ProtectionFlowHeader
        title="Protection is ready"
        subtitle="Your saved in-app pause plan is available when you choose it."
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
              Bloom’s in-app pause is saved for your{" "}
              {formatProtectionWindow(protection.preferredWindow).toLowerCase()}.
            </AppText>
          </View>
        </View>

        <View style={styles.actionStack}>
          <ProtectionActionRow
            title="Pause protection"
            description="Take a break from the current support plan."
            iconLabel="P"
            accent="peach"
            onPress={() => {
              pauseProtection();
              router.replace(routes.protect);
            }}
          />
          <ProtectionActionRow
            title="Edit schedule"
            description="Adjust the saved window and reminder style."
            iconLabel="E"
            accent="lavender"
            onPress={() => router.push(routes.protectSetup)}
          />
          <ProtectionActionRow
            title="Turn off Protection"
            description="Keep the configuration but mark Protection as off."
            iconLabel="O"
            accent="peach"
            onPress={() => {
              turnOffProtection();
              router.replace(routes.protect);
            }}
          />
        </View>

        <ProtectionRoutineCard
          title={formatProtectionWindow(protection.preferredWindow)}
          body="Bloom keeps this pause plan inside the app. It is optional, reversible, and available when you choose it."
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
    case "alwaysOn":
      return "Any-time preference";
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
