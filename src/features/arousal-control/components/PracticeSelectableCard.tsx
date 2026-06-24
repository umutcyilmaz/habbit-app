import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type PracticeSelectableCardProps<T extends string> = {
  value: T;
  title: string;
  selected: boolean;
  onSelect: (value: T) => void;
};

export function PracticeSelectableCard<T extends string>({
  value,
  title,
  selected,
  onSelect
}: PracticeSelectableCardProps<T>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={() => onSelect(value)}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.cardSelected : undefined,
        pressed ? styles.cardPressed : undefined
      ]}
    >
      <View style={styles.copy}>
        <AppText variant="label">{title}</AppText>
      </View>
      <View style={[styles.radio, selected ? styles.radioSelected : undefined]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing.md,
    justifyContent: "space-between",
    borderRadius: theme.radius.xl,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md
  },
  cardSelected: {
    borderColor: theme.colors.sage,
    backgroundColor: theme.colors.sageMuted
  },
  cardPressed: {
    backgroundColor: theme.colors.surfaceMuted
  },
  copy: {
    flex: 1
  },
  radio: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderColor: theme.colors.border,
    borderWidth: 1,
    backgroundColor: theme.colors.surface
  },
  radioSelected: {
    borderColor: theme.colors.sage
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.colors.sage
  }
});
