import { useState } from "react";
import { useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppIconButton } from "../../../shared/components/AppIconButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type AppRoute = (typeof routes)[keyof typeof routes];

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
    body: "Avoid testing your erection or forcing arousal."
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
    body: "After the reset, rebuild with guided practice.",
    icon: "∿",
    route: routes.arousalControl
  }
] as const;

const practiceSteps = [
  "Put the phone down",
  "Relax your belly and jaw",
  "Breathe slowly for 2 minutes",
  "Let the urge pass without testing"
] as const;

const futureSteps = [
  "Start without porn",
  "Use lighter pressure",
  "Notice arousal before rushing"
] as const;

export function TenDayResetScreen() {
  const router = useRouter();
  const [resetStarted, setResetStarted] = useState(false);
  const [practiceStarted, setPracticeStarted] = useState(false);

  const startReset = () => {
    setResetStarted(true);
  };

  const startPractice = () => {
    setResetStarted(true);
    setPracticeStarted(true);
  };

  return (
    <AppScreen contentStyle={styles.content}>
      <ResetHeader
        onBackPress={() => router.back()}
        onClosePress={() => router.replace(routes.home)}
      />

      <View style={styles.stack}>
        <HeroCard started={resetStarted} onStartPress={startReset} />
        <ResetRulesCard />
        <ReplacementActionsCard
          onRoutePress={(route) => {
            router.push(route);
          }}
        />
        <TodayPracticeCard started={practiceStarted} onStartPress={startPractice} />
        <AfterResetCard onPracticePress={() => router.push(routes.arousalControl)} />

        <View style={styles.bottomActions}>
          <AppButton onPress={startReset}>
            {resetStarted ? "Today’s reset is open" : "Start today’s reset"}
          </AppButton>
          <AppButton variant="subtle" onPress={() => router.replace(routes.home)}>
            Back to Today
          </AppButton>
        </View>
      </View>
    </AppScreen>
  );
}

type ResetHeaderProps = {
  onBackPress: () => void;
  onClosePress: () => void;
};

function ResetHeader({ onBackPress, onClosePress }: ResetHeaderProps) {
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
            RESET PLAN
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
          10-Day Reset
        </AppText>
        <AppText tone="secondary" align="center" style={styles.subtitle}>
          Step away from pressure, porn, and checking so you can rebuild with more awareness.
        </AppText>
      </View>
    </View>
  );
}

type HeroCardProps = {
  started: boolean;
  onStartPress: () => void;
};

function HeroCard({ started, onStartPress }: HeroCardProps) {
  return (
    <AppCard style={styles.heroCard}>
      <View style={styles.heroCopy}>
        <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
          DAY 1 OF 10
        </AppText>
        <AppText variant="title" style={styles.heroTitle}>
          Start by creating a clean pause from the pattern.
        </AppText>
        <AppText tone="secondary">
          For today, the reset means no porn, no masturbation, and no erection testing.
        </AppText>
      </View>

      <ResetProgressRow />

      {started ? (
        <View style={styles.startedNote}>
          <AppText variant="label">Today’s reset is open.</AppText>
          <AppText variant="bodySmall" tone="secondary">
            Begin with the 2-minute breathing reset when you are ready.
          </AppText>
        </View>
      ) : null}

      <AppButton onPress={onStartPress}>Start today’s reset</AppButton>
    </AppCard>
  );
}

function ResetProgressRow() {
  return (
    <View style={styles.progressRow} accessibilityRole="image">
      {Array.from({ length: 10 }, (_, index) => (
        <View
          key={index}
          style={[styles.progressSegment, index === 0 ? styles.progressSegmentActive : undefined]}
        />
      ))}
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
        <View style={styles.rowStack}>
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
    <View style={styles.actionRowContent}>
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
    </View>
  );

  if (!isTappable) {
    return <View style={styles.actionRow}>{content}</View>;
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onRoutePress(route)}
      style={({ pressed }) => [styles.actionRow, pressed ? styles.actionRowPressed : undefined]}
    >
      {content}
    </Pressable>
  );
}

type TodayPracticeCardProps = {
  started: boolean;
  onStartPress: () => void;
};

function TodayPracticeCard({ started, onStartPress }: TodayPracticeCardProps) {
  return (
    <AppCard style={styles.practiceCard}>
      <View style={styles.cardStack}>
        <View style={styles.practiceHeader}>
          <AppText variant="title" style={styles.sectionTitle}>
            Today’s practice
          </AppText>
          <View style={styles.practicePill}>
            <AppText variant="caption" tone="secondary">
              2 minutes
            </AppText>
          </View>
        </View>
        <AppText variant="label">2-minute breathing reset</AppText>
        <View style={styles.stepStack}>
          {practiceSteps.map((step, index) => (
            <View key={step} style={styles.practiceStep}>
              <AppText variant="caption" tone="secondary">
                {index + 1}
              </AppText>
              <AppText variant="bodySmall">{step}</AppText>
            </View>
          ))}
        </View>
        {started ? (
          <AppText variant="bodySmall" tone="secondary">
            Start simply. Let these two minutes create space before the next choice.
          </AppText>
        ) : null}
        <AppButton variant="subtle" onPress={onStartPress}>
          Start 2-minute reset
        </AppButton>
      </View>
    </AppCard>
  );
}

type AfterResetCardProps = {
  onPracticePress: () => void;
};

function AfterResetCard({ onPracticePress }: AfterResetCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.cardStack}>
        <View style={styles.afterHeader}>
          <AppText variant="title" style={styles.sectionTitle}>
            After the reset
          </AppText>
          <AppText tone="secondary">
            When real desire is present, use controlled practice to rebuild with less pressure and
            more awareness.
          </AppText>
        </View>
        <View style={styles.futureStepWrap}>
          {futureSteps.map((step) => (
            <View key={step} style={styles.futureStep}>
              <AppText variant="bodySmall">{step}</AppText>
            </View>
          ))}
        </View>
        <AppButton variant="subtle" onPress={onPracticePress}>
          View Arousal Control Practice
        </AppButton>
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
  startedNote: {
    gap: theme.spacing.xs,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted,
    padding: theme.spacing.lg
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
    gap: theme.spacing.md
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
  actionRow: {
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg
  },
  actionRowPressed: {
    backgroundColor: theme.colors.surfaceMuted
  },
  actionRowContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md
  },
  iconCircle: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage,
    borderWidth: 1
  },
  practiceCard: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted,
    padding: 28
  },
  practiceHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md
  },
  practicePill: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.border,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  stepStack: {
    gap: theme.spacing.sm
  },
  practiceStep: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  afterHeader: {
    gap: theme.spacing.sm
  },
  futureStepWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  futureStep: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  bottomActions: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg
  }
});
