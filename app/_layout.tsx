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
        <Stack.Screen name="settings" />
      </Stack>
    </AppProviders>
  );
}
