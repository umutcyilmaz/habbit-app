import { useCallback, useRef, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type {
  ProtectionLevel,
  ProtectionState,
  ProtectionStatus
} from "../../../storage/bloomState";
import { ProtectionActionRow } from "../components/ProtectionActionRow";
import { ProtectionPersistenceFeedback } from "../components/ProtectionPersistenceFeedback";
import { ProtectionStatusHero } from "../components/ProtectionStatusHero";
import { createProtectionNavigationFocusGuard } from "../protectionNavigationFocusGuard";
import { useProtectionPersistenceAction } from "../useProtectionPersistenceAction";

function getStatusCopy(status: ProtectionStatus) {
  switch (status) {
    case "active":
      return {
        statusLabel: "Ready",
        title: "Protection is ready.",
        body: "Your saved in-app pause plan is available when you choose to open it.",
        primaryAction: "Manage Protection"
      };
    case "paused":
      return {
        statusLabel: "Paused",
        title: "Protection is paused inside Bloom.",
        body: "Your settings are saved and ready when you choose to resume.",
        primaryAction: "Resume Protection"
      };
    case "off":
    default:
      return {
        statusLabel: "Off",
        title: "Protection is off.",
        body: "Set up an optional in-app pause plan for sensitive moments.",
        primaryAction: "Set up Protection"
      };
  }
}

export function ProtectScreen() {
  const router = useRouter();
  const navigationFocusGuardRef = useRef(
    createProtectionNavigationFocusGuard()
  );
  const navigationFocusGuard = navigationFocusGuardRef.current;
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
    message,
    pendingRetryAction,
    retry,
    runAction
  } = useProtectionPersistenceAction();
  const visibleStatus = statusOverride ?? protection.status;
  const statusCopy = getStatusCopy(visibleStatus);
  const activeHours = formatActiveHours(protection);

  useFocusEffect(
    useCallback(() => {
      return navigationFocusGuard.beginFocus();
    }, [navigationFocusGuard])
  );

  const handlePrimaryAction = async () => {
    if (visibleStatus === "active") {
      router.push(routes.protectActive);
      return;
    }

    if (visibleStatus === "paused") {
      const resumeFocusSequence =
        navigationFocusGuard.captureFocusSequence();
      setStatusOverride(protection.status);
      await runAction("resume", resumeProtection, {
        onSuccess: () => {
          setStatusOverride(null);

          navigationFocusGuard.runIfFocusUnchanged(
            resumeFocusSequence,
            () => {
              router.push(routes.protectActive);
            }
          );
        },
        onFailure: () => setStatusOverride(null)
      });
      return;
    }

    router.push(routes.protectSetup);
  };

  const handlePauseProtection = async () => {
    setStatusOverride(protection.status);
    await runAction("pause", pauseProtection, {
      onSuccess: () => setStatusOverride(null),
      onFailure: () => setStatusOverride(null)
    });
  };

  const handleTurnOffProtection = async () => {
    setStatusOverride(protection.status);
    await runAction("turn-off", turnOffProtection, {
      onSuccess: () => setStatusOverride(null),
      onFailure: () => setStatusOverride(null)
    });
  };

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
          variant={visibleStatus}
        />

        <View style={styles.actions}>
          <AppButton
            testID="bloom.protection.primary-action"
            loading={
              activeAction === "resume" && pendingRetryAction === null
            }
            disabled={isLocked}
            accessibilityState={{ disabled: isLocked }}
            onPress={() => void handlePrimaryAction()}
          >
            {statusCopy.primaryAction}
          </AppButton>
          <AppButton
            variant="secondary"
            disabled={isLocked}
            accessibilityState={{ disabled: isLocked }}
            onPress={() => router.push(routes.protectIntercept)}
          >
            Start temporary support
          </AppButton>
          {visibleStatus !== "off" ? (
            <>
              {visibleStatus === "active" ? (
                <AppButton
                  testID="bloom.protection.pause"
                  variant="ghost"
                  loading={
                    activeAction === "pause" && pendingRetryAction === null
                  }
                  disabled={isLocked}
                  accessibilityState={{ disabled: isLocked }}
                  onPress={() => void handlePauseProtection()}
                >
                  Pause Protection
                </AppButton>
              ) : null}
              <AppButton
                variant="ghost"
                disabled={isLocked}
                accessibilityState={{ disabled: isLocked }}
                onPress={() => router.push(routes.protectSetup)}
              >
                Edit schedule
              </AppButton>
              <AppButton
                testID="bloom.protection.turn-off"
                variant="ghost"
                loading={
                  activeAction === "turn-off" &&
                  pendingRetryAction === null
                }
                disabled={isLocked}
                accessibilityState={{ disabled: isLocked }}
                onPress={() => void handleTurnOffProtection()}
              >
                Turn off Protection
              </AppButton>
            </>
          ) : null}
          <ProtectionPersistenceFeedback
            message={message}
            canRetry={pendingRetryAction !== null}
            retrying={
              activeAction !== null && pendingRetryAction === activeAction
            }
            onRetry={() => void retry()}
          />
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
                title="Preferred window"
                description="Saved in-app pause preference"
                value={activeHours}
                iconLabel="H"
                accent="lavender"
                disabled={isLocked}
                onPress={() => router.push(routes.protectSetup)}
              />
              <ProtectionActionRow
                title="In-app content pause"
                description="Saved option for Bloom’s pause flow"
                value={protection.adultContentPauseEnabled ? "Saved" : "Not set"}
                iconLabel="B"
                accent="sage"
                disabled={isLocked}
                onPress={() => router.push(routes.protectSetup)}
              />
              <ProtectionActionRow
                title="Reminder style"
                description="Saved guidance preference"
                value={formatProtectionLevel(protection.level)}
                iconLabel="N"
                accent="peach"
                disabled={isLocked}
                onPress={() => router.push(routes.protectSetup)}
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

function formatActiveHours(protection: ProtectionState) {
  switch (protection.preferredWindow) {
    case "night":
      return `${protection.nightStartTime ?? "22:00"}–${
        protection.nightEndTime ?? "08:00"
      }`;
    case "alwaysOn":
      return "Any time";
    case "custom":
      return "Custom";
    case "evening":
      return "Evening";
    default:
      return "Not set";
  }
}

function formatProtectionLevel(level: ProtectionLevel | null) {
  if (level === null) {
    return "Not set";
  }

  return `${level.charAt(0).toUpperCase()}${level.slice(1)}`;
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
