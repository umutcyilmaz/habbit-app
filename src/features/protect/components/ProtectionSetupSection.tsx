import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type ProtectionSetupSectionProps = {
  title: string;
  body?: string;
  children: ReactNode;
};

export function ProtectionSetupSection({
  title,
  body,
  children
}: ProtectionSetupSectionProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <View style={styles.copy}>
          <AppText variant="title">{title}</AppText>
          {body ? (
            <AppText tone="secondary">
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
    padding: 26
  },
  stack: {
    gap: theme.spacing.lg
  },
  copy: {
    gap: theme.spacing.sm
  }
});
