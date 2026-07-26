import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import {
  createDebugQuizResult,
  getRecommendedFirstActionLabel,
  type DebugProfileId
} from "../../onboarding/quiz";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import {
  getCompletedResetDayCount,
  getLatestArousalControlLog,
  getTodayKey,
  type RecommendedFirstAction,
  type QuizFlags
} from "../../../storage/bloomState";

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
    resetBloomLocalData,
    saveOnboardingResult,
    saveOnboardingResultForFreshJourney,
    clearOnboardingResult,
    simulateNextDay,
    simulatePreviousDay
  } = useBloomLocalState();
  const latestArousalLog = getLatestArousalControlLog(state.arousalControl.logs);
  const currentQuizResult = state.onboarding.quizResult;
  const setDebugProfile = (profileId: DebugProfileId) => {
    const quizResult = createDebugQuizResult(profileId);

    saveOnboardingResult(
      { debugProfileId: profileId },
      quizResult
    );
  };
  const startAsDebugProfile = (profileId: DebugProfileId) => {
    const quizResult = createDebugQuizResult(profileId);

    saveOnboardingResultForFreshJourney(
      { debugProfileId: profileId, startedFreshJourney: true },
      quizResult
    );
    router.push(routes.onboardingResult);
  };
  const openRecommendedFirstStep = () => {
    if (currentQuizResult === null) {
      return;
    }

    router.push(getRecommendedFirstActionRoute(currentQuizResult.recommendedFirstAction));
  };

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
                ["Real date", getTodayKey()],
                ["Simulated today", todayKey],
                ["Date offset days", String(state.debug.dateOffsetDays)],
                ["Persistence status", persistenceError ?? "ready"],
                ["Onboarding completed", state.onboarding.completed ? "yes" : "no"],
                ["Result title", state.onboarding.quizResult?.resultTitle ?? "none"],
                ["Active plan", state.activePlan.planName],
                ["Recommended first action", state.activePlan.recommendedFirstAction],
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
                ["Reset day", `Day ${resetDay} of 10`],
                ["Today completed", resetTodayCompleted ? "yes" : "no"],
                ["Completed reset days", String(getCompletedResetDayCount(state.tenDayReset))],
                ["Completed dates", state.tenDayReset.completedDates.join(", ") || "none"],
                ["Protection enabled", state.protection.isEnabled ? "yes" : "no"],
                ["Preferred window", state.protection.preferredWindow ?? "none"],
                [
                  "Adult content pause enabled",
                  state.protection.adultContentPauseEnabled ? "yes" : "no"
                ],
                ["Setup completed at", state.protection.setupCompletedAt ?? "none"],
                ["Last protection pause at", state.protection.lastProtectionPauseAt ?? "none"],
                ["Arousal logs count", String(state.arousalControl.logs.length)],
                ["Latest arousal log date", latestArousalLog?.dateKey ?? "none"],
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
                  {debugProfiles.map((profile) => (
                    <View key={profile.id} style={styles.profileOption}>
                      <AppText variant="label">{profile.title}</AppText>
                      <View style={styles.profileActions}>
                        <AppButton onPress={() => startAsDebugProfile(profile.id)}>
                          Start as this profile
                        </AppButton>
                        <AppButton variant="subtle" onPress={() => setDebugProfile(profile.id)}>
                          Set only
                        </AppButton>
                      </View>
                    </View>
                  ))}
                </View>
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
                        label="Recommended first action"
                        value={getRecommendedFirstActionLabel(currentQuizResult.recommendedFirstAction)}
                      />
                      <ProfileSummaryRow
                        label="Primary pattern"
                        value={currentQuizResult.primaryPattern}
                      />
                      <ProfileSummaryRow
                        label="Secondary pattern"
                        value={currentQuizResult.secondaryPattern ?? "None"}
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
                      <AppButton variant="subtle" onPress={openRecommendedFirstStep}>
                        Open recommended first step
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
                  Clears reset, protection, arousal logs, and debug date offset.
                </AppText>
                <AppButton variant="secondary" onPress={resetBloomLocalData}>
                  Reset Bloom local data
                </AppButton>
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

const debugProfiles: Array<{ id: DebugProfileId; title: string }> = [
  { id: "pornLoop", title: "Porn loop pattern" },
  { id: "mixedPornPressure", title: "Porn loop + pressure pattern" },
  { id: "pressurePattern", title: "Pressure pattern" },
  { id: "controlTiming", title: "Control and timing practice" }
];

function getRecommendedFirstActionRoute(action: RecommendedFirstAction) {
  switch (action) {
    case "startReset":
      return routes.tenDayReset;
    case "startArousalPractice":
      return routes.arousalControl;
    case "setupProtection":
    default:
      return routes.protectSetup;
  }
}

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
    <AppCard style={styles.card}>
      <View style={styles.cardStack}>
        <AppText variant="title">State summary</AppText>
        <View style={styles.summaryStack}>
          {rows.map(([label, value]) => (
            <View key={label} style={styles.summaryRow}>
              <AppText variant="caption" tone="secondary" style={styles.summaryLabel}>
                {label}
              </AppText>
              <AppText variant="bodySmall" style={styles.summaryValue}>
                {value}
              </AppText>
            </View>
          ))}
        </View>
      </View>
    </AppCard>
  );
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
  footerActions: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg
  }
});
