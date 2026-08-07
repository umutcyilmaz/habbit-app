import { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useFocusEffect, useRouter } from "expo-router";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import {
  getNextBloomAction,
  type NextBloomAction
} from "../../../domain/journey/getNextBloomAction";
import { getNextBloomActionLabel } from "../../../domain/journey/nextBloomActionPresentation";
import { AppButton } from "../../../shared/components/v4/AppButton";
import { AppCard } from "../../../shared/components/v4/AppCard";
import { AppIconButton } from "../../../shared/components/v4/AppIconButton";
import { AppScreen } from "../../../shared/components/v4/AppScreen";
import { AppText } from "../../../shared/components/v4/AppText";
import { ScreenHeader } from "../../../shared/components/v4/ScreenHeader";
import { theme } from "../../../shared/design-system/v4/theme";

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

// TODO: replace temporary glyphs with Bloom V4 SVG icons when the icon system lands.

export function TodayScreen() {
  const router = useRouter();
  const { state, todayKey, resetDay } = useBloomLocalState();
  const nextAction = getNextBloomAction(state, todayKey);
  const heroState = getTodayHeroState({
    action: nextAction,
    resultTitle: state.activePlan.resultTitle,
    resetDay
  });

  const [isFocused, setIsFocused] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setIsFocused(true);
      return () => setIsFocused(false);
    }, [])
  );

  return (
    <>
      {isFocused ? <StatusBar style="light" /> : null}
      <AppScreen scroll contentContainerStyle={styles.content}>
        <ScreenHeader title="Today" />

        <PlanHeader
          planName={state.activePlan.planName}
          onSettingsPress={() => router.push(routes.settings)}
        />

        <TodayHeroCard
          statusLabel={heroState.statusLabel}
          title={heroState.title}
          body={heroState.body}
          primaryAction={heroState.primaryAction}
          onPrimaryPress={() => router.push(heroState.primaryRoute)}
          {...(nextAction.id !== "startQuickCheckIn"
            ? { onSecondaryPress: () => router.push(routes.pauseCheckIn) }
            : {})}
        />

        <TodayPathTimeline />

        <TodayGuideEntry onPress={() => router.push(routes.whatShouldIUse)} />

        <SensitiveWindowCard />
      </AppScreen>
    </>
  );
}

type TodayHeroStateInput = {
  action: NextBloomAction;
  resultTitle: string;
  resetDay: number;
};

function getTodayHeroState({
  action,
  resultTitle,
  resetDay
}: TodayHeroStateInput) {
  const primaryAction = getNextBloomActionLabel(action);

  switch (action.id) {
    case "completeOnboarding":
      return {
        statusLabel: null,
        title: "Complete your starting point.",
        body: "Answer a few personal questions so Bloom can suggest a simple first path.",
        primaryAction,
        primaryRoute: action.route
      };
    case "startQuickCheckIn":
      return {
        statusLabel: resultTitle,
        title: "Start with a quick check-in.",
        body: "Notice what is happening without needing to label it yet.",
        primaryAction,
        primaryRoute: action.route
      };
    case "setupProtection":
      return {
        statusLabel: resultTitle,
        title: "Create a pause before porn.",
        body: "Start by setting up Protection so there is a short pause before the automatic loop begins.",
        primaryAction,
        primaryRoute: action.route
      };
    case "resumeProtection":
      return {
        statusLabel: "Protection paused",
        title: "Resume your pause plan.",
        body: "Your saved Protection settings are still available inside Bloom.",
        primaryAction,
        primaryRoute: action.route
      };
    case "startReset":
      return action.reason === "protectionReady"
        ? {
            statusLabel: "Protection ready",
            title: "Protection is ready.",
            body: "Your pause layer is set. The next step is a short reset from pressure and checking.",
            primaryAction,
            primaryRoute: action.route
          }
        : {
            statusLabel: resultTitle,
            title: "Start your reset.",
            body: "Keep today simple: no porn, no masturbation, no checking.",
            primaryAction,
            primaryRoute: action.route
          };
    case "completeTodayReset":
      return {
        statusLabel: `10-Day Reset · Day ${resetDay} of 10`,
        title: "Continue today’s reset.",
        body: "Keep today simple: no porn, no masturbation, no checking.",
        primaryAction,
        primaryRoute: action.route
      };
    case "viewTodayReset":
      return {
        statusLabel: "Today’s reset saved",
        title: "Today’s reset is saved.",
        body: "You can review today’s saved reset or keep the day simple.",
        primaryAction,
        primaryRoute: action.route
      };
    case "startArousalPractice":
      return {
        statusLabel: action.reason === "resetProgramComplete" ? "10-Day Reset complete" : resultTitle,
        title: "Practice noticing the rise earlier.",
        body: "Use guided practice to notice arousal before it feels too late.",
        primaryAction,
        primaryRoute: action.route
      };
    case "viewPracticeProgress":
      return {
        statusLabel: "Practice saved",
        title: "Review your latest practice.",
        body: "Your saved practice is ready to review as personal context.",
        primaryAction,
        primaryRoute: action.route
      };
  }
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
          <AppText variant="overline" tone="muted">
            {activePlan.label}
          </AppText>
          <AppText variant="title" tone="primary">
            {planName}
          </AppText>
        </View>
      </View>
      <AppIconButton
        accessibilityLabel="Open settings"
        icon={<AppText variant="heading1">⚙</AppText>}
        onPress={onSettingsPress}
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
    <AppCard variant="hero" style={styles.heroCard}>
      <View style={styles.heroIcon}>
        <AppText variant="heading1">⏸</AppText>
      </View>
      <View style={styles.heroCopy}>
        {statusLabel ? (
          <View style={styles.heroStatusPill}>
            <AppText variant="labelSmall" tone="muted">
              {statusLabel}
            </AppText>
          </View>
        ) : null}
        <AppText variant="display" tone="primary" style={styles.heroTitle}>
          {title}
        </AppText>
        <AppText variant="body" tone="secondary" style={styles.heroBody}>
          {body}
        </AppText>
      </View>
      <View style={styles.heroActions}>
        <AppButton
          testID="bloom.today.primary-action"
          variant="primary"
          label={primaryAction}
          onPress={onPrimaryPress}
        />
        {onSecondaryPress ? (
          <AppButton
            variant="secondary"
            label={activePlan.secondaryAction}
            onPress={onSecondaryPress}
          />
        ) : null}
      </View>
    </AppCard>
  );
}

function TodayPathTimeline() {
  return (
    <AppCard variant="standard">
      <View style={styles.cardStack}>
        <AppText variant="title" tone="primary">
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
        <AppText variant="titleSmall" tone="primary">
          {title}
        </AppText>
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
    <AppCard variant="standard" style={styles.guideEntryCard}>
      <View style={styles.guideEntryCopy}>
        <AppText variant="titleSmall" tone="primary">
          Not sure what to use?
        </AppText>
        <AppText variant="bodySmall" tone="secondary">
          Choose the tool based on what is happening right now.
        </AppText>
      </View>
      <AppButton variant="ghost" label="Open guide" onPress={onPress} />
    </AppCard>
  );
}

function SensitiveWindowCard() {
  return (
    <AppCard variant="standard" style={styles.windowCard}>
      <View style={styles.windowHeader}>
        <View style={styles.windowIcon}>
          <AppText variant="heading1">☾</AppText>
        </View>
        <AppText variant="title" tone="primary" style={styles.windowTitle}>
          {activePlan.sensitiveWindow}
        </AppText>
      </View>
      <AppText variant="body" tone="secondary">
        Empty moments and evenings may be the easiest places for the loop to start.
      </AppText>
      <View style={styles.recommendedAction}>
        <AppText variant="overline" tone="warning">
          RECOMMENDED ACTION
        </AppText>
        <AppText variant="titleSmall" tone="primary">
          Prepare Protection before tonight.
        </AppText>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: theme.spacing.layout.sectionGap
  },
  planHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md,
    justifyContent: "space-between"
  },
  planIdentity: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
    gap: theme.spacing.md,
    minWidth: 0
  },
  avatar: {
    alignItems: "center",
    backgroundColor: theme.colors.bg.surfaceElevated,
    borderColor: theme.colors.border.strong,
    borderRadius: theme.radius.pill,
    borderWidth: theme.size.stroke.hairline,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  avatarInner: {
    backgroundColor: theme.colors.accent.primary,
    borderRadius: theme.radius.pill,
    height: 18,
    width: 18
  },
  planCopy: {
    flex: 1,
    gap: theme.spacing.xs,
    minWidth: 0
  },
  heroCard: {
    alignItems: "center",
    gap: theme.spacing.lg
  },
  heroIcon: {
    alignItems: "center",
    backgroundColor: theme.colors.bg.surfaceElevated,
    borderColor: theme.colors.border.strong,
    borderRadius: theme.radius.pill,
    borderWidth: theme.size.stroke.hairline,
    height: theme.size.control.lg,
    justifyContent: "center",
    width: theme.size.control.lg
  },
  heroCopy: {
    alignItems: "center",
    gap: theme.spacing.sm
  },
  heroStatusPill: {
    backgroundColor: theme.colors.bg.surfaceElevated,
    borderColor: theme.colors.border.strong,
    borderRadius: theme.radius.pill,
    borderWidth: theme.size.stroke.hairline,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  heroTitle: {
    textAlign: "center"
  },
  heroBody: {
    textAlign: "center"
  },
  heroActions: {
    alignSelf: "stretch",
    gap: theme.spacing.md
  },
  cardStack: {
    gap: theme.spacing.lg
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
    alignItems: "center",
    width: 32
  },
  timelineNumber: {
    alignItems: "center",
    backgroundColor: theme.colors.bg.surfaceElevated,
    borderColor: theme.colors.border.strong,
    borderRadius: theme.radius.pill,
    borderWidth: theme.size.stroke.hairline,
    height: 30,
    justifyContent: "center",
    width: 30
  },
  timelineLine: {
    backgroundColor: theme.colors.border.default,
    flex: 1,
    marginTop: theme.spacing.xs,
    minHeight: theme.spacing.xl,
    width: 1
  },
  timelineCopy: {
    flex: 1,
    gap: theme.spacing.xs,
    paddingTop: 2
  },
  guideEntryCard: {
    gap: theme.spacing.sm
  },
  guideEntryCopy: {
    flex: 1,
    gap: theme.spacing.xs,
    minWidth: 0
  },
  windowCard: {
    backgroundColor: theme.colors.bg.warningSubtle,
    borderColor: theme.colors.border.warning,
    borderWidth: theme.size.stroke.hairline,
    gap: theme.spacing.sm
  },
  windowHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md
  },
  windowIcon: {
    alignItems: "center",
    backgroundColor: theme.colors.bg.surfaceElevated,
    borderColor: theme.colors.border.strong,
    borderRadius: theme.radius.pill,
    borderWidth: theme.size.stroke.hairline,
    height: theme.size.badge.sm,
    justifyContent: "center",
    width: theme.size.badge.sm
  },
  windowTitle: {
    flex: 1
  },
  recommendedAction: {
    borderLeftColor: theme.colors.border.warning,
    borderLeftWidth: 2,
    gap: theme.spacing.xs,
    paddingLeft: theme.spacing.md
  }
});
