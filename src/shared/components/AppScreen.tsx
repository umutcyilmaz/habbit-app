import type { PropsWithChildren } from "react";
import { ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { theme } from "../design-system/theme";

type AppScreenProps = PropsWithChildren<{
  contentContainerStyle?: ViewStyle;
}>;

export function AppScreen({ children, contentContainerStyle }: AppScreenProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        alwaysBounceVertical={false}
        contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
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
    padding: theme.spacing.xl
  },
  content: {
    width: "100%",
    maxWidth: 720,
    alignSelf: "center"
  }
});
