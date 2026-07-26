import { Redirect } from "expo-router";
import { StyleSheet, View } from "react-native";

import { useBloomLocalState } from "../src/app/providers/BloomLocalStateProvider";
import { routes } from "../src/constants/navigation";
import { AppText } from "../src/shared/components/AppText";
import { theme } from "../src/shared/design-system/theme";

export default function IndexRoute() {
  const { state, hydrationStatus, hydrationError } = useBloomLocalState();

  if (hydrationStatus !== "ready") {
    return (
      <View style={styles.loadingScreen}>
        <AppText variant="label" tone="secondary">
          Bloom
        </AppText>
        {hydrationStatus === "error" && hydrationError !== null ? (
          <AppText tone="secondary" align="center">
            {hydrationError.message}
          </AppText>
        ) : null}
      </View>
    );
  }

  if (!state.onboarding.completed) {
    return <Redirect href={routes.onboarding} />;
  }

  return <Redirect href={routes.home} />;
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    backgroundColor: theme.colors.background
  }
});
