import type { ViewStyle } from "react-native";

export type ShadowRole = "none" | "subtle" | "card" | "floating" | "modal";

/**
 * V4 platform shadows (design-system-spec.md 2.7, design-tokens.json -> shadows).
 *
 * Each entry carries the iOS shadow props AND the Android elevation level, so a
 * single spread works on both platforms; no platform branch is needed at the
 * usage site. Android elevation does not control color/offset — acceptable per
 * spec; surface separation is border-led in dark mode.
 *
 * Input inner shadow (shadow/insetField): NOT used in V4. React Native has no
 * native inner shadow. Approved native fallback: backgroundColor bg.surfaceElevated
 * + borderWidth 1 borderColor border.strong. insetField is therefore NOT
 * exported from the RN theme.
 */
export const shadows = {
  none: {
    elevation: 0
  },
  subtle: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 1
  },
  card: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.4,
    shadowRadius: 3,
    elevation: 2
  },
  floating: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4
  },
  modal: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 16
  }
} as const satisfies Record<ShadowRole, ViewStyle>;
