import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type RatingScaleProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

const ratingValues = Array.from({ length: 11 }, (_, index) => index);

export function RatingScale({ label, value, onChange }: RatingScaleProps) {
  return (
    <View style={styles.container}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.scale}>
        {ratingValues.map((rating) => {
          const selected = rating === value;

          return (
            <Pressable
              key={rating}
              accessibilityLabel={`${label}: ${rating} out of 10`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(rating)}
              style={({ pressed }) => [
                styles.rating,
                selected ? styles.ratingSelected : undefined,
                pressed ? styles.ratingPressed : undefined
              ]}
            >
              <AppText variant="caption" tone={selected ? "inverse" : "primary"}>
                {rating}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md
  },
  scale: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  },
  rating: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface
  },
  ratingSelected: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary
  },
  ratingPressed: {
    opacity: 0.82
  }
});
