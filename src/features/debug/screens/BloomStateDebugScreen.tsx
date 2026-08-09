import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import {
  useBloomLocalState,
  type BloomPersistedMutationResult,
  type BloomPersistenceRetryToken
} from "../../../app/providers/BloomLocalStateProvider";
import { useLocalDataLifecycle } from "../../../app/providers/LocalDataLifecycleProvider";
import { routes } from "../../../constants/navigation";
import {
  getNextBloomAction
} from "../../../domain/journey/getNextBloomAction";
import { getNextBloomActionLabel } from "../../../domain/journey/nextBloomActionPresentation";
import {
  createDebugQuizResult,
  getDebugQuizAnswers,
  getPatternLabel,
  type DebugProfileId
} from "../../onboarding/quiz";
import { getOnboardingPersistenceErrorMessage } from "../../onboarding/onboardingPersistenceFeedback";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import {
  getCompletedResetDates,
  getLatestBloomCheckInRecord,
  getLatestPauseRecord,
  getLatestValidArousalLog,
  getTodayKey,
  isValidCompletedArousalLog,
  isResetProgramComplete,
  type QuizFlags
} from "../../../storage/bloomState";

type PendingDebugProfileRetry = {
  profileId: DebugProfileId;
  retryToken: BloomPersistenceRetryToken;
};

export function BloomStateDebugScreen() {
  const router = useRouter();
  const {
    state,
    isLoading,
    hydrationStatus,
    hydrationError,
    persistenceError,
    todayKey,
    resetDay,
    resetTodayCompleted,
    retryPersistedMutation,
    saveOnboardingResult,
    saveOnboardingResultForFreshJourney,
    clearOnboardingResult,
    simulateNextDay,
    simulatePreviousDay
  } = useBloomLocalState();
  const {
    deletionStatus,
    deletionError,
    deleteAllLocalData,
    clearDeletionStatus
  } = useLocalDataLifecycle();
  const [confirmingReset, setConfirmingReset] = useState(false);
  const debugProfilePromiseRef =
    useRef<Promise<BloomPersistedMutationResult> | null>(null);
  const isMountedRef = useRef(true);
  const [activeDebugProfile, setActiveDebugProfile] =
    useState<DebugProfileId | null>(null);
  const [pendingDebugProfileRetry, setPendingDebugProfileRetry] =
    useState<PendingDebugProfileRetry | null>(null);
  const [debugProfilePersistenceError, setDebugProfilePersistenceError] =
    useState<string | null>(null);
  const isDeleting = deletionStatus === "deleting";
  const latestCheckIn = getLatestBloomCheckInRecord(state.checkIns.records);
  const latestPauseRecord = getLatestPauseRecord(state.pause.records);
  const validArousalLogs = state.arousalControl.logs.filter(
    isValidCompletedArousalLog
  );
  const latestArousalLog = getLatestValidArousalLog(validArousalLogs);
  const currentQuizResult = state.onboarding.quizResult;
  const nextAction = getNextBloomAction(state, todayKey);
  const completedResetDates = getCompletedResetDates(state.tenDayReset);
  const resetProgramComplete = isResetProgramComplete(state.tenDayReset);

  useEffect(() => {
    clearDeletionStatus();
  }, [clearDeletionStatus]);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setDebugProfile = (profileId: DebugProfileId) => {
    const quizAnswers = getDebugQuizAnswers(profileId);
    const quizResult = createDebugQuizResult(profileId);

    void saveOnboardingResult(quizAnswers, quizResult);
  };
  const startAsDebugProfile = async (profileId: DebugProfileId) => {
    if (debugProfilePromiseRef.current !== null) {
      return;
    }

    let persistencePromise: Promise<BloomPersistedMutationResult>;

    if (pendingDebugProfileRetry !== null) {
      if (pendingDebugProfileRetry.profileId !== profileId) {
        return;
      }

      persistencePromise = retryPersistedMutation(
        pendingDebugProfileRetry.retryToken
      );
    } else {
      const quizAnswers = getDebugQuizAnswers(profileId);
      const quizResult = createDebugQuizResult(profileId);
      persistencePromise = saveOnboardingResultForFreshJourney(
        quizAnswers,
        quizResult
      );
    }

    debugProfilePromiseRef.current = persistencePromise;
    setActiveDebugProfile(profileId);
    setDebugProfilePersistenceError(null);

    try {
      const result = await persistencePromise;

      if (!isMountedRef.current) {
        return;
      }

      if (result.ok) {
        setPendingDebugProfileRetry(null);
        router.push(routes.onboardingResult);
        return;
      }

      setPendingDebugProfileRetry(
        result.accepted && result.retryable
          ? {
              profileId,
              retryToken: result.retryToken
            }
          : null
      );
      setDebugProfilePersistenceError(
        getOnboardingPersistenceErrorMessage(result)
      );
    } catch {
      if (isMountedRef.current) {
        setDebugProfilePersistenceError(
          "Bloom couldn’t confirm this debug profile in local storage."
        );
      }
    } finally {
      if (debugProfilePromiseRef.current === persistencePromise) {
        debugProfilePromiseRef.current = null;

        if (isMountedRef.current) {
          setActiveDebugProfile(null);
        }
      }
    }
  };
  const openNextAction = () => router.push(nextAction.route);

  return (
    <AppScreen contentStyle={styles.content}>
      <AppHeader
        eyebrow="Developer tools"
        title="Bloom local state"
        subtitle="Inspect MVP state and simulate day changes."
      />

      <View style={styles.stack}>
        {isLoading ? (
          <AppCard style={styles.card}>
            <AppText tone="secondary">Loading local state…</AppText>
          </AppCard>
        ) : hydrationStatus === "error" ? (
          <AppCard style={styles.card}>
            <View style={styles.cardStackSmall}>
              <AppText variant="title">Local state unavailable</AppText>
              <AppText tone="secondary">
                {hydrationError?.message ?? "Bloom local data could not be loaded safely."}
              </AppText>
            </View>
          </AppCard>
        ) : (
          <>
            <SummaryCard
              rows={[
                ["Next action label", getNextBloomActionLabel(nextAction)],
                ["Completed reset days", String(completedResetDates.length)],
                ["Pause record count", String(state.pause.records.length)],
                ["Arousal completed logs", String(validArousalLogs.length)],
                ["Real date", getTodayKey()],
                ["Simulated today", todayKey],
                ["Date offset days", String(state.debug.dateOffsetDays)],
                ["Persistence status", persistenceError ?? "ready"],
                ["Onboarding completed", state.onboarding.completed ? "yes" : "no"],
                ["Result title", state.onboarding.quizResult?.resultTitle ?? "none"],
                ["Active plan", state.activePlan.planName],
                ["Next action", nextAction.id],
                ["Next phase", nextAction.phase],
                ["Next route", nextAction.route],
                ["Next reason", nextAction.reason],
                ["Score PL", formatScore(state.onboarding.quizResult?.scores.PL)],
                ["Score PP", formatScore(state.onboarding.quizResult?.scores.PP)],
                ["Score CT", formatScore(state.onboarding.quizResult?.scores.CT)],
                ["Score FC", formatScore(state.onboarding.quizResult?.scores.FC)],
                [
                  "Normalized PL",
                  formatPercent(state.onboarding.quizResult?.normalizedScores.PL)
                ],
                [
                  "Normalized PP",
                  formatPercent(state.onboarding.quizResult?.normalizedScores.PP)
                ],
                [
                  "Normalized CT",
                  formatPercent(state.onboarding.quizResult?.normalizedScores.CT)
                ],
                [
                  "Normalized FC",
                  formatPercent(state.onboarding.quizResult?.normalizedScores.FC)
                ],
                [
                  "Flags",
                  state.onboarding.quizResult
                    ? formatFlags(state.onboarding.quizResult.flags)
                    : "none"
                ],
                ["Chips", state.onboarding.quizResult?.chips.join(", ") ?? "none"],
                ["Reset started at", state.tenDayReset.startedAt ?? "not started"],
                ["Reset day", resetProgramComplete ? "Complete" : `Day ${resetDay} of 10`],
                ["Today completed", resetTodayCompleted ? "yes" : "no"],
                ["Reset terminal", resetProgramComplete ? "yes" : "no"],
                ["Completed dates", completedResetDates.join(", ") || "none"],
                ["Protection status", state.protection.status],
                ["Protection level", state.protection.level ?? "none"],
                ["Preferred window", state.protection.preferredWindow ?? "none"],
                [
                  "In-app content pause enabled",
                  state.protection.adultContentPauseEnabled ? "yes" : "no"
                ],
                ["Night start time", state.protection.nightStartTime ?? "none"],
                ["Night end time", state.protection.nightEndTime ?? "none"],
                ["Setup completed at", state.protection.setupCompletedAt ?? "none"],
                ["Last protection pause at", state.protection.lastProtectionPauseAt ?? "none"],
                ["Check-in record count", String(state.checkIns.records.length)],
                ["Latest check-in at", latestCheckIn?.createdAt ?? "none"],
                ["Latest check-in mood", latestCheckIn?.mood ?? "none"],
                ["Latest check-in moment", latestCheckIn?.moment ?? "none"],
                [
                  "Pause active draft",
                  state.pause.activeSession === null ? "no" : "yes"
                ],
                [
                  "Latest pause duration",
                  latestPauseRecord !== null
                    ? `${latestPauseRecord.durationSeconds} seconds`
                    : "none"
                ],
                [
                  "Latest pause before",
                  latestPauseRecord?.intensityBefore !== undefined
                    ? `${latestPauseRecord.intensityBefore}/10`
                    : "none"
                ],
                [
                  "Latest pause after",
                  latestPauseRecord?.intensityAfterChange ?? "none"
                ],
                [
                  "Arousal active session",
                  state.arousalControl.draft?.id ?? "none"
                ],
                [
                  "Arousal session status",
                  state.arousalControl.draft === null ? "none" : "active"
                ],
                ["Latest arousal log date", latestArousalLog?.dateKey ?? "none"],
                ["Latest practice mode", latestArousalLog?.mode ?? "none"],
                [
                  "Latest highest arousal",
                  latestArousalLog?.highestArousal !== undefined
                    ? `${latestArousalLog.highestArousal}/10`
                    : "none"
                ],
                [
                  "Latest pause count",
                  latestArousalLog?.pauseCount !== undefined ? String(latestArousalLog.pauseCount) : "none"
                ],
                [
                  "Latest control feeling",
                  latestArousalLog?.controlFeeling !== undefined
                    ? `${latestArousalLog.controlFeeling}/10`
                    : "none"
                ],
                ["Latest pressure/rushing", latestArousalLog?.pressureRushing ?? "none"],
                [
                  "Latest duration seconds",
                  latestArousalLog?.durationSeconds !== undefined &&
                  latestArousalLog.durationSeconds !== null
                    ? String(latestArousalLog.durationSeconds)
                    : "none"
                ],
                [
                  "Latest duration preference",
                  latestArousalLog?.durationPreference ?? "none"
                ],
                [
                  "Latest reflection",
                  latestArousalLog?.reflectionCompleted === true
                    ? "saved"
                    : "none"
                ]
              ]}
            />

            <AppCard style={styles.card}>
              <View style={styles.cardStack}>
                <View style={styles.cardStackSmall}>
                  <AppText variant="title">Profile test controls</AppText>
                  <AppText tone="secondary">
                    Switch the saved onboarding result and active plan for testing.
                  </AppText>
                </View>
                <View style={styles.profileList}>
                  {debugProfileIds.map((profileId) => (
                    <View key={profileId} style={styles.profileOption}>
                      <AppText variant="label">
                        {createDebugQuizResult(profileId).resultTitle}
                      </AppText>
                      <View style={styles.profileActions}>
                        <AppButton
                          testID={debugProfileTestIds[profileId]}
                          disabled={
                            (activeDebugProfile !== null &&
                              activeDebugProfile !== profileId) ||
                            (pendingDebugProfileRetry !== null &&
                              pendingDebugProfileRetry.profileId !== profileId)
                          }
                          loading={activeDebugProfile === profileId}
                          onPress={() => {
                            void startAsDebugProfile(profileId);
                          }}
                        >
                          {pendingDebugProfileRetry?.profileId === profileId
                            ? "Try starting this profile again"
                            : "Start as this profile"}
                        </AppButton>
                        <AppButton
                          variant="subtle"
                          disabled={
                            activeDebugProfile !== null ||
                            pendingDebugProfileRetry !== null
                          }
                          onPress={() => setDebugProfile(profileId)}
                        >
                          Set only
                        </AppButton>
                      </View>
                    </View>
                  ))}
                </View>
                {debugProfilePersistenceError !== null ? (
                  <AppText
                    accessibilityLiveRegion="polite"
                    accessibilityRole="alert"
                    variant="bodySmall"
                    tone="danger"
                  >
                    {debugProfilePersistenceError}
                  </AppText>
                ) : null}
                {currentQuizResult ? (
                  <View style={styles.currentProfile}>
                    <View style={styles.cardStackSmall}>
                      <AppText variant="caption" tone="secondary" style={styles.summaryLabel}>
                        Current profile
                      </AppText>
                      <AppText variant="title">{currentQuizResult.resultTitle}</AppText>
                    </View>
                    <View style={styles.profileSummaryStack}>
                      <ProfileSummaryRow label="Plan" value={currentQuizResult.planName} />
                      <ProfileSummaryRow
                        label="Primary pattern"
                        value={getPatternLabel(currentQuizResult.primaryPattern)}
                      />
                      <ProfileSummaryRow
                        label="Secondary pattern"
                        value={
                          currentQuizResult.secondaryPattern
                            ? getPatternLabel(currentQuizResult.secondaryPattern)
                            : "None"
                        }
                      />
                      <ProfileSummaryRow
                        label="Chips"
                        value={currentQuizResult.chips.join(", ") || "None"}
                      />
                    </View>
                    <View style={styles.actionStack}>
                      <AppButton onPress={() => router.push(routes.onboardingResult)}>
                        Open onboarding result
                      </AppButton>
                      <AppButton variant="subtle" onPress={openNextAction}>
                        Open next action
                      </AppButton>
                      <AppButton variant="ghost" onPress={() => router.push(routes.home)}>
                        Open Today
                      </AppButton>
                    </View>
                  </View>
                ) : (
                  <View style={styles.currentProfile}>
                    <AppText variant="caption" tone="secondary" style={styles.summaryLabel}>
                      Current profile
                    </AppText>
                    <AppText variant="bodySmall">No onboarding result</AppText>
                  </View>
                )}
                <AppButton variant="ghost" onPress={clearOnboardingResult}>
                  Clear onboarding result
                </AppButton>
              </View>
            </AppCard>

            <AppCard style={styles.card}>
              <View style={styles.cardStack}>
                <AppText variant="title">Date simulation</AppText>
                <View style={styles.actionStack}>
                  <AppButton onPress={simulateNextDay}>Simulate next day</AppButton>
                  <AppButton variant="subtle" onPress={simulatePreviousDay}>
                    Simulate previous day
                  </AppButton>
                </View>
              </View>
            </AppCard>

            <AppCard style={styles.card}>
              <View style={styles.cardStack}>
                <AppText variant="title">Reset local data</AppText>
                <AppText tone="secondary">
                  Clears canonical Bloom state, including saved Log, Pause, and
                  Arousal Control records.
                </AppText>
                {confirmingReset ? (
                  <View style={styles.confirmation}>
                    <View style={styles.cardStackSmall}>
                      <AppText variant="label">Reset local data?</AppText>
                      <AppText tone="secondary">This cannot be undone.</AppText>
                    </View>
                    <View style={styles.actionStack}>
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
                        Reset Bloom local data
                      </AppButton>
                    </View>
                  </View>
                ) : (
                  <AppButton
                    variant="secondary"
                    disabled={isDeleting}
                    onPress={() => setConfirmingReset(true)}
                  >
                    Reset Bloom local data
                  </AppButton>
                )}
                {deletionError !== null ? (
                  <AppText tone="danger">{deletionError}</AppText>
                ) : null}
              </View>
            </AppCard>

            <View style={styles.footerActions}>
              <AppButton onPress={() => router.replace(routes.home)}>Back to Today</AppButton>
              <AppButton variant="subtle" onPress={() => router.replace(routes.progress)}>
                Back to Progress
              </AppButton>
            </View>
          </>
        )}
      </View>
    </AppScreen>
  );
}

const debugProfileIds = [
  "pornLoop",
  "mixedPornPressure",
  "pressurePattern",
  "controlTiming",
  "generalStartingPoint"
] as const satisfies readonly DebugProfileId[];

const debugProfileTestIds: Record<DebugProfileId, string> = {
  pornLoop: "bloom.debug.profile.porn-loop",
  mixedPornPressure: "bloom.debug.profile.mixed",
  pressurePattern: "bloom.debug.profile.pressure",
  controlTiming: "bloom.debug.profile.control",
  generalStartingPoint: "bloom.debug.profile.general"
};

function formatFlags(flags: QuizFlags) {
  const activeFlags = Object.entries(flags)
    .filter(([, enabled]) => enabled)
    .map(([name]) => name);

  return activeFlags.length > 0 ? activeFlags.join(", ") : "none";
}

function formatScore(value: number | undefined) {
  return value !== undefined ? String(value) : "0";
}

function formatPercent(value: number | undefined) {
  return value !== undefined ? `${Math.round(value * 100)}%` : "0%";
}

type SummaryCardProps = {
  rows: Array<[string, string]>;
};

function SummaryCard({ rows }: SummaryCardProps) {
  return (
    <AppCard testID="bloom.debug.state" style={styles.card}>
      <View style={styles.cardStack}>
        <AppText variant="title">State summary</AppText>
        <View style={styles.summaryStack}>
          {rows.map(([label, value]) => {
            const testID = getDebugSummaryTestID(label);

            return (
              <View
                key={label}
                {...(testID !== undefined
                  ? {
                      testID,
                      accessibilityLabel: `${label}: ${value}`
                    }
                  : {})}
                style={styles.summaryRow}
              >
                <AppText variant="caption" tone="secondary" style={styles.summaryLabel}>
                  {label}
                </AppText>
                <AppText variant="bodySmall" style={styles.summaryValue}>
                  {value}
                </AppText>
              </View>
            );
          })}
        </View>
      </View>
    </AppCard>
  );
}

function getDebugSummaryTestID(label: string) {
  switch (label) {
    case "Pause record count":
      return "bloom.debug.pause-record-count";
    case "Completed reset days":
      return "bloom.debug.reset-completed-count";
    case "Arousal completed logs":
      return "bloom.debug.arousal-log-count";
    case "Next action label":
      return "bloom.debug.next-action";
    default:
      return undefined;
  }
}

type ProfileSummaryRowProps = {
  label: string;
  value: string;
};

function ProfileSummaryRow({ label, value }: ProfileSummaryRowProps) {
  return (
    <View style={styles.profileSummaryRow}>
      <AppText variant="caption" tone="secondary" style={styles.summaryLabel}>
        {label}
      </AppText>
      <AppText variant="bodySmall" style={styles.summaryValue}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 430
  },
  stack: {
    gap: theme.spacing.xl
  },
  card: {
    borderRadius: theme.radius.xxl,
    padding: 28
  },
  cardStack: {
    gap: theme.spacing.lg
  },
  cardStackSmall: {
    gap: theme.spacing.xs
  },
  profileList: {
    gap: theme.spacing.sm
  },
  profileOption: {
    gap: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md
  },
  profileActions: {
    gap: theme.spacing.sm
  },
  currentProfile: {
    gap: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.md
  },
  profileSummaryStack: {
    gap: theme.spacing.xs
  },
  profileSummaryRow: {
    gap: theme.spacing.xs
  },
  summaryStack: {
    gap: theme.spacing.sm
  },
  summaryRow: {
    gap: theme.spacing.xs,
    borderRadius: theme.radius.lg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md
  },
  summaryLabel: {
    textTransform: "uppercase"
  },
  summaryValue: {
    flexShrink: 1
  },
  actionStack: {
    gap: theme.spacing.sm
  },
  confirmation: {
    gap: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border
  },
  footerActions: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg
  }
});
