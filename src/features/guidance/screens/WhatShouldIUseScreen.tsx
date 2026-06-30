import { useRouter } from "expo-router";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppIconButton } from "../../../shared/components/AppIconButton";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type AppRoute = (typeof routes)[keyof typeof routes];

type AvailableGuidanceCard = {
  situation: string;
  tool: string;
  helper: string;
  icon: string;
  status: "available";
  route: AppRoute;
};

type ComingSoonGuidanceCard = {
  situation: string;
  tool: string;
  helper: string;
  icon: string;
  status: "comingSoon";
};

type GuidanceCardConfig = AvailableGuidanceCard | ComingSoonGuidanceCard;

const guidanceCards: readonly GuidanceCardConfig[] = [
  {
    situation: "If you are about to open porn",
    tool: "Use Protection or 90-Second Pause",
    helper: "Create friction before the loop starts.",
    icon: "Ⅱ",
    status: "available",
    route: routes.protectSetup
  },
  {
    situation: "If it feels automatic or boring",
    tool: "Use Quick Check-In",
    helper: "Notice the trigger before acting.",
    icon: "✓",
    status: "available",
    route: routes.pauseCheckIn
  },
  {
    situation: "If you want to practice controlled masturbation",
    tool: "Use Arousal Control Practice",
    helper: "Practice noticing the rise earlier.",
    icon: "∿",
    status: "available",
    route: routes.arousalControl
  },
  {
    situation: "If you are resetting pressure-based habits",
    tool: "Use 10-Day Reset",
    helper: "Step away from pressure and checking for now.",
    icon: "↻",
    status: "available",
    route: routes.tenDayReset
  },
  {
    situation: "If you feel rushing or tension",
    tool: "Use Pelvic Relaxation",
    helper: "Slow down and release tension first.",
    icon: "◌",
    status: "comingSoon"
  },
  {
    situation: "If you want to see what changed",
    tool: "Use Progress",
    helper: "Review patterns and recent practice signals.",
    icon: "↗",
    status: "available",
    route: routes.progress
  }
] as const;

export function WhatShouldIUseScreen() {
  const router = useRouter();
  const { state } = useBloomLocalState();

  return (
    <AppScreen contentStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.headerActions}>
          <AppIconButton
            accessibilityLabel="Go back"
            icon={<AppText variant="title">‹</AppText>}
            onPress={() => router.back()}
            style={styles.headerButton}
          />
          <View style={styles.headerLabelWrap}>
            <AppText variant="caption" tone="secondary" align="center" style={styles.eyebrow}>
              GUIDE
            </AppText>
          </View>
          <AppIconButton
            accessibilityLabel="Close guide"
            icon={<AppText variant="title">×</AppText>}
            onPress={() => router.replace(routes.home)}
            style={styles.headerButton}
          />
        </View>

        <View style={styles.titleBlock}>
          <AppText variant="heading" align="center" style={styles.title}>
            What should I use?
          </AppText>
          <AppText tone="secondary" align="center" style={styles.subtitle}>
            Choose the tool based on what is happening right now.
          </AppText>
        </View>
      </View>

      <View style={styles.cardStack}>
        {guidanceCards.map((card) => (
          <GuidanceCard
            key={card.tool}
            card={card}
            onPress={() => {
              if (card.status === "available") {
                router.push(getGuidanceRoute(card.route, state.protection.isEnabled));
              }
            }}
          />
        ))}
      </View>

      <View style={styles.bottomAction}>
        <AppButton variant="subtle" onPress={() => router.replace(routes.home)}>
          Back to Today
        </AppButton>
      </View>
    </AppScreen>
  );
}

function getGuidanceRoute(route: AppRoute, protectionEnabled: boolean): AppRoute {
  if (route === routes.protectSetup && protectionEnabled) {
    return routes.protectActive;
  }

  return route;
}

type GuidanceCardProps = {
  card: GuidanceCardConfig;
  onPress: () => void;
};

function GuidanceCard({ card, onPress }: GuidanceCardProps) {
  const isComingSoon = card.status === "comingSoon";

  return (
    <Pressable
      accessibilityRole={isComingSoon ? undefined : "button"}
      disabled={isComingSoon}
      onPress={onPress}
      style={({ pressed }) => (pressed && !isComingSoon ? styles.pressedCard : undefined)}
    >
      <AppCard style={[styles.guidanceCard, isComingSoon ? styles.guidanceCardDisabled : undefined]}>
        <View style={styles.cardRow}>
          <View style={[styles.iconCircle, isComingSoon ? styles.iconCircleMuted : undefined]}>
            <AppText variant="label">{card.icon}</AppText>
          </View>

          <View style={styles.cardCopy}>
            <AppText variant="bodySmall" tone="secondary">
              {card.situation}
            </AppText>
            <AppText variant="label" style={styles.toolTitle}>
              {card.tool}
            </AppText>
            <AppText variant="bodySmall" tone="secondary">
              {card.helper}
            </AppText>
          </View>

          <View style={styles.cardAffordance}>
            {isComingSoon ? (
              <ComingSoonPill />
            ) : (
              <AppText variant="title" tone="secondary">›</AppText>
            )}
          </View>
        </View>
      </AppCard>
    </Pressable>
  );
}

function ComingSoonPill() {
  return (
    <View style={styles.comingSoonPill}>
      <AppText variant="caption" tone="secondary">
        Coming soon
      </AppText>
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
    fontSize: 38,
    lineHeight: 44
  },
  subtitle: {
    maxWidth: 320
  },
  cardStack: {
    gap: theme.spacing.md
  },
  pressedCard: {
    opacity: 0.86
  },
  guidanceCard: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.lg
  },
  guidanceCardDisabled: {
    opacity: 0.72
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md
  },
  iconCircle: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 21,
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage,
    borderWidth: 1
  },
  iconCircleMuted: {
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
    gap: theme.spacing.xs
  },
  toolTitle: {
    fontSize: 16,
    lineHeight: 22
  },
  cardAffordance: {
    minWidth: 42,
    alignItems: "flex-end",
    justifyContent: "center"
  },
  comingSoonPill: {
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surfaceMuted,
    borderColor: theme.colors.border,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 4
  },
  bottomAction: {
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl
  }
});
