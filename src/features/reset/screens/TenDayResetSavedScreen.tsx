import { useEffect } from "react";
import { useRouter } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes, type AppRoute } from "../../../constants/navigation";
import {
  getNextBloomAction,
  type NextBloomAction
} from "../../../domain/journey/getNextBloomAction";
import { getNextBloomActionLabel } from "../../../domain/journey/nextBloomActionPresentation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppIconButton } from "../../../shared/components/AppIconButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import {
  getCompletedResetDates,
  isResetProgramComplete
} from "../../../storage/bloomState";

export function TenDayResetSavedScreen() {
  const router = useRouter();
  const { state, todayKey } = useBloomLocalState();
  const nextAction = getNextBloomAction(state, todayKey);
  const completedDates = getCompletedResetDates(state.tenDayReset);
  const completedDayCount = completedDates.length;
  const hasSavedToday = completedDates.includes(todayKey);
  const resetTerminal = isResetProgramComplete(state.tenDayReset);
  const primaryAction = getSavedScreenPrimaryAction(nextAction);

  useEffect(() => {
    if (!hasSavedToday) {
      router.replace(
        nextAction.route === routes.tenDayResetSaved
          ? routes.tenDayReset
          : nextAction.route
      );
    }
  }, [hasSavedToday, nextAction.route, router]);

  if (!hasSavedToday) {
    return null;
  }

  return (
    <AppScreen contentStyle={styles.content}>
      <SavedHeader
        resetTerminal={resetTerminal}
        onClosePress={() => router.replace(routes.home)}
      />

      <View style={styles.stack}>
        <ProgressCard
          completedDate={todayKey}
          completedDayCount={completedDayCount}
          resetTerminal={resetTerminal}
        />
        {!resetTerminal ? <TomorrowCard /> : null}
        <AfterResetCard />

        <View style={styles.bottomActions}>
          <AppButton
            onPress={() => {
              if (primaryAction.replace) {
                router.replace(primaryAction.route);
                return;
              }

              router.push(primaryAction.route);
            }}
          >
            {primaryAction.label}
          </AppButton>
          {primaryAction.route !== routes.home ? (
            <AppButton variant="subtle" onPress={() => router.replace(routes.home)}>
              Back to Today
            </AppButton>
          ) : null}
        </View>
      </View>
    </AppScreen>
  );
}

type SavedScreenPrimaryAction = {
  label: string;
  route: AppRoute;
  replace: boolean;
};

function getSavedScreenPrimaryAction(
  nextAction: NextBloomAction
): SavedScreenPrimaryAction {
  if (nextAction.id === "viewTodayReset") {
    return {
      label: "Back to Today",
      route: routes.home,
      replace: true
    };
  }

  return {
    label: getNextBloomActionLabel(nextAction),
    route: nextAction.route,
    replace: false
  };
}

type SavedHeaderProps = {
  resetTerminal: boolean;
  onClosePress: () => void;
};

function SavedHeader({ resetTerminal, onClosePress }: SavedHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerActions}>
        <View style={styles.headerSpacer} />
        <View style={styles.headerLabelWrap}>
          <AppText variant="caption" tone="secondary" align="center" style={styles.eyebrow}>
            {resetTerminal ? "RESET COMPLETE" : "RESET SAVED"}
          </AppText>
        </View>
        <AppIconButton
          accessibilityLabel="Close reset saved"
          icon={<AppText variant="title">×</AppText>}
          onPress={onClosePress}
          style={styles.headerButton}
        />
      </View>

      <View style={styles.titleBlock}>
        <AppText variant="heading" align="center" style={styles.title}>
          {resetTerminal
            ? "Your 10-Day Reset is complete."
            : "Today’s Reset is saved."}
        </AppText>
        <AppText tone="secondary" align="center" style={styles.subtitle}>
          {resetTerminal
            ? "You completed ten Reset days. The next step is guided Arousal Control Practice."
            : "You marked today’s two-minute Reset as complete."}
        </AppText>
      </View>
    </View>
  );
}

type ProgressCardProps = {
  completedDate: string;
  completedDayCount: number;
  resetTerminal: boolean;
};

function ProgressCard({
  completedDate,
  completedDayCount,
  resetTerminal
}: ProgressCardProps) {
  return (
    <AppCard testID="bloom.reset.saved" style={styles.progressCard}>
      <View style={styles.cardStack}>
        <View style={styles.progressHeader}>
          <AppText variant="title" style={styles.sectionTitle}>
            {resetTerminal ? "10 days saved" : "Today’s saved Reset"}
          </AppText>
          <View style={styles.savedPill}>
            <AppText variant="caption" tone="secondary">
              Recorded
            </AppText>
          </View>
        </View>

        <ResetProgressSegments completedDayCount={completedDayCount} />

        <View style={styles.factStack}>
          <ResetFactRow label="Completed date" value={completedDate} />
          <ResetFactRow
            label="Reset days saved"
            value={`${completedDayCount}/10`}
          />
          {resetTerminal ? (
            <ResetFactRow label="Program status" value="Complete" />
          ) : null}
        </View>
      </View>
    </AppCard>
  );
}

type ResetProgressSegmentsProps = {
  completedDayCount: number;
};

function ResetProgressSegments({ completedDayCount }: ResetProgressSegmentsProps) {
  return (
    <View style={styles.progressRow} accessibilityRole="image">
      {Array.from({ length: 10 }, (_, index) => {
        const day = index + 1;

        return (
          <View
            key={day}
            style={[
              styles.progressSegment,
              day <= completedDayCount ? styles.progressSegmentActive : undefined
            ]}
          />
        );
      })}
    </View>
  );
}

type ResetFactRowProps = {
  label: string;
  value: string;
};

function ResetFactRow({ label, value }: ResetFactRowProps) {
  return (
    <View style={styles.factRow}>
      <AppText variant="bodySmall" tone="secondary">
        {label}
      </AppText>
      <AppText variant="label">{value}</AppText>
    </View>
  );
}

function TomorrowCard() {
  return (
    <AppCard style={styles.card}>
      <View style={styles.cardStack}>
        <AppText variant="title" style={styles.sectionTitle}>
          Tomorrow’s focus
        </AppText>
        <AppText tone="secondary">
          Return tomorrow for the next two-minute Reset. Keep the day simple and
          notice what helps create space.
        </AppText>
      </View>
    </AppCard>
  );
}

function AfterResetCard() {
  return (
    <AppCard style={styles.card}>
      <View style={styles.cardStack}>
        <AppText variant="title" style={styles.sectionTitle}>
          After 10 days
        </AppText>
        <AppText tone="secondary">
          When real desire is present, rebuild with controlled practice and less pressure.
        </AppText>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 430
  },
  header: {
    gap: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
    paddingTop: theme.spacing.sm
  },
  headerActions: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerSpacer: {
    width: 46,
    height: 46
  },
  headerButton: {
    width: 46,
    height: 46,
    minWidth: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.surface
  },
  headerLabelWrap: {
    position: "absolute",
    left: 58,
    right: 58,
    alignItems: "center"
  },
  eyebrow: {
    textTransform: "uppercase"
  },
  titleBlock: {
    alignItems: "center",
    gap: theme.spacing.md,
    paddingHorizontal: theme.spacing.sm
  },
  title: {
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      web: "Georgia, serif"
    }),
    fontSize: 40,
    lineHeight: 46
  },
  subtitle: {
    maxWidth: 320
  },
  stack: {
    gap: theme.spacing.xl
  },
  progressCard: {
    gap: theme.spacing.lg,
    borderRadius: theme.radius.xxl,
    padding: 28
  },
  card: {
    borderRadius: theme.radius.xxl,
    padding: 28
  },
  cardStack: {
    gap: theme.spacing.lg
  },
  progressHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md
  },
  sectionTitle: {
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      web: "Georgia, serif"
    })
  },
  savedPill: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  progressRow: {
    flexDirection: "row",
    gap: 4
  },
  progressSegment: {
    flex: 1,
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted
  },
  progressSegmentActive: {
    backgroundColor: theme.colors.sage
  },
  factStack: {
    gap: theme.spacing.sm
  },
  factRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderWidth: 1,
    padding: theme.spacing.md
  },
  bottomActions: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg
  }
});
