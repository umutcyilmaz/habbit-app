import { StyleSheet, View } from "react-native";

import { AppChip } from "../../../shared/components/AppChip";
import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { supportToolOptions } from "../data/logMockData";
import type { SupportToolOption } from "../types";

type SupportToolChipsProps = {
  value: SupportToolOption[];
  onChange: (value: SupportToolOption[]) => void;
};

export function SupportToolChips({ value, onChange }: SupportToolChipsProps) {
  const toggleTool = (tool: SupportToolOption) => {
    if (tool === "noneToday") {
      onChange(["noneToday"]);
      return;
    }

    const withoutNone = value.filter((item) => item !== "noneToday");
    const nextValue = withoutNone.includes(tool)
      ? withoutNone.filter((item) => item !== tool)
      : [...withoutNone, tool];

    onChange(nextValue.length > 0 ? nextValue : ["noneToday"]);
  };

  return (
    <View style={styles.container}>
      <AppText variant="label">Support tools used</AppText>
      <View style={styles.chips}>
        {supportToolOptions.map((tool) => (
          <AppChip
            key={tool.id}
            label={tool.label}
            value={tool.id}
            selected={value.includes(tool.id)}
            onPress={toggleTool}
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
