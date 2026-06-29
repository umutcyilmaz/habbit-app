import { Stack } from "expo-router";

import { AppProviders } from "../src/app/providers/AppProviders";
import { theme } from "../src/shared/design-system/theme";

export default function RootLayout() {
  return (
    <AppProviders>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: theme.colors.background },
          headerShown: false
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="guidance" />
        <Stack.Screen name="exercises" />
        <Stack.Screen name="pause" />
        <Stack.Screen name="protect" />
        <Stack.Screen name="settings" />
      </Stack>
    </AppProviders>
  );
}
