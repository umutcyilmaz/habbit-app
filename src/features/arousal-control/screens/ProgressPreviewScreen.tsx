import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { ArousalControlFlowHeader } from "../components/ArousalControlFlowHeader";

export function ProgressPreviewScreen() {
  const router = useRouter();

  return (
    <AppScreen contentStyle={styles.content}>
      <ArousalControlFlowHeader
        label="PROGRESS PREVIEW"
        title="Progress Preview"
        subtitle="A quiet reflection on your recent practice sessions. Notice the shifts in your awareness and control."
        onBackPress={() => router.replace(routes.arousalControlSaved)}
        onClosePress={() => router.replace(routes.exercises)}
      />

      <View style={styles.stack}>
        <ControlFeelingHeroCard />

        <PreviewMetricCard
          icon="Ⅱ"
          label="PAUSES TAKEN"
          value="1"
          valueDetail="pause this practice"
          helper="A moment caught before continuing."
        />

        <PreviewMetricCard
          icon="◉"
          label="PEAK AWARENESS"
          value="7 /10"
          helper="Highest arousal level noticed before pausing in this practice."
          tone="peach"
        />

        <PhysicalResponseCard />
        <InternalPacingCard />
        <DurationContextCard />
        <CoachInsightCard />

        <View style={styles.actions}>
          <AppButton onPress={() => router.replace(routes.home)}>Back to Today</AppButton>
          <AppButton variant="subtle" onPress={() => router.replace(routes.progress)}>
            View overall progress
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.replace(routes.arousalControl)}>
            Start another practice
          </AppButton>
        </View>
      </View>
    </AppScreen>
  );
}

function ControlFeelingHeroCard() {
  return (
    <AppCard style={styles.controlCard}>
      <View style={styles.cardTopRow}>
        <IconLabel icon="≋" label="CONTROL FEELING" />
        <View style={styles.sageBadge}>
          <AppText variant="caption">Improving</AppText>
        </View>
      </View>

      <View style={styles.controlCopy}>
        <AppText variant="heading" style={styles.controlTitle}>
          Perceived sense of regulation
        </AppText>
      </View>

      <ControlFeelingComparison />
    </AppCard>
  );
}

function ControlFeelingComparison() {
  return (
    <View style={styles.comparisonPanel}>
      <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
        Recent practice
      </AppText>

      <View style={styles.comparisonRow}>
        <ComparisonValue label="Before pause" value="4/10" />
        <View style={styles.comparisonArrow}>
          <AppText variant="bodySmall" tone="secondary">
            →
          </AppText>
        </View>
        <ComparisonValue label="After pause" value="6/10" emphasized />
      </View>

      <View style={styles.comparisonInsight}>
        <AppText variant="bodySmall">Created more space before continuing.</AppText>
      </View>
    </View>
  );
}

type ComparisonValueProps = {
  label: string;
  value: string;
  emphasized?: boolean;
};

function ComparisonValue({ label, value, emphasized = false }: ComparisonValueProps) {
  return (
    <View style={[styles.comparisonValue, emphasized ? styles.comparisonValueEmphasized : undefined]}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText variant="heading" style={styles.comparisonNumber}>
        {value}
      </AppText>
    </View>
  );
}

type PreviewMetricCardProps = {
  icon: string;
  label: string;
  value: string;
  valueDetail?: string;
  helper: string;
  tone?: "peach";
};

function PreviewMetricCard({
  icon,
  label,
  value,
  valueDetail,
  helper,
  tone
}: PreviewMetricCardProps) {
  return (
    <AppCard style={[styles.metricCard, tone === "peach" ? styles.peakCard : undefined]}>
      <IconLabel icon={icon} label={label} {...(tone !== undefined ? { tone } : {})} />
      <View style={styles.metricValueGroup}>
        <AppText variant="heading" style={styles.metricValue}>
          {value}
        </AppText>
        {valueDetail ? (
          <AppText variant="bodySmall" tone="secondary">
            {valueDetail}
          </AppText>
        ) : null}
      </View>
      <View style={styles.metricRule} />
      <AppText variant="bodySmall" tone="secondary">
        {helper}
      </AppText>
    </AppCard>
  );
}

function PhysicalResponseCard() {
  return (
    <AppCard style={styles.infoCard}>
      <View style={styles.cardTopRow}>
        <IconLabel icon="○" label="PHYSICAL RESPONSE" />
        <View style={styles.sageBadge}>
          <AppText variant="caption">Normal response</AppText>
        </View>
      </View>

      <View style={styles.infoCopy}>
        <AppText variant="label" style={styles.responseTitle}>
          Firmness changed during pause
        </AppText>
        <View style={styles.responseLine}>
          <View style={styles.responseLineFill} />
        </View>
        <AppText variant="bodySmall" tone="secondary">
          A change during pause can still give useful information.
        </AppText>
      </View>
    </AppCard>
  );
}

function InternalPacingCard() {
  return (
    <AppCard style={styles.infoCard}>
      <IconLabel icon="↘" label="INTERNAL PACING" />
      <View style={styles.pacingRow}>
        <View style={styles.infoCopy}>
          <AppText variant="label" style={styles.responseTitle}>
            Sense of rushing
          </AppText>
          <AppText variant="bodySmall" tone="secondary">
            Next practice can focus on slowing down earlier.
          </AppText>
        </View>
        <View style={styles.neutralBadge}>
          <AppText variant="caption">Medium</AppText>
        </View>
      </View>
    </AppCard>
  );
}

function DurationContextCard() {
  return (
    <View style={styles.durationCard}>
      <IconLabel icon="◷" label="Session Duration" neutral />
      <AppText variant="label">Prefer not to log</AppText>
      <AppText variant="caption" tone="secondary">
        Duration is private context, not a score. Focus on awareness, not time.
      </AppText>
    </View>
  );
}

function CoachInsightCard() {
  return (
    <AppCard style={styles.coachCard}>
      <View style={styles.coachAccent} />
      <View style={styles.coachCopy}>
        <IconLabel icon="✦" label="Coach Insight" neutral />
        <AppText tone="secondary">
          You noticed your pause zone around 7/10. Recognizing this point is a useful step in
          learning your body’s response.
        </AppText>
      </View>
    </AppCard>
  );
}

type IconLabelProps = {
  icon: string;
  label: string;
  tone?: "peach";
  neutral?: boolean;
};

function IconLabel({ icon, label, tone, neutral = false }: IconLabelProps) {
  return (
    <View style={styles.iconLabel}>
      <View
        style={[
          styles.iconCircle,
          tone === "peach" ? styles.iconCirclePeach : undefined,
          neutral ? styles.iconCircleNeutral : undefined
        ]}
      >
        <AppText variant="caption">{icon}</AppText>
      </View>
      <AppText variant="caption" tone="secondary" style={styles.eyebrow}>
        {label}
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
  controlCard: {
    minHeight: 320,
    gap: theme.spacing.xl,
    borderRadius: 30,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md
  },
  iconLabel: {
    minWidth: 0,
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.sm
  },
  iconCircle: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 17,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted
  },
  iconCirclePeach: {
    borderColor: theme.colors.peach,
    backgroundColor: theme.colors.surface
  },
  iconCircleNeutral: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surfaceMuted
  },
  eyebrow: {
    textTransform: "uppercase"
  },
  sageBadge: {
    flexShrink: 0,
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  controlCopy: {
    gap: theme.spacing.sm
  },
  controlTitle: {
    fontSize: 34,
    lineHeight: 40
  },
  comparisonPanel: {
    gap: theme.spacing.md,
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.lg
  },
  comparisonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.sm
  },
  comparisonValue: {
    flex: 1,
    minHeight: 96,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.xs,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.md
  },
  comparisonValueEmphasized: {
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted
  },
  comparisonNumber: {
    fontSize: 34,
    lineHeight: 40
  },
  comparisonArrow: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface
  },
  comparisonInsight: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  metricCard: {
    gap: theme.spacing.md,
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg
  },
  peakCard: {
    borderColor: theme.colors.peach,
    backgroundColor: theme.colors.peachMuted
  },
  metricValueGroup: {
    gap: 2
  },
  metricValue: {
    fontSize: 48,
    lineHeight: 54
  },
  metricRule: {
    height: 1,
    backgroundColor: theme.colors.border
  },
  infoCard: {
    gap: theme.spacing.md,
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.lg
  },
  infoCopy: {
    flex: 1,
    gap: theme.spacing.sm
  },
  responseTitle: {
    fontSize: 18,
    lineHeight: 24
  },
  responseLine: {
    height: 6,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    overflow: "hidden"
  },
  responseLineFill: {
    width: "56%",
    height: "100%",
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.sage
  },
  pacingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md
  },
  neutralBadge: {
    flexShrink: 0,
    borderRadius: theme.radius.pill,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs
  },
  durationCard: {
    gap: theme.spacing.sm,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg
  },
  coachCard: {
    flexDirection: "row",
    gap: theme.spacing.lg,
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    ...theme.shadows.card
  },
  coachAccent: {
    width: 4,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.sage
  },
  coachCopy: {
    flex: 1,
    gap: theme.spacing.sm
  },
  actions: {
    gap: theme.spacing.sm
  }
});
