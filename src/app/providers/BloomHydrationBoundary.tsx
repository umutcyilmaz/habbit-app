import { useEffect, useState, type PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppButton } from "../../shared/components/AppButton";
import { AppCard } from "../../shared/components/AppCard";
import { AppText } from "../../shared/components/AppText";
import { theme } from "../../shared/design-system/theme";
import { useBloomLocalState } from "./BloomLocalStateProvider";
import { useLocalDataLifecycle } from "./LocalDataLifecycleProvider";

export function BloomHydrationBoundary({ children }: PropsWithChildren) {
  const { hydrationStatus, hydrationError, retryHydration } =
    useBloomLocalState();
  const {
    deletionStatus,
    deletionError,
    deleteAllLocalData,
    retryBloomLocalDataResetNavigation,
    clearDeletionStatus
  } = useLocalDataLifecycle();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const isDeleting = deletionStatus === "deleting";

  useEffect(() => {
    if (hydrationStatus === "error") {
      clearDeletionStatus();
      return;
    }

    setConfirmingReset(false);
  }, [clearDeletionStatus, hydrationStatus]);

  if (deletionStatus === "success") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContent}>
          <AppCard style={styles.errorCard}>
            <View style={styles.stack}>
              <View style={styles.copyStack}>
                <AppText variant="heading">Local data deleted.</AppText>
                <AppText tone="secondary">
                  {deletionError ?? "Bloom is opening onboarding."}
                </AppText>
              </View>

              {deletionError !== null ? (
                <AppButton onPress={retryBloomLocalDataResetNavigation}>
                  Open onboarding
                </AppButton>
              ) : null}
            </View>
          </AppCard>
        </View>
      </SafeAreaView>
    );
  }

  if (hydrationStatus === "loading") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContent}>
          <AppText variant="label" tone="secondary">
            Bloom
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  if (hydrationStatus === "error") {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContent}>
          <AppCard style={styles.errorCard}>
            <View style={styles.stack}>
              <View style={styles.copyStack}>
                <AppText variant="heading">
                  Bloom couldn’t load your local data.
                </AppText>
                <AppText tone="secondary">
                  {hydrationError?.message ??
                    "Bloom local data is temporarily unavailable."}
                </AppText>
                <AppText tone="secondary">
                  You can try again or reset the local data on this device.
                </AppText>
              </View>

              {confirmingReset ? (
                <View style={styles.confirmation}>
                  <View style={styles.copyStack}>
                    <AppText variant="title">Reset local data?</AppText>
                    <AppText tone="secondary">This cannot be undone.</AppText>
                  </View>
                  <View style={styles.actions}>
                    <AppButton
                      variant="subtle"
                      disabled={isDeleting}
                      onPress={() => setConfirmingReset(false)}
                    >
                      Cancel
                    </AppButton>
                    <AppButton
                      loading={isDeleting}
                      onPress={() => {
                        void deleteAllLocalData().catch(() => undefined);
                      }}
                    >
                      Reset local data
                    </AppButton>
                  </View>
                </View>
              ) : (
                <View style={styles.actions}>
                  <AppButton
                    disabled={isDeleting}
                    onPress={() => {
                      void retryHydration();
                    }}
                  >
                    Try again
                  </AppButton>
                  <AppButton
                    variant="secondary"
                    disabled={isDeleting}
                    onPress={() => setConfirmingReset(true)}
                  >
                    Reset local data
                  </AppButton>
                </View>
              )}

              {deletionError !== null ? (
                <AppText tone="danger">{deletionError}</AppText>
              ) : null}
            </View>
          </AppCard>
        </View>
      </SafeAreaView>
    );
  }

  return children;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  loadingContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing.xl
  },
  errorContent: {
    flex: 1,
    justifyContent: "center",
    padding: theme.spacing.xl
  },
  errorCard: {
    width: "100%",
    maxWidth: 430,
    alignSelf: "center",
    padding: theme.spacing.xl
  },
  stack: {
    gap: theme.spacing.xl
  },
  copyStack: {
    gap: theme.spacing.sm
  },
  confirmation: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border
  },
  actions: {
    gap: theme.spacing.md
  }
});
