import { Tabs } from "expo-router";
import { Pressable, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tabRoutes } from "../../src/constants/navigation";
import { theme } from "../../src/shared/design-system/v4/theme";

const TAB_BAR_CONTENT_HEIGHT = 68;

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: (props) => {
          const { ref: _ref, ...buttonProps } = props;

          return (
            <Pressable
              {...buttonProps}
              style={(state) => {
                const focused = "focused" in state ? Boolean(state.focused) : false;

                return [
                  styles.tabButton,
                  focused ? styles.tabButtonFocused : undefined,
                  state.pressed ? styles.tabButtonPressed : undefined,
                  webFocusReset
                ];
              }}
            />
          );
        },
        tabBarIcon: () => null,
        tabBarIconStyle: styles.hiddenIcon,
        tabBarActiveTintColor: theme.colors.text.accent,
        tabBarInactiveTintColor: theme.colors.text.muted,
        tabBarLabelPosition: "below-icon",
        tabBarLabelStyle: {
          ...theme.typography.labelNav,
          includeFontPadding: false,
          marginBottom: 0,
          marginTop: 0
        },
        tabBarStyle: {
          backgroundColor: theme.colors.bg.surface,
          borderTopColor: theme.colors.border.default,
          borderTopWidth: theme.size.stroke.hairline,
          height: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
          minHeight: TAB_BAR_CONTENT_HEIGHT + insets.bottom,
          paddingBottom: theme.spacing.xs + insets.bottom,
          paddingHorizontal: theme.spacing.md,
          paddingTop: theme.spacing.xs
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
            title: route.title,
            tabBarButtonTestID: `bloom.tab.${route.name}`
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
  },
  tabButton: {
    alignItems: "center",
    borderColor: "transparent",
    borderWidth: 1,
    flex: 1,
    justifyContent: "center",
    minHeight: theme.size.touch.min
  },
  tabButtonFocused: {
    borderColor: theme.colors.border.focus
  },
  tabButtonPressed: {
    backgroundColor: theme.colors.bg.surfaceSunken
  }
} as const;

const webFocusReset = {
  outlineStyle: "none"
} as unknown as ViewStyle;
