import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "../design-system/theme";
import { TAB_SCREEN_BOTTOM_PADDING } from "../layout/tabSpacing";

type AppScreenProps = PropsWithChildren<{
  contentContainerStyle?: ViewStyle;
  contentStyle?: ViewStyle;
}>;

export function AppScreen({ children, contentContainerStyle, contentStyle }: AppScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView edges={["top", "left", "right"]} style={styles.safeArea}>
      <ScrollView
        alwaysBounceVertical={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: TAB_SCREEN_BOTTOM_PADDING + insets.bottom },
          contentContainerStyle
        ]}
      >
        <View style={[styles.content, contentStyle]}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.xl
  },
  content: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center"
  }
});
