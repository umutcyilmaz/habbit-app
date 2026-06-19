import type { ViewStyle } from "react-native";

export const shadows = {
  card: {
    shadowColor: "#17243A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3
  } satisfies ViewStyle
} as const;
