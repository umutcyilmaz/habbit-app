import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type PracticeQuestionCardProps = PropsWithChildren<{
  title: string;
  body?: string;
}>;

export function PracticeQuestionCard({ title, body, children }: PracticeQuestionCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <View style={styles.copy}>
          <AppText variant="title">{title}</AppText>
          {body ? (
            <AppText variant="bodySmall" tone="secondary">
              {body}
            </AppText>
          ) : null}
        </View>
        {children}
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.lg
  },
  stack: {
    gap: theme.spacing.lg
  },
  copy: {
    gap: theme.spacing.sm
  }
});
