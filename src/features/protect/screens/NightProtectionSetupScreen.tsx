import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { usePersistenceNavigationGuard } from "../../../shared/navigation/usePersistenceNavigationGuard";
import { ProtectionFlowHeader } from "../components/ProtectionFlowHeader";
import { ProtectionModeCard } from "../components/ProtectionModeCard";
import { ProtectionPersistenceFeedback } from "../components/ProtectionPersistenceFeedback";
import { ProtectionSetupSection } from "../components/ProtectionSetupSection";
import { useProtectionPersistenceAction } from "../useProtectionPersistenceAction";

export function NightProtectionSetupScreen() {
  const router = useRouter();
  const { state, configureProtection } = useBloomLocalState();
  const protection = state.protection;
  const nightStartTime = protection.nightStartTime ?? "22:00";
  const nightEndTime = protection.nightEndTime ?? "08:00";
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

  const startNightProtection = async () => {
    await runAction(
      "configure-night",
      () =>
        configureProtection({
          preferredWindow: "night",
          level: protection.level ?? "balanced",
          adultContentPauseEnabled: true,
          nightStartTime,
          nightEndTime
        }),
      {
        onSuccess: () => {
          allowPersistenceNavigation();
          router.replace(routes.protectActive);
        }
      }
    );
  };

  return (
    <AppScreen contentStyle={styles.focusedContent}>
      <ProtectionFlowHeader
        title="Night Protection Setup"
        subtitle="Save an in-app pause plan for your preferred night window."
        onBackPress={() => router.replace(routes.protect)}
        disabled={isNavigationLocked}
      />

      <View style={styles.stack}>
        <ProtectionSetupSection title="Bedtime support">
          <View style={styles.optionStack}>
            <ProtectionModeCard title="Starts at" value={nightStartTime} iconLabel="B" />
            <ProtectionModeCard
              title="Put-phone-away reminder"
              value="Coming soon"
              iconLabel="P"
              enabled={false}
            />
            <ProtectionModeCard
              title="Dim-screen reminder"
              value="Coming soon"
              iconLabel="D"
              enabled={false}
            />
            <ProtectionModeCard title="Ends at" value={nightEndTime} iconLabel="7" />
          </View>
        </ProtectionSetupSection>

        <ProtectionPersistenceFeedback
          message={message}
          canRetry={pendingRetryAction === "configure-night"}
          retrying={
            activeAction === "configure-night" &&
            pendingRetryAction === "configure-night"
          }
          onRetry={() => void retry()}
        />

        <AppButton
          testID="bloom.protection.night.complete"
          loading={
            activeAction === "configure-night" && pendingRetryAction === null
          }
          disabled={isLocked}
          accessibilityState={{
            busy: activeAction === "configure-night",
            disabled: isLocked
          }}
          onPress={() => void startNightProtection()}
        >
          Save night pause plan
        </AppButton>
        <AppText variant="bodySmall" tone="secondary" align="center">
          You can adjust these settings anytime.
        </AppText>
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
  optionStack: {
    gap: theme.spacing.md
  }
});
