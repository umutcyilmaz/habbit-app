import { theme } from "../../shared/design-system/v4/theme";

// Feature-local HTML overrides. Do not change the V4 system for other screens.
export const kegelColors = {
  canvas: "#000000", card: "#141415", raised: "#1e1e20", icon: "#2a2a2d",
  text: theme.colors.text.primary, muted: "#8e8e93", blue: "#3a4bff",
  light: "#aab3ff", highlight: "#6f7cff", warning: "#eaa95c",
  line: "rgba(255,255,255,.08)", subtle: "rgba(255,255,255,.12)"
} as const;
