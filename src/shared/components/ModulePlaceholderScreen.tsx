import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { appCopy } from "../../constants/copy";
import { routes } from "../../constants/navigation";
import { theme } from "../design-system/theme";
import { AppButton } from "./AppButton";
import { AppCard } from "./AppCard";
import { AppHeader } from "./AppHeader";
import { AppScreen } from "./AppScreen";
import { AppText } from "./AppText";

type ModulePlaceholderScreenProps = {
  title: string;
  purpose: string;
  responsibilities: readonly string[];
  primaryAction: string;
  showSettingsAction?: boolean;
  onPrimaryAction?: () => void;
};

export function ModulePlaceholderScreen({
  title,
  purpose,
  responsibilities,
  primaryAction,
  showSettingsAction = true,
  onPrimaryAction
}: ModulePlaceholderScreenProps) {
  const router = useRouter();

  return (
    <AppScreen>
      <AppHeader
        title={title}
        subtitle={purpose}
        onSettingsPress={showSettingsAction ? () => router.push(routes.settings) : undefined}
      />

      <View style={styles.stack}>
        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Module foundation</AppText>
            <AppText tone="secondary">{appCopy.foundationNote}</AppText>
            <AppButton onPress={onPrimaryAction}>{primaryAction}</AppButton>
          </View>
        </AppCard>

        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">Future responsibilities</AppText>
            <View style={styles.list}>
              {responsibilities.map((item) => (
                <View key={item} style={styles.listItem}>
                  <View style={styles.dot} />
                  <AppText>{item}</AppText>
                </View>
              ))}
            </View>
          </View>
        </AppCard>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.lg
  },
  cardStack: {
    gap: theme.spacing.lg
  },
  list: {
    gap: theme.spacing.md
  },
  listItem: {
    alignItems: "center",
    flexDirection: "row",
    gap: theme.spacing.md
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.sage
  }
});
