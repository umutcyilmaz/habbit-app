import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type HelpfulToolsCardProps = {
  pauseCount: number;
  checkInCount: number;
  protectionStatus: string;
};

function getProtectionDetail(status: string) {
  return status === "active" ? "Active during selected hours" : "Not active yet";
}

function getUsedLabel(count: number) {
  return `Used ${count} ${count === 1 ? "time" : "times"} this week`;
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
          <ToolRow icon="◇" title="Protection" detail={getProtectionDetail(protectionStatus)} />
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
    padding: theme.spacing.xl
  },
  stack: {
    gap: theme.spacing.md
  },
  rows: {
    gap: theme.spacing.md
  },
  row: {
    minHeight: 66,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.md
  },
  iconCircle: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.sageMuted
  },
  rowCopy: {
    flex: 1,
    gap: theme.spacing.xs
  }
});
