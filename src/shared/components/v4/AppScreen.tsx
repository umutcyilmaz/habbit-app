import {
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewProps,
  type ViewStyle
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "../../design-system/v4/theme";

type StaticScreenProps = ViewProps & {
  scroll?: false;
  includeBottomNavClearance?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
};

type ScrollScreenProps = ScrollViewProps & {
  scroll: true;
  includeBottomNavClearance?: boolean;
};

export type AppScreenProps = StaticScreenProps | ScrollScreenProps;

export function AppScreen(props: AppScreenProps) {
  const insets = useSafeAreaInsets();

  if (props.scroll === true) {
    const {
      scroll: _scroll,
      includeBottomNavClearance: _includeBottomNavClearance,
      contentContainerStyle,
      style,
      children,
      ...scrollViewProps
    } = props;

    const includeBottomNavClearance = _includeBottomNavClearance !== false;

    const shellStyle: StyleProp<ViewStyle> = [
      styles.screen,
      {
        paddingLeft: insets.left,
        paddingRight: insets.right,
        paddingTop: insets.top
      },
      style
    ];

    const contentStyle: StyleProp<ViewStyle> = [
      styles.content,
      {
        paddingBottom: includeBottomNavClearance
          ? theme.spacing.layout.navClearance + insets.bottom
          : insets.bottom
      },
      contentContainerStyle
    ];

    return (
      <ScrollView {...scrollViewProps} style={shellStyle} contentContainerStyle={contentStyle}>
        {children}
      </ScrollView>
    );
  }

  const {
    scroll: _scroll,
    includeBottomNavClearance: _includeBottomNavClearance,
    contentContainerStyle,
    style,
    children,
    ...viewProps
  } = props;

  const includeBottomNavClearance = _includeBottomNavClearance !== false;

  const shellStyle: StyleProp<ViewStyle> = [
    styles.screen,
    {
      paddingLeft: insets.left,
      paddingRight: insets.right,
      paddingTop: insets.top
    },
    style
  ];

  const contentStyle: StyleProp<ViewStyle> = [
    styles.content,
    styles.staticContent,
    {
      paddingBottom: includeBottomNavClearance
        ? theme.spacing.layout.navClearance + insets.bottom
        : insets.bottom
    },
    contentContainerStyle
  ];

  return (
    <View {...viewProps} style={shellStyle}>
      <View style={contentStyle}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: theme.colors.bg.canvas,
    flex: 1
  },
  content: {
    paddingHorizontal: theme.spacing.layout.screenX,
    paddingTop: theme.spacing.xl
  },
  staticContent: {
    flex: 1
  }
});
