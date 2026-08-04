import type { PropsWithChildren } from "react";
import { StyleSheet, Text, type TextProps, type TextStyle } from "react-native";

import { theme } from "../design-system/theme";

type AppTextVariant = "heading" | "title" | "body" | "bodySmall" | "caption" | "label";
type AppTextTone = "primary" | "secondary" | "inverse" | "danger";

type AppTextProps = PropsWithChildren<
  TextProps & {
    variant?: AppTextVariant;
    tone?: AppTextTone;
    align?: TextStyle["textAlign"];
  }
>;

export function AppText({
  children,
  variant = "body",
  tone = "primary",
  align,
  style,
  ...props
}: AppTextProps) {
  return (
    <Text
      {...props}
      style={[
        styles.base,
        styles[variant],
        toneStyles[tone],
        align ? { textAlign: align } : undefined,
        style
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  base: {
    color: theme.colors.textPrimary,
    letterSpacing: 0
  },
  heading: {
    fontFamily: theme.typography.family.bold,
    fontSize: theme.typography.size.heading,
    lineHeight: theme.typography.lineHeight.heading
  },
  title: {
    fontFamily: theme.typography.family.semibold,
    fontSize: theme.typography.size.title,
    lineHeight: theme.typography.lineHeight.title
  },
  body: {
    fontFamily: theme.typography.family.regular,
    fontSize: theme.typography.size.body,
    lineHeight: theme.typography.lineHeight.body
  },
  bodySmall: {
    fontFamily: theme.typography.family.regular,
    fontSize: theme.typography.size.bodySmall,
    lineHeight: theme.typography.lineHeight.bodySmall
  },
  caption: {
    fontFamily: theme.typography.family.medium,
    fontSize: theme.typography.size.caption,
    lineHeight: theme.typography.lineHeight.caption
  },
  label: {
    fontFamily: theme.typography.family.semibold,
    fontSize: theme.typography.size.bodySmall,
    lineHeight: theme.typography.lineHeight.bodySmall
  }
});

const toneStyles = StyleSheet.create({
  primary: {
    color: theme.colors.textPrimary
  },
  secondary: {
    color: theme.colors.textSecondary
  },
  inverse: {
    color: theme.colors.white
  },
  danger: {
    color: theme.colors.danger
  }
});
