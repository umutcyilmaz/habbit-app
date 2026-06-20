import { useState } from "react";
import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppHeader } from "../../../shared/components/AppHeader";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

const options = ["Restless", "Bored", "Stressed", "Unsure"] as const;

export function PauseCheckInScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<(typeof options)[number]>("Unsure");

  return (
    <AppScreen>
      <AppHeader
        title="Before the pause"
        subtitle="Name what is present, only if it helps."
        onSettingsPress={() => router.push(routes.settings)}
      />

      <View style={styles.stack}>
        <AppCard>
          <View style={styles.cardStack}>
            <AppText variant="title">What feels closest?</AppText>
            <View style={styles.optionGrid}>
              {options.map((option) => (
                <AppButton
                  key={option}
                  variant={selected === option ? "primary" : "subtle"}
                  style={styles.optionButton}
                  onPress={() => setSelected(option)}
                >
                  {option}
                </AppButton>
              ))}
            </View>
            <AppButton onPress={() => router.push(routes.pauseTimer)}>Continue</AppButton>
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
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  optionButton: {
    minWidth: 112,
    flexGrow: 1
  }
});
