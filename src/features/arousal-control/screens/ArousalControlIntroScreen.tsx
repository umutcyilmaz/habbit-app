import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { ArousalControlFlowHeader } from "../components/ArousalControlFlowHeader";
import { ArousalInfoRow } from "../components/ArousalInfoRow";

const infoRows = [
  {
    title: "No duration goal",
    body: "There is no target time to reach.",
    icon: "○"
  },
  {
    title: "Pause is the practice",
    body: "Stopping for a short moment is the skill.",
    icon: "Ⅱ"
  },
  {
    title: "Firmness changes are okay",
    body: "If firmness decreases during a pause, you can continue gently or finish today.",
    icon: "∿"
  },
  {
    title: "Duration is only a trend",
    body: "You can log optional duration later, without judging it as good or bad.",
    icon: "↝"
  }
] as const;

export function ArousalControlIntroScreen() {
  const router = useRouter();
  const [showHowItWorks, setShowHowItWorks] = useState(false);

  return (
    <AppScreen contentStyle={styles.content}>
      <ArousalControlFlowHeader
        label="Arousal Control"
        title="Notice the rise earlier."
        subtitle="This practice helps you recognize your arousal level, pause before things feel automatic, and continue more mindfully if you choose."
        onBackPress={() => router.replace(routes.exercises)}
        onClosePress={() => router.replace(routes.exercises)}
      />

      <View style={styles.stack}>
        <AppCard style={styles.heroCard}>
          <View style={styles.heroStack}>
            <View style={styles.visual}>
              <View style={styles.visualInner}>
                <AppText variant="title">∿</AppText>
              </View>
            </View>

            <View style={styles.copy}>
              <AppText variant="title">Practice awareness, not pressure.</AppText>
              <AppText tone="secondary">
                The aim is noticing your body response earlier, then choosing a pause zone with no
                judgment.
              </AppText>
            </View>

            <View style={styles.actions}>
              <AppButton onPress={() => router.push(routes.arousalControlMode)}>
                Start Practice
              </AppButton>
              <AppButton variant="secondary" onPress={() => setShowHowItWorks(true)}>
                Learn how it works
              </AppButton>
            </View>
          </View>
        </AppCard>

        {showHowItWorks ? (
          <View style={styles.hint}>
            <AppText variant="bodySmall" tone="secondary" align="center">
              The cards below show what this first practice is designed to support: choice,
              steadiness, and no judgment.
            </AppText>
          </View>
        ) : null}

        <View style={styles.infoStack}>
          {infoRows.map((row) => (
            <ArousalInfoRow key={row.title} title={row.title} body={row.body} icon={row.icon} />
          ))}
        </View>

        <View style={styles.reassurance}>
          <AppText variant="bodySmall" tone="secondary" align="center">
            You can stop anytime. This is not a test.
          </AppText>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 430
  },
  stack: {
    gap: theme.spacing.xl
  },
  heroCard: {
    borderRadius: 26,
    borderColor: theme.colors.lavenderDeep,
    backgroundColor: theme.colors.lavender,
    padding: theme.spacing.xl
  },
  heroStack: {
    alignItems: "center",
    gap: theme.spacing.lg
  },
  visual: {
    width: 136,
    height: 136,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 68,
    borderColor: theme.colors.lavenderDeep,
    borderWidth: 1,
    backgroundColor: theme.colors.surface
  },
  visualInner: {
    width: 86,
    height: 86,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 43,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted
  },
  copy: {
    alignSelf: "stretch",
    gap: theme.spacing.sm
  },
  actions: {
    alignSelf: "stretch",
    gap: theme.spacing.sm
  },
  hint: {
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md
  },
  infoStack: {
    gap: theme.spacing.md
  },
  reassurance: {
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.peach,
    borderWidth: 1,
    backgroundColor: theme.colors.peachMuted,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md
  }
});
