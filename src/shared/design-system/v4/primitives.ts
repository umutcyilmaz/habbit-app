/**
 * V4 primitive color palette (design-tokens.json -> primitives).
 *
 * NEVER consume primitives directly from components or screens.
 * Primitives are resolved only through the semantic token layer in
 * ./colors.ts and are intentionally NOT exposed from the public V4 theme.
 */
export const primitives = {
  neutral: {
    975: "#0B0B0C",
    950: "#111111",
    925: "#161618",
    900: "#1C1C1E",
    875: "#222222",
    850: "#272729",
    800: "#2A2A2A",
    775: "#2F2F2F",
    750: "#333333",
    700: "#424242",
    600: "#555555",
    500: "#666666",
    450: "#767C85",
    430: "#81858C",
    400: "#8A9099",
    300: "#A0A0A0",
    200: "#E0E0E0",
    100: "#F0F0F0",
    0: "#FFFFFF"
  },
  blue: {
    900: "#12173A",
    700: "#1A2050",
    600: "#0044CC",
    500: "#2B4AFF",
    400: "#3D5CE6",
    300: "#5B8FDF",
    200: "#8FB3EC",
    100: "#C3D6F5"
  },
  green: {
    700: "#1E7A38",
    500: "#34C759",
    300: "#7BE095"
  },
  red: {
    700: "#C0261C",
    500: "#FF453A",
    300: "#FF8F87"
  },
  amber: {
    900: "#2A1F10",
    600: "#B85E22",
    500: "#E07030",
    400: "#E0A060",
    300: "#F0C08A"
  },
  base: {
    black: "#000000"
  },
  alpha: {
    white05: "rgba(255,255,255,0.05)",
    white08: "rgba(255,255,255,0.08)",
    white12: "rgba(255,255,255,0.12)",
    white30: "rgba(255,255,255,0.30)",
    white60: "rgba(255,255,255,0.60)",
    white82: "rgba(255,255,255,0.82)",
    blue22: "rgba(61,92,230,0.22)",
    blue35: "rgba(61,92,230,0.35)",
    blue45: "rgba(61,92,230,0.45)",
    green15: "rgba(52,199,89,0.15)",
    green30: "rgba(52,199,89,0.30)",
    red12: "rgba(255,69,58,0.12)",
    red30: "rgba(255,69,58,0.30)",
    amber30: "rgba(224,160,96,0.30)",
    black40: "rgba(0,0,0,0.40)",
    black60: "rgba(0,0,0,0.60)"
  }
} as const;
