import { useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes, type AppRoute } from "../../../constants/navigation";
import { getNextBloomAction } from "../../../domain/journey/getNextBloomAction";
import { getNextBloomActionLabel } from "../../../domain/journey/nextBloomActionPresentation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppIconButton } from "../../../shared/components/AppIconButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import {
  getCompletedResetDayCount,
  isResetProgramComplete,
  isResetStarted
} from "../../../storage/bloomState";

const resetRules = [
  {
    title: "No porn",
    body: "Create distance from automatic stimulation."
  },
  {
    title: "No masturbation",
    body: "Give the pressure pattern a short break."
  },
  {
    title: "No checking",
    body: "Avoid testing or forcing arousal."
  }
] as const;

const replacementActions = [
  {
    title: "90-Second Pause",
    body: "Use this when the urge feels automatic.",
    icon: "Ⅱ",
    route: routes.pause
  },
  {
    title: "Quick Check-In",
    body: "Notice boredom, stress, or phone habit first.",
    icon: "✓",
    route: routes.pauseCheckIn
  },
  {
    title: "Phone away",
    body: "Move your phone out of reach for a few minutes.",
    icon: "↘"
  },
  {
    title: "Controlled practice later",
    body: "Rebuild with guided practice after the reset.",
    icon: "∿",
    route: routes.arousalControl
  }
] as const;

export function TenDayResetScreen() {
  const router = useRouter();
  const {
    state,
    todayKey,
    resetDay,
    startTenDayReset
  } = useBloomLocalState();
  const resetStarted = isResetStarted(state.tenDayReset);
  const resetComplete = isResetProgramComplete(state.tenDayReset);
  const displayDay = resetStarted ? resetDay : 1;
  const completedDayCount = getCompletedResetDayCount(state.tenDayReset);
  const nextAction = getNextBloomAction(state, todayKey);

  const startTodayReset = () => {
    startTenDayReset();
    router.push(routes.tenDayResetPractice);
  };

  if (resetComplete) {
    return (
      <AppScreen contentStyle={styles.content}>
        <ResetHeader
          label="RESET COMPLETE"
          title="Your 10-Day Reset is complete."
          subtitle="You completed ten Reset days. Your next step is guided practice with more body awareness."
          onBackPress={() => router.back()}
          onClosePress={() => router.replace(routes.home)}
        />

        <View style={styles.stack}>
          <ResetCompleteCard completedDayCount={completedDayCount} />

          <View style={styles.bottomActions}>
            <AppButton onPress={() => router.push(nextAction.route)}>
              {getNextBloomActionLabel(nextAction)}
            </AppButton>
            <AppButton variant="subtle" onPress={() => router.replace(routes.home)}>
              Back to Today
            </AppButton>
          </View>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen contentStyle={styles.content}>
      <ResetHeader
        label="RESET PLAN"
        title="10-Day Reset"
        subtitle="Step away from pressure, porn, and checking so you can rebuild with more awareness."
        onBackPress={() => router.back()}
        onClosePress={() => router.replace(routes.home)}
      />

      <View style={styles.stack}>
        <DayOverviewCard day={displayDay} completedDayCount={completedDayCount} />
        <ResetRulesCard />
        <ReplacementActionsCard
          onRoutePress={(route) => {
            router.push(route);
          }}
        />

        <View style={styles.bottomActions}>
          {resetStarted ? (
            <AppButton onPress={() => router.push(nextAction.route)}>
              {getNextBloomActionLabel(nextAction)}
            </AppButton>
          ) : (
            <AppButton onPress={startTodayReset}>Start today’s reset</AppButton>
          )}
          <AppButton variant="subtle" onPress={() => router.replace(routes.home)}>
            Back to Today
          </AppButton>
        </View>
      </View>
    </AppScreen>
  );
}

type ResetCompleteCardProps = {
  completedDayCount: number;
};

function ResetCompleteCard({ completedDayCount }: ResetCompleteCardProps) {
  return (
    <AppCard style={styles.heroCard}>
      <View style={styles.heroCopy}>
        <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
          {completedDayCount} OF 10 DAYS SAVED
        </AppText>
        <AppText variant="title" style={styles.heroTitle}>
          Continue with guided practice.
        </AppText>
        <AppText tone="secondary">
          Guided Arousal Control Practice is available whenever you feel ready.
        </AppText>
      </View>

      <ResetProgressSegments
        currentDay={10}
        completedDayCount={completedDayCount}
      />
    </AppCard>
  );
}

type ResetHeaderProps = {
  label: string;
  title: string;
  subtitle: string;
  onBackPress: () => void;
  onClosePress: () => void;
};

function ResetHeader({ label, title, subtitle, onBackPress, onClosePress }: ResetHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerActions}>
        <AppIconButton
          accessibilityLabel="Go back"
          icon={<AppText variant="title">‹</AppText>}
          onPress={onBackPress}
          style={styles.headerButton}
        />
        <View style={styles.headerLabelWrap}>
          <AppText variant="caption" tone="secondary" align="center" style={styles.eyebrow}>
            {label}
          </AppText>
        </View>
        <AppIconButton
          accessibilityLabel="Close reset plan"
          icon={<AppText variant="title">×</AppText>}
          onPress={onClosePress}
          style={styles.headerButton}
        />
      </View>

      <View style={styles.titleBlock}>
        <AppText variant="heading" align="center" style={styles.title}>
          {title}
        </AppText>
        <AppText tone="secondary" align="center" style={styles.subtitle}>
          {subtitle}
        </AppText>
      </View>
    </View>
  );
}

type DayOverviewCardProps = {
  day: number;
  completedDayCount: number;
};

function DayOverviewCard({ day, completedDayCount }: DayOverviewCardProps) {
  return (
    <AppCard style={styles.heroCard}>
      <View style={styles.heroCopy}>
        <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
          DAY {day} OF 10
        </AppText>
        <AppText variant="title" style={styles.heroTitle}>
          Create a clean pause from the pattern.
        </AppText>
        <AppText tone="secondary">
          Today means no porn, no masturbation, and no checking.
        </AppText>
      </View>

      <ResetProgressSegments currentDay={day} completedDayCount={completedDayCount} />
    </AppCard>
  );
}

type ResetProgressSegmentsProps = {
  currentDay: number;
  completedDayCount: number;
};

function ResetProgressSegments({ currentDay, completedDayCount }: ResetProgressSegmentsProps) {
  return (
    <View style={styles.progressRow} accessibilityRole="image">
      {Array.from({ length: 10 }, (_, index) => {
        const day = index + 1;
        const isActive = day <= completedDayCount || day === currentDay;

        return (
          <View
            key={day}
            style={[styles.progressSegment, isActive ? styles.progressSegmentActive : undefined]}
          />
        );
      })}
    </View>
  );
}

function ResetRulesCard() {
  return (
    <AppCard style={styles.card}>
      <View style={styles.cardStack}>
        <AppText variant="title" style={styles.sectionTitle}>
          Reset rules
        </AppText>
        <View style={styles.rowStack}>
          {resetRules.map((rule, index) => (
            <ResetRuleRow key={rule.title} number={index + 1} title={rule.title} body={rule.body} />
          ))}
        </View>
      </View>
    </AppCard>
  );
}

type ResetRuleRowProps = {
  number: number;
  title: string;
  body: string;
};

function ResetRuleRow({ number, title, body }: ResetRuleRowProps) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.numberCircle}>
        <AppText variant="caption">{number}</AppText>
      </View>
      <View style={styles.rowCopy}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {body}
        </AppText>
      </View>
    </View>
  );
}

type ReplacementActionsCardProps = {
  onRoutePress: (route: AppRoute) => void;
};

function ReplacementActionsCard({ onRoutePress }: ReplacementActionsCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.cardStack}>
        <AppText variant="title" style={styles.sectionTitle}>
          What to do instead
        </AppText>
        <View style={styles.alternativeStack}>
          {replacementActions.map((action) => (
            <ReplacementActionRow
              key={action.title}
              title={action.title}
              body={action.body}
              icon={action.icon}
              {...("route" in action ? { route: action.route } : {})}
              onRoutePress={onRoutePress}
            />
          ))}
        </View>
      </View>
    </AppCard>
  );
}

type ReplacementActionRowProps = {
  title: string;
  body: string;
  icon: string;
  route?: AppRoute;
  onRoutePress: (route: AppRoute) => void;
};

function ReplacementActionRow({
  title,
  body,
  icon,
  route,
  onRoutePress
}: ReplacementActionRowProps) {
  const isTappable = route !== undefined;
  const content = (
    <>
      <View style={styles.iconCircle}>
        <AppText variant="label">{icon}</AppText>
      </View>
      <View style={styles.rowCopy}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {body}
        </AppText>
      </View>
      {isTappable ? (
        <AppText variant="body" tone="secondary">
          ›
        </AppText>
      ) : null}
    </>
  );

  if (!isTappable) {
    return <View style={styles.alternativeRow}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onRoutePress(route)}
      style={({ pressed }) => [styles.alternativeRow, pressed ? styles.rowPressed : undefined]}
    >
      {content}
    </Pressable>
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
    maxWidth: 340
  },
  stack: {
    gap: theme.spacing.xl
  },
  heroCard: {
    gap: theme.spacing.lg,
    borderRadius: theme.radius.xxl,
    padding: 28
  },
  heroCopy: {
    gap: theme.spacing.sm
  },
  heroTitle: {
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      web: "Georgia, serif"
    }),
    fontSize: 28,
    lineHeight: 34
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
  card: {
    borderRadius: theme.radius.xxl,
    padding: 28
  },
  cardStack: {
    gap: theme.spacing.lg
  },
  sectionTitle: {
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      web: "Georgia, serif"
    })
  },
  rowStack: {
    gap: theme.spacing.lg
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: theme.spacing.md
  },
  numberCircle: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage,
    borderWidth: 1
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xs
  },
  alternativeStack: {
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    overflow: "hidden"
  },
  alternativeRow: {
    minHeight: 68,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderBottomColor: theme.colors.border,
    borderBottomWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md
  },
  rowPressed: {
    backgroundColor: theme.colors.surfaceMuted
  },
  iconCircle: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage,
    borderWidth: 1
  },
  bottomActions: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg
  }
});
