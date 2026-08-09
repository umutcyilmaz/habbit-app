import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { usePersistenceNavigationGuard } from "../../../shared/navigation/usePersistenceNavigationGuard";
import type { ProtectionStatus } from "../../../storage/bloomState";
import { ProtectionActionRow } from "../components/ProtectionActionRow";
import { ProtectionFlowHeader } from "../components/ProtectionFlowHeader";
import { ProtectionPersistenceFeedback } from "../components/ProtectionPersistenceFeedback";
import { ProtectionRoutineCard } from "../components/ProtectionRoutineCard";
import { ProtectionVisual } from "../components/ProtectionVisual";
import { useProtectionPersistenceAction } from "../useProtectionPersistenceAction";

export function ProtectionActiveScreen() {
  const router = useRouter();
  const {
    durableState,
    pauseProtection,
    resumeProtection,
    turnOffProtection
  } = useBloomLocalState();
  const protection = durableState.protection;
  const [statusOverride, setStatusOverride] =
    useState<ProtectionStatus | null>(null);
  const {
    activeAction,
    isLocked,
    isNavigationLocked,
    message,
    pendingRetryAction,
    retry,
    runAction
  } = useProtectionPersistenceAction();
  const allowPersistenceNavigation =
    usePersistenceNavigationGuard(isNavigationLocked);
  const visibleStatus = statusOverride ?? protection.status;

  const handleResumeProtection = async () => {
    setStatusOverride(protection.status);
    await runAction("resume", resumeProtection, {
      onSuccess: () => setStatusOverride(null),
      onFailure: () => setStatusOverride(null)
    });
  };

  const handlePauseProtection = async () => {
    setStatusOverride(protection.status);
    await runAction("pause", pauseProtection, {
      onSuccess: () => {
        setStatusOverride(null);
        allowPersistenceNavigation();
        router.replace(routes.protect);
      },
      onFailure: () => setStatusOverride(null)
    });
  };

  const handleTurnOffProtection = async () => {
    setStatusOverride(protection.status);
    await runAction("turn-off", turnOffProtection, {
      onSuccess: () => {
        setStatusOverride(null);
        allowPersistenceNavigation();
        router.replace(routes.protect);
      },
      onFailure: () => setStatusOverride(null)
    });
  };

  const persistenceFeedback = (
    <ProtectionPersistenceFeedback
      message={message}
      canRetry={pendingRetryAction !== null}
      retrying={activeAction !== null && pendingRetryAction === activeAction}
      onRetry={() => void retry()}
    />
  );

  if (visibleStatus === "off") {
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
          disabled={isNavigationLocked}
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

          {persistenceFeedback}

          <AppButton
            disabled={isNavigationLocked}
            accessibilityState={{ disabled: isNavigationLocked }}
            onPress={() => router.replace(routes.protectSetup)}
          >
            {hasSavedConfiguration ? "Review settings" : "Set up Protection"}
          </AppButton>
        </View>
      </AppScreen>
    );
  }

  if (visibleStatus === "paused") {
    return (
      <AppScreen contentStyle={styles.focusedContent}>
        <ProtectionFlowHeader
          title="Protection is paused"
          subtitle="Your in-app pause plan and preferences are still saved."
          onBackPress={() => router.replace(routes.protect)}
          disabled={isNavigationLocked}
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
              loading={
                activeAction === "resume" && pendingRetryAction === null
              }
              disabled={isLocked}
              onPress={() => void handleResumeProtection()}
            />
            <ProtectionActionRow
              title="Edit settings"
              description="Adjust the saved window and reminder style."
              iconLabel="E"
              accent="lavender"
              disabled={isNavigationLocked}
              onPress={() => router.push(routes.protectSetup)}
            />
            <ProtectionActionRow
              title="Turn off Protection"
              description="Keep the configuration but mark Protection as off."
              iconLabel="O"
              accent="peach"
              loading={
                activeAction === "turn-off" &&
                pendingRetryAction === null
              }
              disabled={isLocked}
              onPress={() => void handleTurnOffProtection()}
            />
          </View>

          {persistenceFeedback}

          <AppButton
            disabled={isNavigationLocked}
            accessibilityState={{ disabled: isNavigationLocked }}
            onPress={() => router.replace(routes.protect)}
          >
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
        disabled={isNavigationLocked}
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
            loading={
              activeAction === "pause" && pendingRetryAction === null
            }
            disabled={isLocked}
            onPress={() => void handlePauseProtection()}
          />
          <ProtectionActionRow
            title="Edit schedule"
            description="Adjust the saved window and reminder style."
            iconLabel="E"
            accent="lavender"
            disabled={isNavigationLocked}
            onPress={() => router.push(routes.protectSetup)}
          />
          <ProtectionActionRow
            title="Turn off Protection"
            description="Keep the configuration but mark Protection as off."
            iconLabel="O"
            accent="peach"
            loading={
              activeAction === "turn-off" && pendingRetryAction === null
            }
            disabled={isLocked}
            onPress={() => void handleTurnOffProtection()}
          />
        </View>

        {persistenceFeedback}

        <ProtectionRoutineCard
          title={formatProtectionWindow(protection.preferredWindow)}
          body="Bloom keeps this pause plan inside the app. It is optional, reversible, and available when you choose it."
        />

        <AppButton
          disabled={isNavigationLocked}
          accessibilityState={{ disabled: isNavigationLocked }}
          onPress={() => router.replace(routes.protect)}
        >
          Back to Protect
        </AppButton>
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
