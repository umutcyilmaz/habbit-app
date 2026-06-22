import { StyleSheet, View } from "react-native";

import { AppText } from "../../../shared/components/AppText";
import { theme } from "../../../shared/design-system/theme";

type ProtectionVisualProps = {
  label?: string;
  symbol?: string;
  size?: "medium" | "large";
};

export function ProtectionVisual({
  label = "Support",
  symbol = "✓",
  size = "medium"
}: ProtectionVisualProps) {
  const isLarge = size === "large";

  return (
    <View style={[styles.outer, isLarge ? styles.outerLarge : undefined]}>
      <View style={[styles.middle, isLarge ? styles.middleLarge : undefined]}>
        <View style={[styles.inner, isLarge ? styles.innerLarge : undefined]}>
          <AppText variant="heading" tone="inverse" align="center" style={styles.symbol}>
            {symbol}
          </AppText>
          <AppText variant="caption" tone="inverse" align="center">
            {label}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: 184,
    height: 184,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    borderRadius: 92,
    backgroundColor: theme.colors.sageMuted,
    borderColor: theme.colors.sage,
    borderWidth: 1,
    ...theme.shadows.card
  },
  outerLarge: {
    width: 216,
    height: 216,
    borderRadius: 108
  },
  middle: {
    width: 132,
    height: 132,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 66,
    backgroundColor: theme.colors.surface,
    borderColor: theme.colors.white,
    borderWidth: 1
  },
  middleLarge: {
    width: 158,
    height: 158,
    borderRadius: 79
  },
  inner: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 42,
    backgroundColor: theme.colors.primary
  },
  innerLarge: {
    width: 106,
    height: 106,
    borderRadius: 53
  },
  symbol: {
    fontSize: 34,
    lineHeight: 38
  }
});
