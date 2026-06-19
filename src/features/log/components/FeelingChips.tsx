import { StyleSheet, View } from "react-native";

import { AppChip } from "../../../shared/components/AppChip";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { feelingOptions } from "../data/logMockData";
import type { FeelingOption } from "../types";

type FeelingChipsProps = {
  value: FeelingOption;
  onChange: (value: FeelingOption) => void;
};

export function FeelingChips({ value, onChange }: FeelingChipsProps) {
  return (
    <View style={styles.container}>
      <AppText variant="label">Strongest feeling</AppText>
      <View style={styles.chips}>
        {feelingOptions.map((feeling) => (
          <AppChip
            key={feeling.id}
            label={feeling.label}
            value={feeling.id}
            selected={value === feeling.id}
            onPress={onChange}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: theme.spacing.md
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: theme.spacing.sm
  }
});
