import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type UrgeStrengthControlProps = {
  value: number;
  onChange: (value: number) => void;
};

const strengthValues = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function UrgeStrengthControl({ value, onChange }: UrgeStrengthControlProps) {
  return (
    <View style={styles.stack}>
      <View style={styles.scale}>
        {strengthValues.map((strength) => {
          const isSelected = value === strength;

          return (
            <Pressable
              key={strength}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={`Urge strength ${strength}`}
              onPress={() => onChange(strength)}
              style={({ pressed }) => [
                styles.scaleButton,
                isSelected ? styles.scaleButtonSelected : undefined,
                pressed ? styles.scaleButtonPressed : undefined
              ]}
            >
              <AppText variant="label" tone={isSelected ? "inverse" : "primary"}>
                {strength}
              </AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.labelRow}>
        <AppText variant="bodySmall" tone="secondary">
          0 = calm / gone
        </AppText>
        <AppText variant="bodySmall" tone="secondary">
          10 = very strong / intense
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: theme.spacing.md
  },
  scale: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  scaleButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  scaleButtonSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  scaleButtonPressed: {
    backgroundColor: theme.colors.surfaceMuted
  },
  labelRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: theme.spacing.sm
  }
});
