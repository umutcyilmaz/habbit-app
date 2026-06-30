import { useRouter } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppIconButton } from "../../../shared/components/AppIconButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { getCompletedResetDayCount } from "../../../storage/bloomState";

const summaryItems = [
  "Porn avoided today",
  "Masturbation avoided today",
  "Checking avoided today",
  "2-minute reset completed"
] as const;

export function TenDayResetSavedScreen() {
  const router = useRouter();
  const { state, resetDay } = useBloomLocalState();
  const completedDayCount = getCompletedResetDayCount(state.tenDayReset);

  return (
    <AppScreen contentStyle={styles.content}>
      <SavedHeader day={resetDay} onClosePress={() => router.replace(routes.home)} />

      <View style={styles.stack}>
        <ProgressCard day={resetDay} completedDayCount={completedDayCount} />
        <TomorrowCard />
        <AfterResetCard />

        <View style={styles.bottomActions}>
          <AppButton onPress={() => router.push(routes.arousalControl)}>
            View Arousal Control Practice
          </AppButton>
          <AppButton variant="subtle" onPress={() => router.replace(routes.home)}>
            Back to Today
          </AppButton>
        </View>
      </View>
    </AppScreen>
  );
}

type SavedHeaderProps = {
  day: number;
  onClosePress: () => void;
};

function SavedHeader({ day, onClosePress }: SavedHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerActions}>
        <View style={styles.headerSpacer} />
        <View style={styles.headerLabelWrap}>
          <AppText variant="caption" tone="secondary" align="center" style={styles.eyebrow}>
            RESET SAVED
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
          Day {day} saved.
        </AppText>
        <AppText tone="secondary" align="center" style={styles.subtitle}>
          You created a pause from the pattern today.
        </AppText>
      </View>
    </View>
  );
}

type ProgressCardProps = {
  day: number;
  completedDayCount: number;
};

function ProgressCard({ day, completedDayCount }: ProgressCardProps) {
  return (
    <AppCard style={styles.progressCard}>
      <View style={styles.cardStack}>
        <View style={styles.progressHeader}>
          <AppText variant="title" style={styles.sectionTitle}>
            Day {day} of 10
          </AppText>
          <View style={styles.savedPill}>
            <AppText variant="caption" tone="secondary">
              Saved
            </AppText>
          </View>
        </View>

        <ResetProgressSegments completedDayCount={completedDayCount} />

        <View style={styles.summaryStack}>
          {summaryItems.map((item) => (
            <ResetSummaryItem key={item} text={item} />
          ))}
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

type ResetSummaryItemProps = {
  text: string;
};

function ResetSummaryItem({ text }: ResetSummaryItemProps) {
  return (
    <View style={styles.summaryItem}>
      <View style={styles.checkCircle}>
        <AppText variant="caption">✓</AppText>
      </View>
      <AppText variant="bodySmall" style={styles.summaryText}>
        {text}
      </AppText>
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
          Return tomorrow and repeat the same reset. Keep the goal simple: no porn, no
          masturbation, no checking.
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
  summaryStack: {
    gap: theme.spacing.sm
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    padding: theme.spacing.md
  },
  checkCircle: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.sage,
    borderWidth: 1
  },
  summaryText: {
    flex: 1
  },
  bottomActions: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg
  }
});
