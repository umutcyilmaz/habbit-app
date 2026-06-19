import { Tabs } from "expo-router";

import { tabRoutes } from "../../src/constants/navigation";
import { theme } from "../../src/shared/design-system/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600"
        },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          minHeight: 64,
          paddingBottom: 8,
          paddingTop: 8
        }
      }}
    >
      {tabRoutes.map((route) => (
        <Tabs.Screen
          key={route.name}
          name={route.name}
          options={{
            title: route.title
          }}
        />
      ))}
    </Tabs>
  );
}
