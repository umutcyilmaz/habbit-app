import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type NextStepOptionCardProps<TValue extends string> = {
  value: TValue;
  title: string;
  description?: string;
  selected: boolean;
  onSelect: (value: TValue) => void;
  testIDPrefix?: string;
};

export function NextStepOptionCard<TValue extends string>({
  value,
  title,
  description,
  selected,
  onSelect,
  testIDPrefix
}: NextStepOptionCardProps<TValue>) {
  return (
    <Pressable
      {...(testIDPrefix !== undefined
        ? { testID: `${testIDPrefix}.${value}` }
        : {})}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onSelect(value)}
      style={({ pressed }) => [
        styles.option,
        selected ? styles.selectedOption : undefined,
        pressed ? styles.pressedOption : undefined
      ]}
    >
      <View style={[styles.indicator, selected ? styles.selectedIndicator : undefined]} />
      <View style={styles.copy}>
        <AppText variant="label">{title}</AppText>
        {description ? (
          <AppText variant="bodySmall" tone="secondary">
            {description}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  option: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg
  },
  selectedOption: {
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage
  },
  pressedOption: {
    backgroundColor: theme.colors.surfaceMuted
  },
  indicator: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  selectedIndicator: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary
  },
  copy: {
    flex: 1,
    gap: theme.spacing.xs
  }
});
