import { Stack } from "expo-router";

import { OnboardingProvider } from "../../src/features/onboarding/OnboardingContext";
import { theme } from "../../src/shared/design-system/theme";

export default function OnboardingLayout() {
  return (
    <OnboardingProvider>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.colors.background },
          headerShown: false
        }}
      >
        <Stack.Screen name="welcome" />
        <Stack.Screen name="safety-note" />
        <Stack.Screen name="privacy-trust" />
        <Stack.Screen name="goals" />
        <Stack.Screen name="starting-point" />
        <Stack.Screen name="starting-profile" />
        <Stack.Screen name="starting-plan" />
      </Stack>
    </OnboardingProvider>
  );
}
