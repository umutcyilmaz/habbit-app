import { Platform, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppIconButton } from "../../../shared/components/AppIconButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

const mockStartingPlan = {
  primaryPattern: "Porn Loop",
  secondaryPattern: "Pressure Pattern",
  flags: ["Firmness concern", "Evening window"] as const
};

const patternChips = [
  "Porn loop",
  "Pressure pattern",
  "Evening window",
  "Firmness concern"
] as const;

const planSteps = [
  {
    title: "Pause before porn",
    body: "Create friction before opening adult content."
  },
  {
    title: "Step away from pressure",
    body: "Avoid forced masturbation and checking for now."
  },
  {
    title: "Rebuild with practice",
    body: "Use guided practice when real desire is present."
  }
] as const;

export function OnboardingResultScreen() {
  const router = useRouter();

  return (
    <AppScreen contentStyle={styles.content}>
      <StartingPlanHeader
        onBackPress={() => router.replace(routes.home)}
        onClosePress={() => router.replace(routes.home)}
      />

      <View style={styles.stack}>
        <AppCard style={styles.heroCard}>
          <View style={styles.heroStack}>
            <View style={styles.heroCopy}>
              <AppText variant="title" style={styles.resultTitle}>
                Porn loop + pressure pattern
              </AppText>
              <AppText tone="secondary">
                Porn may be starting the loop before real desire is present, and masturbation may
                sometimes happen with pressure or rushing.
              </AppText>
            </View>

            <View style={styles.chipWrap}>
              {patternChips.map((chip) => (
                <PatternChip key={chip} label={chip} />
              ))}
            </View>
          </View>
        </AppCard>

        <AppCard style={styles.card}>
          <View style={styles.cardStack}>
            <AppText variant="title" style={styles.cardTitle}>Your first plan</AppText>
            <View style={styles.stepStack}>
              {planSteps.map((step, index) => (
                <PlanStep
                  key={step.title}
                  number={index + 1}
                  title={step.title}
                  body={step.body}
                  isLast={index === planSteps.length - 1}
                />
              ))}
            </View>
          </View>
        </AppCard>

        <AppCard style={styles.todayCard}>
          <View style={styles.cardStack}>
            <View style={styles.todayHeader}>
              <AppText variant="title" style={styles.cardTitle}>Today’s first step</AppText>
            </View>
            <AppText tone="secondary">
              Start by setting up Protection. This gives you a pause before the automatic loop
              starts.
            </AppText>
            <View style={styles.miniActions}>
              <AppButton onPress={() => router.push(routes.protectSetup)}>Set up Protection</AppButton>
              <AppButton variant="subtle" onPress={() => router.replace(routes.home)}>
                Go to Today
              </AppButton>
            </View>
          </View>
        </AppCard>
      </View>
    </AppScreen>
  );
}

type StartingPlanHeaderProps = {
  onBackPress: () => void;
  onClosePress: () => void;
};

function StartingPlanHeader({ onBackPress, onClosePress }: StartingPlanHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerTopRow}>
        <AppIconButton
          accessibilityLabel="Go back"
          icon={<AppText variant="title">‹</AppText>}
          onPress={onBackPress}
          style={styles.headerButton}
        />
        <View style={styles.headerLabelWrap}>
          <AppText variant="caption" tone="secondary" align="center" style={styles.eyebrow}>
            YOUR STARTING POINT
          </AppText>
        </View>
        <AppIconButton
          accessibilityLabel="Close starting plan"
          icon={<AppText variant="title">×</AppText>}
          onPress={onClosePress}
          style={styles.headerButton}
        />
      </View>

      <View style={styles.headerCopy}>
        <AppText variant="heading" style={styles.pageTitle}>
          Your starting point
        </AppText>
        <AppText tone="secondary" style={styles.headerSubtitle}>
          Bloom uses your answers to suggest a simple first path.
        </AppText>
      </View>
    </View>
  );
}

type PatternChipProps = {
  label: string;
};

function PatternChip({ label }: PatternChipProps) {
  return (
    <View style={styles.patternChip}>
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}

type PlanStepProps = {
  number: number;
  title: string;
  body: string;
  isLast: boolean;
};

function PlanStep({ number, title, body, isLast }: PlanStepProps) {
  return (
    <View style={[styles.stepRow, isLast ? styles.stepRowLast : undefined]}>
      <View style={styles.stepTimeline}>
        <View style={styles.stepNumber}>
          <AppText variant="caption">{number}</AppText>
        </View>
        {!isLast ? <View style={styles.stepLine} /> : null}
      </View>
      <View style={styles.stepCopy}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {body}
        </AppText>
      </View>
    </View>
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
  headerTopRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  headerLabelWrap: {
    position: "absolute",
    left: 58,
    right: 58,
    alignItems: "center"
  },
  headerButton: {
    width: 46,
    height: 46,
    minWidth: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.surface
  },
  headerCopy: {
    alignItems: "flex-start",
    gap: theme.spacing.sm
  },
  pageTitle: {
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      web: "Georgia, serif"
    }),
    fontSize: 38,
    lineHeight: 44
  },
  headerSubtitle: {
    fontSize: 18,
    lineHeight: 26
  },
  stack: {
    gap: theme.spacing.xl
  },
  heroCard: {
    position: "relative",
    borderRadius: 28,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: 28
  },
  heroStack: {
    alignItems: "stretch",
    gap: theme.spacing.lg
  },
  heroCopy: {
    gap: theme.spacing.md
  },
  resultTitle: {
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      web: "Georgia, serif"
    }),
    fontSize: 28,
    lineHeight: 34
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
    gap: theme.spacing.sm
  },
  patternChip: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.sageMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  card: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.border,
    padding: 28
  },
  cardStack: {
    gap: theme.spacing.lg
  },
  cardTitle: {
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      web: "Georgia, serif"
    })
  },
  stepStack: {
    gap: 0
  },
  stepRow: {
    flexDirection: "row",
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.lg
  },
  stepRowLast: {
    paddingBottom: 0
  },
  stepTimeline: {
    width: 32,
    alignItems: "center"
  },
  stepNumber: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 15,
    borderColor: theme.colors.peach,
    borderWidth: 1,
    backgroundColor: theme.colors.peachMuted
  },
  stepLine: {
    flex: 1,
    width: 1,
    minHeight: theme.spacing.xl,
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.border
  },
  stepCopy: {
    flex: 1,
    gap: theme.spacing.xs
  },
  todayCard: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.surface,
    padding: 28
  },
  todayHeader: {
    gap: theme.spacing.sm
  },
  miniActions: {
    gap: theme.spacing.sm
  },
  eyebrow: {
    textTransform: "uppercase"
  }
});
