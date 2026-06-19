export const colors = {
  background: "#F8F4EE",
  surface: "#FFFFFF",
  surfaceMuted: "#F0EAE1",
  textPrimary: "#17243A",
  textSecondary: "#5E6978",
  primary: "#14213D",
  primaryPressed: "#0E172C",
  sage: "#A8BDA1",
  sageMuted: "#E7EEE3",
  lavender: "#DDE4F7",
  lavenderDeep: "#7C8DB8",
  peach: "#F5C9AD",
  peachMuted: "#FCE8D8",
  border: "#E1D8CC",
  danger: "#B45C5C",
  white: "#FFFFFF"
} as const;

export type ColorToken = keyof typeof colors;
