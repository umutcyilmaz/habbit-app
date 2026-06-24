import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type ArousalLevelPickerProps = {
  value: number;
  onChange: (value: number) => void;
};

const levels = Array.from({ length: 11 }, (_, index) => index);

export function ArousalLevelPicker({ value, onChange }: ArousalLevelPickerProps) {
  return (
    <View style={styles.stack}>
      <View style={styles.grid}>
        {levels.map((level) => {
          const selected = level === value;

          return (
            <Pressable
              key={level}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(level)}
              style={({ pressed }) => [
                styles.levelButton,
                selected ? styles.levelButtonSelected : undefined,
                pressed ? styles.levelButtonPressed : undefined
              ]}
            >
              <AppText variant="label">{level}</AppText>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.helperRow}>
        <AppText variant="caption" tone="secondary">
          0 = calm
        </AppText>
        <AppText variant="caption" tone="secondary">
          10 = very close to climax
        </AppText>
      </View>

      <View style={styles.groupGrid}>
        <ScaleGroup label="1–3" detail="Low" />
        <ScaleGroup label="4–5" detail="Building" />
        <ScaleGroup label="6–7" detail="Pause zone" />
        <ScaleGroup label="8–10" detail="Very high" />
      </View>
    </View>
  );
}

type ScaleGroupProps = {
  label: string;
  detail: string;
};

function ScaleGroup({ label, detail }: ScaleGroupProps) {
  return (
    <View style={styles.group}>
      <AppText variant="caption" tone="secondary">
        {label}
      </AppText>
      <AppText variant="bodySmall">{detail}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.md
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  levelButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface
  },
  levelButtonSelected: {
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted
  },
  levelButtonPressed: {
    backgroundColor: theme.colors.surfaceMuted
  },
  helperRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: theme.spacing.md
  },
  groupGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  group: {
    minWidth: 124,
    flex: 1,
    borderRadius: theme.radius.lg,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surfaceMuted,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm
  }
});
