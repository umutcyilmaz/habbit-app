import { Tabs } from "expo-router";
import { Pressable, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { tabRoutes } from "../../src/constants/navigation";
import { theme } from "../../src/shared/design-system/theme";
import {
  getTabBarBottomPadding,
  getTabBarHeight,
  TAB_BAR_TOP_PADDING
} from "../../src/shared/layout/tabSpacing";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const tabBarBottomPadding = getTabBarBottomPadding(insets.bottom);
  const tabBarHeight = getTabBarHeight(insets.bottom);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: (props) => {
          const selected = props.accessibilityState?.selected;
          const { ref: _ref, ...buttonProps } = props;

          return (
            <Pressable
              {...buttonProps}
              style={(state) => {
                const focused = "focused" in state ? Boolean(state.focused) : false;

                return [
                  styles.tabButton,
                  selected ? styles.tabButtonActive : undefined,
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
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarLabelPosition: "below-icon",
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700",
          lineHeight: 16,
          includeFontPadding: false,
          marginBottom: 0,
          marginTop: 0
        },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          minHeight: tabBarHeight,
          paddingBottom: tabBarBottomPadding,
          paddingHorizontal: 8,
          paddingTop: TAB_BAR_TOP_PADDING
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
    borderRadius: theme.radius.pill,
    flex: 1,
    justifyContent: "center",
    marginHorizontal: 2,
    minHeight: 44,
    paddingHorizontal: 2
  },
  tabButtonActive: {
    backgroundColor: theme.colors.sageMuted
  },
  tabButtonFocused: {
    borderColor: theme.colors.lavenderDeep
  },
  tabButtonPressed: {
    backgroundColor: theme.colors.surfaceMuted
  }
} as const;

const webFocusReset = {
  outlineStyle: "none"
} as unknown as ViewStyle;
