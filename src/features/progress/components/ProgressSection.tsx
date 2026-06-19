import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type ProgressSectionProps = PropsWithChildren<{
  title: string;
  subtitle?: string;
}>;

export function ProgressSection({ title, subtitle, children }: ProgressSectionProps) {
  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <AppText variant="title">{title}</AppText>
        {subtitle ? (
          <AppText variant="bodySmall" tone="secondary">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: theme.spacing.md
  },
  header: {
    gap: theme.spacing.xs
  }
});
