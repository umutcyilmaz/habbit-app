import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import type { ProtectionStatus } from "../../../storage/bloomState";

type HelpfulToolsCardProps = {
  pauseCount: number;
  checkInCount: number;
  protectionStatus: ProtectionStatus;
};

function getProtectionDetail(status: ProtectionStatus) {
  return status === "active" ? "In-app pause plan ready" : "Not ready yet";
}

function getUsedLabel(count: number) {
  if (count === 1) {
    return "Used once this week";
  }

  if (count === 2) {
    return "Used twice this week";
  }

  return `Used ${count} times this week`;
}

export function HelpfulToolsCard({
  pauseCount,
  checkInCount,
  protectionStatus
}: HelpfulToolsCardProps) {
  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <AppText variant="title">What helped recently</AppText>
        <View style={styles.rows}>
          <ToolRow icon="Ⅱ" title="90-Second Pause" detail={getUsedLabel(pauseCount)} />
          <ToolRow icon="✓" title="Quick Check-In" detail={getUsedLabel(checkInCount)} />
          <ToolRow icon="☾" title="Protection" detail={getProtectionDetail(protectionStatus)} />
        </View>
      </View>
    </AppCard>
  );
}

type ToolRowProps = {
  icon: string;
  title: string;
  detail: string;
};

function ToolRow({ icon, title, detail }: ToolRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.iconCircle}>
        <AppText variant="label">{icon}</AppText>
      </View>
      <View style={styles.rowCopy}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="bodySmall" tone="secondary">
          {detail}
        </AppText>
      </View>
    </View>
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
  rows: {
    gap: theme.spacing.sm
  },
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  iconCircle: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted
  },
  rowCopy: {
    flex: 1,
    gap: theme.spacing.xs
  }
});
