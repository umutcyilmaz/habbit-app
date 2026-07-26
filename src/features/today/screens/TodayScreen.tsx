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
import type { ActivePlan } from "../../../storage/bloomState";

const activePlan = {
  label: "YOUR PLAN",
  secondaryAction: "Quick Check-In",
  sensitiveWindow: "Evening window"
} as const;

const todayPathSteps = [
  {
    title: "Before opening porn",
    body: "Pause for 90 seconds"
  },
  {
    title: "If desire is present",
    body: "Choose controlled practice"
  },
  {
    title: "If it feels automatic",
    body: "Put the phone away and check in"
  }
] as const;

export function TodayScreen() {
  const router = useRouter();
  const { state, resetDay, resetTodayCompleted, startTenDayReset } = useBloomLocalState();
  const resetStarted = state.tenDayReset.startedAt !== null;
  const heroState = getTodayHeroState({
    resetStarted,
    resetTodayCompleted,
    resetDay,
    protectionEnabled: state.protection.isEnabled,
    activePlan: state.activePlan
  });

  return (
    <AppScreen contentStyle={styles.content}>
      <View style={styles.stack}>
        <PlanHeader
          planName={state.activePlan.planName}
          onSettingsPress={() => router.push(routes.settings)}
        />

        <TodayHeroCard
          statusLabel={heroState.statusLabel}
          title={heroState.title}
          body={heroState.body}
          primaryAction={heroState.primaryAction}
          onPrimaryPress={() => {
            if (heroState.primaryRoute === routes.tenDayResetPractice) {
              startTenDayReset();
            }
            router.push(heroState.primaryRoute);
          }}
          {...(heroState.primaryRoute !== routes.pauseCheckIn
            ? { onSecondaryPress: () => router.push(routes.pauseCheckIn) }
            : {})}
        />

        <TodayPathTimeline />

        <TodayGuideEntry onPress={() => router.push(routes.whatShouldIUse)} />

        <SensitiveWindowCard />
      </View>
    </AppScreen>
  );
}

type TodayHeroStateInput = {
  resetStarted: boolean;
  resetTodayCompleted: boolean;
  resetDay: number;
  protectionEnabled: boolean;
  activePlan: ActivePlan;
};

function getTodayHeroState({
  resetStarted,
  resetTodayCompleted,
  resetDay,
  protectionEnabled,
  activePlan
}: TodayHeroStateInput) {
  if (resetStarted && resetTodayCompleted) {
    return {
      statusLabel: "Today’s reset completed",
      title: "Today’s reset completed.",
      body: "Come back tomorrow and repeat the same reset.",
      primaryAction: "View saved reset",
      primaryRoute: routes.tenDayResetSaved
    };
  }

  if (resetStarted) {
    return {
      statusLabel: `10-Day Reset · Day ${resetDay} of 10`,
      title: "Start today’s reset.",
      body: "Keep today simple: no porn, no masturbation, no checking.",
      primaryAction: "Start today’s reset",
      primaryRoute: routes.tenDayResetPractice
    };
  }

  if (activePlan.recommendedFirstAction === "startReset") {
    return {
      statusLabel: activePlan.resultTitle,
      title: "Start your reset.",
      body: "Keep today simple: no porn, no masturbation, no checking.",
      primaryAction: "Start 10-Day Reset",
      primaryRoute: routes.tenDayReset
    };
  }

  if (activePlan.recommendedFirstAction === "startArousalPractice") {
    return {
      statusLabel: activePlan.resultTitle,
      title: "Practice noticing the rise earlier.",
      body: "Use guided practice to notice arousal before it feels too late.",
      primaryAction: "Start Arousal Control Practice",
      primaryRoute: routes.arousalControl
    };
  }

  if (activePlan.recommendedFirstAction === "startQuickCheckIn") {
    return {
      statusLabel: activePlan.resultTitle,
      title: "Start with a quick check-in.",
      body: "Notice what is happening without needing to label it yet.",
      primaryAction: "Start a Quick Check-In",
      primaryRoute: routes.pauseCheckIn
    };
  }

  if (protectionEnabled) {
    return {
      statusLabel: "Protection ready",
      title: "Protection is ready.",
      body: "Your pause layer is set. The next step is a short reset from pressure and checking.",
      primaryAction: "Start 10-Day Reset",
      primaryRoute: routes.tenDayReset
    };
  }

  return {
    statusLabel: null,
    title: "Create a pause before porn.",
    body: "Start by setting up Protection so there is a short pause before the automatic loop begins.",
    primaryAction: "Set up Protection",
    primaryRoute: routes.protectSetup
  };
}

type PlanHeaderProps = {
  planName: string;
  onSettingsPress: () => void;
};

function PlanHeader({ planName, onSettingsPress }: PlanHeaderProps) {
  return (
    <View style={styles.planHeader}>
      <View style={styles.planIdentity}>
        <View style={styles.avatar}>
          <View style={styles.avatarInner} />
        </View>
        <View style={styles.planCopy}>
          <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
            {activePlan.label}
          </AppText>
          <AppText variant="title" style={styles.planName}>
            {planName}
          </AppText>
        </View>
      </View>
      <AppIconButton
        accessibilityLabel="Open settings"
        icon={<AppText variant="title">⚙</AppText>}
        onPress={onSettingsPress}
        style={styles.settingsButton}
      />
    </View>
  );
}

type TodayHeroCardProps = {
  statusLabel: string | null;
  title: string;
  body: string;
  primaryAction: string;
  onPrimaryPress: () => void;
  onSecondaryPress?: () => void;
};

function TodayHeroCard({
  statusLabel,
  title,
  body,
  primaryAction,
  onPrimaryPress,
  onSecondaryPress
}: TodayHeroCardProps) {
  return (
    <AppCard style={styles.heroCard}>
      <View style={styles.heroIcon}>
        <AppText variant="title">⏸</AppText>
      </View>
      <View style={styles.heroCopy}>
        {statusLabel ? (
          <View style={styles.heroStatusPill}>
            <AppText variant="caption" tone="secondary">
              {statusLabel}
            </AppText>
          </View>
        ) : null}
        <AppText variant="heading" align="center" style={styles.heroTitle}>
          {title}
        </AppText>
        <AppText tone="secondary" align="center" style={styles.heroBody}>
          {body}
        </AppText>
      </View>
      <View style={styles.heroActions}>
        <AppButton onPress={onPrimaryPress}>{primaryAction}</AppButton>
        {onSecondaryPress ? (
          <AppButton variant="subtle" onPress={onSecondaryPress}>
            {activePlan.secondaryAction}
          </AppButton>
        ) : null}
      </View>
    </AppCard>
  );
}

function TodayPathTimeline() {
  return (
    <AppCard style={styles.pathCard}>
      <View style={styles.cardStack}>
        <AppText variant="title" style={styles.sectionTitle}>
          Today’s path
        </AppText>
        <View style={styles.timeline}>
          {todayPathSteps.map((step, index) => (
            <TodayPathStep
              key={step.title}
              number={index + 1}
              title={step.title}
              body={step.body}
              isLast={index === todayPathSteps.length - 1}
            />
          ))}
        </View>
      </View>
    </AppCard>
  );
}

type TodayPathStepProps = {
  number: number;
  title: string;
  body: string;
  isLast: boolean;
};

function TodayPathStep({ number, title, body, isLast }: TodayPathStepProps) {
  return (
    <View style={[styles.timelineRow, isLast ? styles.timelineRowLast : undefined]}>
      <View style={styles.timelineRail}>
        <View style={styles.timelineNumber}>
          <AppText variant="caption">{number}</AppText>
        </View>
        {!isLast ? <View style={styles.timelineLine} /> : null}
      </View>
      <View style={styles.timelineCopy}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {body}
        </AppText>
      </View>
    </View>
  );
}

type TodayGuideEntryProps = {
  onPress: () => void;
};

function TodayGuideEntry({ onPress }: TodayGuideEntryProps) {
  return (
    <AppCard style={styles.guideEntryCard}>
      <View style={styles.guideEntryRow}>
        <View style={styles.guideEntryCopy}>
          <AppText variant="label">Not sure what to use?</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Choose the tool based on what is happening right now.
          </AppText>
        </View>
        <AppButton variant="subtle" onPress={onPress} style={styles.guideEntryButton}>
          Open guide
        </AppButton>
      </View>
    </AppCard>
  );
}

function SensitiveWindowCard() {
  return (
    <AppCard style={styles.windowCard}>
      <View style={styles.windowHeader}>
        <View style={styles.windowIcon}>
          <AppText variant="label">☾</AppText>
        </View>
        <AppText variant="title" style={styles.windowTitle}>
          {activePlan.sensitiveWindow}
        </AppText>
      </View>
      <AppText tone="secondary">
        Empty moments and evenings may be the easiest places for the loop to start.
      </AppText>
      <View style={styles.recommendedAction}>
        <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
          RECOMMENDED ACTION
        </AppText>
        <AppText variant="label">Prepare Protection before tonight.</AppText>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 430
  },
  stack: {
    gap: theme.spacing.xl
  },
  planHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md
  },
  planIdentity: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md
  },
  avatar: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage,
    borderWidth: 1
  },
  avatarInner: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: theme.colors.sage
  },
  planCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2
  },
  eyebrow: {
    textTransform: "uppercase"
  },
  planName: {
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      web: "Georgia, serif"
    }),
    fontSize: 26,
    lineHeight: 32
  },
  settingsButton: {
    width: 46,
    height: 46,
    minWidth: 46
  },
  heroCard: {
    alignItems: "center",
    gap: theme.spacing.lg,
    borderRadius: theme.radius.xxl,
    padding: 28
  },
  heroIcon: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 29,
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage,
    borderWidth: 1
  },
  heroCopy: {
    alignItems: "center",
    gap: theme.spacing.sm
  },
  heroStatusPill: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  heroTitle: {
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      web: "Georgia, serif"
    }),
    fontSize: 31,
    lineHeight: 37
  },
  heroBody: {
    maxWidth: 300
  },
  heroActions: {
    alignSelf: "stretch",
    gap: theme.spacing.md
  },
  pathCard: {
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
  timeline: {
    gap: 0
  },
  timelineRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.lg
  },
  timelineRowLast: {
    paddingBottom: 0
  },
  timelineRail: {
    width: 32,
    alignItems: "center"
  },
  timelineNumber: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage,
    borderWidth: 1
  },
  timelineLine: {
    flex: 1,
    width: 1,
    minHeight: theme.spacing.xl,
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.border
  },
  timelineCopy: {
    flex: 1,
    gap: theme.spacing.xs,
    paddingTop: 2
  },
  guideEntryCard: {
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg
  },
  guideEntryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md
  },
  guideEntryCopy: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xs
  },
  guideEntryButton: {
    minHeight: 42,
    paddingHorizontal: theme.spacing.lg
  },
  windowCard: {
    gap: theme.spacing.lg,
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.peach,
    backgroundColor: theme.colors.peachMuted,
    marginBottom: theme.spacing.lg,
    padding: 28
  },
  windowHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md
  },
  windowIcon: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1
  },
  windowTitle: {
    flex: 1,
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      web: "Georgia, serif"
    })
  },
  recommendedAction: {
    gap: theme.spacing.xs,
    borderLeftColor: theme.colors.peach,
    borderLeftWidth: 2,
    paddingLeft: theme.spacing.md
  }
});
