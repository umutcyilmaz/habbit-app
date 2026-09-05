import { StyleSheet, View } from "react-native";

import { AppCard } from "../../../shared/components/AppCard";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import {
  getNewestBloomCheckInRecords,
  type BloomCheckInEventType,
  type BloomCheckInMoment,
  type BloomCheckInMood,
  type BloomCheckInRecord
} from "../../../storage/bloomState";

type RecentMomentsCardProps = {
  records: readonly BloomCheckInRecord[];
};

export function RecentMomentsCard({ records }: RecentMomentsCardProps) {
  const recentRecords = getNewestBloomCheckInRecords(records).slice(0, 3);

  return (
    <AppCard style={styles.card}>
      <View style={styles.stack}>
        <AppText variant="title">Recent moments</AppText>
        {recentRecords.length > 0 ? (
          <View testID="bloom.log.recent-moments" style={styles.rows}>
            {recentRecords.map((record) => (
              <View key={record.id} style={styles.row}>
                <View style={styles.iconCircle}>
                  <AppText variant="label">✓</AppText>
                </View>
                <View style={styles.rowCopy}>
                  <AppText variant="label">
                    {formatMoment(record.moment)} check-in
                  </AppText>
                  <AppText variant="bodySmall" tone="secondary">
                    {formatRecordDetail(record)}
                  </AppText>
                  {record.note ? (
                    <AppText variant="bodySmall" tone="secondary" numberOfLines={2}>
                      {record.note}
                    </AppText>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <AppText variant="bodySmall" tone="secondary">
              No moments saved yet. Your first check-in will appear here.
            </AppText>
          </View>
        )}
      </View>
    </AppCard>
  );
}

function formatRecordDetail(record: BloomCheckInRecord) {
  const details = [
    formatMood(record.mood),
    record.eventType ? formatEventType(record.eventType) : null,
    new Date(record.createdAt).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    })
  ].filter((detail): detail is string => detail !== null);

  return details.join(" · ");
}

function formatMoment(moment: BloomCheckInMoment) {
  const labels: Record<BloomCheckInMoment, string> = {
    evening: "Evening",
    boredom: "Boredom",
    alone: "Alone",
    stress: "Stress",
    scrolling: "Scrolling"
  };

  return labels[moment];
}

function formatMood(mood: BloomCheckInMood) {
  const labels: Record<BloomCheckInMood, string> = {
    neutral: "Neutral",
    bored: "Bored",
    restless: "Restless",
    stressed: "Stressed",
    calm: "Calm"
  };

  return labels[mood];
}

function formatEventType(eventType: BloomCheckInEventType) {
  const labels: Record<BloomCheckInEventType, string> = {
    nothing: "Nothing happened",
    urge: "Urge noticed",
    paused: "Paused",
    adultContent: "Adult content",
    masturbated: "Masturbated",
    both: "Adult content and masturbation"
  };

  return labels[eventType];
}

const styles = StyleSheet.create({
  card: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.lg
  },
  stack: {
    gap: theme.spacing.md
  },
  rows: {
    gap: theme.spacing.sm
  },
  row: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  iconCircle: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface
  },
  rowCopy: {
    flex: 1,
    gap: theme.spacing.xs
  },
  emptyState: {
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceMuted,
    padding: theme.spacing.md
  }
});
