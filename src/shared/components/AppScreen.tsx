import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

import { theme } from "../design-system/theme";

type AppScreenProps = PropsWithChildren<{
  contentContainerStyle?: ViewStyle;
}>;

export function AppScreen({ children, contentContainerStyle }: AppScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        alwaysBounceVertical={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 184 + insets.bottom },
          contentContainerStyle
        ]}
      >
        <View style={styles.content}>{children}</View>
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
