import { useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";

import { routes } from "../../../constants/navigation";
import { AppButton } from "../../../shared/components/AppButton";
import { AppCard } from "../../../shared/components/AppCard";
import { AppScreen } from "../../../shared/components/AppScreen";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { ArousalControlFlowHeader } from "../components/ArousalControlFlowHeader";

const summaryItems = [
  { label: "Pauses", value: "1" },
  { label: "Highest arousal", value: "7/10" },
  { label: "Control feeling", value: "6/10" },
  { label: "Pleasure quality", value: "7/10" },
  { label: "Pressure", value: "Medium" },
  { label: "Firmness during pause", value: "Slightly decreased" },
  { label: "Duration", value: "Prefer not to log" }
] as const;

export function PracticeSavedScreen() {
  const router = useRouter();
  const [noteVisible, setNoteVisible] = useState(false);
  const [note, setNote] = useState("");
  const [noteMessage, setNoteMessage] = useState<string | undefined>();

  const saveNote = () => {
    setNoteMessage(
      note.trim().length > 0
        ? "Private note saved for this practice."
        : "No note added. This practice is still saved."
    );
  };

  return (
    <AppScreen contentStyle={styles.content}>
      <ArousalControlFlowHeader
        label="PRACTICE SAVED"
        icon="✓"
        title="You practiced noticing the rise."
        subtitle="This session adds useful context to your awareness pattern."
        onBackPress={() => router.replace(routes.arousalControlDuration)}
        onClosePress={() => router.replace(routes.exercises)}
      />

      <View style={styles.stack}>
        <AppCard style={styles.successCard}>
          <View style={styles.successStack}>
            <View style={styles.successIcon}>
              <AppText variant="label">✓</AppText>
            </View>
            <View style={styles.noteCopy}>
              <AppText variant="title" align="center">
                Practice saved
              </AppText>
              <AppText tone="secondary" align="center">
                You practiced noticing your arousal level and learning your body’s response without
                judging the outcome.
              </AppText>
            </View>
          </View>
        </AppCard>

        <AppCard style={styles.summaryCard}>
          <View style={styles.cardStack}>
            <AppText variant="title">Session summary</AppText>
            <View style={styles.summaryList}>
              {summaryItems.map((item) => (
                <View key={item.label} style={styles.summaryRow}>
                  <AppText variant="bodySmall" tone="secondary" style={styles.summaryLabel}>
                    {item.label}
                  </AppText>
                  <AppText variant="label" style={styles.summaryValue}>
                    {item.value}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        </AppCard>

        <View style={styles.insightCard}>
          <View style={styles.cardStack}>
            <AppText variant="title">Gentle insight</AppText>
            <View style={styles.insightList}>
              <AppText tone="secondary">You noticed your pause zone around 7/10.</AppText>
              <AppText tone="secondary">
                A pause can still be useful even if the session ended differently than expected.
              </AppText>
              <AppText tone="secondary">Duration is private context, not a score.</AppText>
              <AppText tone="secondary">
                Next time, the practice can be noticing the rise a little earlier.
              </AppText>
            </View>
          </View>
        </View>

        {noteVisible ? (
          <AppCard style={styles.noteCard}>
            <View style={styles.cardStack}>
              <View style={styles.noteCopy}>
                <AppText variant="title">Private note</AppText>
                <AppText variant="bodySmall" tone="secondary">
                  Add one detail you want to remember.
                </AppText>
              </View>
              <TextInput
                multiline
                value={note}
                onChangeText={setNote}
                placeholder="What do you want to remember about this practice?"
                placeholderTextColor={theme.colors.textSecondary}
                style={styles.input}
                textAlignVertical="top"
              />
              {noteMessage ? (
                <AppText variant="bodySmall" tone="secondary">
                  {noteMessage}
                </AppText>
              ) : null}
              <AppButton variant="subtle" onPress={saveNote}>
                Save note
              </AppButton>
            </View>
          </AppCard>
        ) : (
          <AppButton variant="subtle" onPress={() => setNoteVisible(true)}>
            Add private note
          </AppButton>
        )}

        <View style={styles.actions}>
          <AppButton onPress={() => router.replace(routes.home)}>Back to Today</AppButton>
          <AppButton variant="secondary" onPress={() => router.replace(routes.progress)}>
            View Progress
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.replace(routes.exercises)}>
            Back to Exercises
          </AppButton>
        </View>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    maxWidth: 430
  },
  stack: {
    gap: theme.spacing.lg
  },
  successCard: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted,
    padding: theme.spacing.lg
  },
  successStack: {
    alignItems: "center",
    gap: theme.spacing.md
  },
  successIcon: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    backgroundColor: theme.colors.surface
  },
  summaryCard: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.lg
  },
  cardStack: {
    gap: theme.spacing.lg
  },
  summaryList: {
    gap: theme.spacing.sm
  },
  summaryRow: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: theme.spacing.md,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  },
  summaryLabel: {
    flex: 1
  },
  summaryValue: {
    flexShrink: 1,
    textAlign: "right"
  },
  insightCard: {
    borderRadius: theme.radius.xxl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
    ...theme.shadows.card
  },
  insightList: {
    gap: theme.spacing.sm
  },
  noteCard: {
    borderRadius: theme.radius.xxl,
    padding: theme.spacing.lg
  },
  noteCopy: {
    gap: theme.spacing.sm
  },
  input: {
    minHeight: 104,
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textPrimary,
    fontSize: theme.typography.size.body,
    lineHeight: theme.typography.lineHeight.body,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.md
  },
  actions: {
    gap: theme.spacing.sm
  }
});
