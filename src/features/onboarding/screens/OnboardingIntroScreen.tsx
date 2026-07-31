import { useRouter } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppIconButton } from "../../../shared/components/AppIconButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

const focusRows = [
  "Automatic porn loops",
  "Pressure or rushing patterns",
  "Arousal and control awareness"
] as const;

export function OnboardingIntroScreen() {
  const router = useRouter();

  return (
    <AppScreen contentStyle={styles.content}>
      <View style={styles.headerRow}>
        <View style={styles.headerSpacer} />
        <AppText variant="title" align="center" style={styles.wordmark}>
          Bloom
        </AppText>
        <AppIconButton
          accessibilityLabel="Close onboarding"
          icon={<AppText variant="title">×</AppText>}
          onPress={() => router.replace(routes.home)}
          style={styles.closeButton}
        />
      </View>

      <View style={styles.stack}>
        <View style={styles.titleBlock}>
          <AppText variant="heading" align="center" style={styles.title}>
            Let’s find your starting point.
          </AppText>
          <AppText tone="secondary" align="center" style={styles.subtitle}>
            Answer a few private questions so Bloom can suggest a simple first path.
          </AppText>
        </View>

        <AppCard style={styles.card}>
          <View style={styles.cardStack}>
            <AppText variant="title" style={styles.cardTitle}>
              What Bloom looks for
            </AppText>
            <View style={styles.rowStack}>
              {focusRows.map((row) => (
                <View key={row} style={styles.focusRow}>
                  <View style={styles.focusDot} />
                  <AppText variant="bodySmall" style={styles.focusText}>
                    {row}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        </AppCard>

        <View style={styles.privacyNote}>
          <AppText variant="bodySmall" tone="secondary" align="center">
            Your answers stay private on this device.
          </AppText>
        </View>

        <View style={styles.actions}>
          <AppButton
            testID="bloom.onboarding.start"
            onPress={() => router.push(routes.onboardingQuiz)}
          >
            Start
          </AppButton>
          <AppText variant="bodySmall" tone="secondary" align="center">
            Takes about 2 minutes
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
  headerRow: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: theme.spacing.xl
  },
  headerSpacer: {
    width: 46,
    height: 46
  },
  wordmark: {
    fontFamily: Platform.select({
      ios: "Georgia",
      android: "serif",
      web: "Georgia, serif"
    })
  },
  closeButton: {
    width: 46,
    height: 46,
    minWidth: 46,
    borderRadius: 23,
    backgroundColor: theme.colors.surface
  },
  stack: {
    gap: theme.spacing.xl
  },
  titleBlock: {
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
    fontSize: 18,
    lineHeight: 26
  },
  card: {
    borderRadius: 28,
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
  rowStack: {
    gap: theme.spacing.md
  },
  focusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md
  },
  focusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.sage
  },
  focusText: {
    flex: 1
  },
  privacyNote: {
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    padding: theme.spacing.md
  },
  actions: {
    gap: theme.spacing.md
  }
});
