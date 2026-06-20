import { Tabs } from "expo-router";

import { tabRoutes } from "../../src/constants/navigation";
import { theme } from "../../src/shared/design-system/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarIcon: () => null,
        tabBarIconStyle: styles.hiddenIcon,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarLabelPosition: "below-icon",
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
          lineHeight: 16,
          marginBottom: 0,
          marginTop: 0
        },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          height: 82,
          minHeight: 82,
          paddingBottom: 18,
          paddingTop: 12
        },
        tabBarItemStyle: {
          justifyContent: "center",
          paddingVertical: 0
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

const styles = {
  hiddenIcon: {
    display: "none",
    height: 0,
    width: 0
  }
} as const;
