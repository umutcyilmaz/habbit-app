import type { TextStyle } from "react-native";

import { fontFamily } from "../fonts";

const typographyRoles = {
  display: {
    fontFamily: fontFamily.Inter_700Bold,
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: 0
  },
  heading1: {
    fontFamily: fontFamily.Inter_700Bold,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: 0
  },
  heading2: {
    fontFamily: fontFamily.Inter_600SemiBold,
    fontSize: 17,
    lineHeight: 25.5,
    letterSpacing: 0
  },
  title: {
    fontFamily: fontFamily.Inter_600SemiBold,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0
  },
  titleSmall: {
    fontFamily: fontFamily.Inter_600SemiBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0
  },
  bodyLarge: {
    fontFamily: fontFamily.Inter_400Regular,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0
  },
  body: {
    fontFamily: fontFamily.Inter_400Regular,
    fontSize: 14,
    lineHeight: 21,
    letterSpacing: 0
  },
  bodySmall: {
    fontFamily: fontFamily.Inter_400Regular,
    fontSize: 13,
    lineHeight: 19.5,
    letterSpacing: 0
  },
  label: {
    fontFamily: fontFamily.Inter_600SemiBold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0
  },
  labelSmall: {
    fontFamily: fontFamily.Inter_500Medium,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0
  },
  labelNav: {
    fontFamily: fontFamily.Inter_500Medium,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0
  },
  caption: {
    fontFamily: fontFamily.JetBrainsMono_400Regular,
    fontSize: 11,
    lineHeight: 16.5,
    letterSpacing: 0
  },
  monoBody: {
    fontFamily: fontFamily.JetBrainsMono_400Regular,
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 0
  },
  monoLabel: {
    fontFamily: fontFamily.JetBrainsMono_500Medium,
    fontSize: 13,
    lineHeight: 19.5,
    letterSpacing: 0
  },
  overline: {
    fontFamily: fontFamily.JetBrainsMono_500Medium,
    fontSize: 10,
    lineHeight: 15,
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  numericTimer: {
    fontFamily: fontFamily.JetBrainsMono_800ExtraBold_Italic,
    fontSize: 32,
    lineHeight: 40,
    letterSpacing: 0
  },
  numericValue: {
    fontFamily: fontFamily.JetBrainsMono_500Medium,
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: 0
  }
} as const satisfies Record<string, TextStyle>;

export const typography = typographyRoles;

export type TypographyRole = keyof typeof typography;
