import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  useDemoAppDispatch,
  useDemoAppState
} from "../../../app/providers/DemoAppStateProvider";
import { useLocalDataLifecycle } from "../../../app/providers/LocalDataLifecycleProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

export function DataControlsScreen() {
  const router = useRouter();
  const state = useDemoAppState();
  const dispatch = useDemoAppDispatch();
  const {
    deletionStatus,
    deletionError,
    deleteAllLocalData,
    clearDeletionStatus
  } = useLocalDataLifecycle();
  const [confirmingDeletion, setConfirmingDeletion] = useState(false);
  const isDeleting = deletionStatus === "deleting";

  useEffect(() => {
    clearDeletionStatus();
  }, [clearDeletionStatus]);

  return (
    <AppScreen>
      <AppHeader
        eyebrow="Settings"
        title="Data Controls"
        subtitle="Review and manage data stored on this device."
      />

      <View style={styles.stack}>
        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">What this app stores</AppText>
            <AppText tone="secondary">
              Check-ins, pause sessions, and protection preferences may be used to personalize your
              experience.
            </AppText>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Personalization controls</AppText>
            <AppText tone="secondary">
              Personalized recommendations are {state.settings.personalizationEnabled ? "on" : "off"}.
            </AppText>
            <AppButton
              variant="secondary"
              onPress={() =>
                dispatch({
                  type: "TOGGLE_PERSONALIZATION"
                })
              }
            >
              Toggle personalization
            </AppButton>
          </View>
        </AppCard>

        <AppCard style={styles.cautionCard}>
          <View style={styles.cardStack}>
            <AppText variant="title">Delete local data</AppText>
            <AppText tone="secondary">
              This removes your onboarding result, plans, Reset progress,
              practice records, and other Bloom data stored on this device.
            </AppText>
            {confirmingDeletion ? (
              <View style={styles.confirmation}>
                <View style={styles.confirmationCopy}>
                  <AppText variant="label">Delete local data?</AppText>
                  <AppText tone="secondary">This cannot be undone.</AppText>
                </View>
                <View style={styles.actions}>
                  <AppButton
                    variant="subtle"
                    disabled={isDeleting}
                    onPress={() => setConfirmingDeletion(false)}
                  >
                    Cancel
                  </AppButton>
                  <AppButton
                    loading={isDeleting}
                    onPress={() => {
                      void deleteAllLocalData().catch(() => undefined);
                    }}
                  >
                    Delete
                  </AppButton>
                </View>
              </View>
            ) : (
              <AppButton
                variant="secondary"
                disabled={isDeleting}
                onPress={() => setConfirmingDeletion(true)}
              >
                Delete local data
              </AppButton>
            )}
            {deletionError !== null ? (
              <AppText tone="danger">{deletionError}</AppText>
            ) : null}
          </View>
        </AppCard>

        <AppButton variant="ghost" onPress={() => router.push(routes.settings)}>
          Back to Settings
        </AppButton>
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
  cautionCard: {
    backgroundColor: theme.colors.peachMuted,
    borderColor: theme.colors.peach
  },
  confirmation: {
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border
  },
  confirmationCopy: {
    gap: theme.spacing.xs
  },
  actions: {
    gap: theme.spacing.sm
  }
});
