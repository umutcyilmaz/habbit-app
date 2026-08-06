import { primitives } from "./primitives";

/**
 * V4 semantic colors (design-tokens.json -> semantic).
 * All 48 values resolve through `primitives`; no raw hex is duplicated here.
 */
export const colors = {
  bg: {
    canvas: primitives.neutral[950],
    surface: primitives.neutral[900],
    surfaceRaised: primitives.neutral[875],
    surfaceElevated: primitives.neutral[800],
    surfaceHover: primitives.neutral[775],
    surfaceSunken: primitives.neutral[975],
    inverse: primitives.neutral[0],
    overlay: primitives.alpha.black60,
    accentSubtle: primitives.alpha.blue22,
    successSubtle: primitives.alpha.green15,
    dangerSubtle: primitives.alpha.red12,
    warningSubtle: primitives.amber[900],
    infoSubtle: primitives.blue[900]
  },
  action: {
    primary: primitives.blue[500],
    primaryPressed: primitives.blue[600],
    primaryDisabled: primitives.neutral[800],
    secondary: primitives.neutral[800],
    secondaryPressed: primitives.neutral[775]
  },
  accent: {
    primary: primitives.blue[500],
    success: primitives.green[500],
    warning: primitives.amber[500],
    danger: primitives.red[500]
  },
  text: {
    primary: primitives.neutral[0],
    primarySoft: primitives.neutral[100],
    secondary: primitives.neutral[400],
    tertiary: primitives.neutral[300],
    muted: primitives.neutral[430],
    disabled: primitives.neutral[600],
    onPrimary: primitives.neutral[0],
    onInverse: primitives.neutral[950],
    onAccent: primitives.neutral[0],
    accent: primitives.blue[300],
    link: primitives.blue[300],
    success: primitives.green[500],
    danger: primitives.red[300],
    warning: primitives.amber[400],
    info: primitives.blue[200]
  },
  border: {
    subtle: primitives.alpha.white05,
    default: primitives.neutral[800],
    strong: primitives.neutral[750],
    muted: primitives.neutral[600],
    selected: primitives.alpha.white30,
    focus: primitives.alpha.blue45,
    accent: primitives.alpha.blue35,
    success: primitives.green[500],
    danger: primitives.red[500],
    warning: primitives.amber[400],
    info: primitives.blue[400]
  }
} as const;
