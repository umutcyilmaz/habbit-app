import { StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";
import { protectionLevelOptions } from "../data/protectMockData";
import type { ProtectionLevel, ProtectionLevelOption } from "../types";
import { SupportLevelCard } from "./SupportLevelCard";

type ProtectionLevelSelectorProps = {
  value: ProtectionLevel;
  onChange: (level: ProtectionLevel) => void;
};

export function ProtectionLevelSelector({ value, onChange }: ProtectionLevelSelectorProps) {
  const selectLevel = (option: ProtectionLevelOption) => {
    onChange(option.id);
  };

  return (
    <View style={styles.container}>
      <AppText variant="title">Support level</AppText>
      <View style={styles.levels}>
        {protectionLevelOptions.map((option) => (
          <SupportLevelCard
            key={option.id}
            option={option}
            selected={value === option.id}
            onSelect={selectLevel}
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
  levels: {
    gap: theme.spacing.sm
  }
});
