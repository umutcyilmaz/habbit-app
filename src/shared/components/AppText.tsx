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
    fontSize: theme.typography.size.heading,
    lineHeight: theme.typography.lineHeight.heading,
    fontWeight: theme.typography.weight.bold
  },
  title: {
    fontSize: theme.typography.size.title,
    lineHeight: theme.typography.lineHeight.title,
    fontWeight: theme.typography.weight.semibold
  },
  body: {
    fontSize: theme.typography.size.body,
    lineHeight: theme.typography.lineHeight.body,
    fontWeight: theme.typography.weight.regular
  },
  bodySmall: {
    fontSize: theme.typography.size.bodySmall,
    lineHeight: theme.typography.lineHeight.bodySmall,
    fontWeight: theme.typography.weight.regular
  },
  caption: {
    fontSize: theme.typography.size.caption,
    lineHeight: theme.typography.lineHeight.caption,
    fontWeight: theme.typography.weight.medium
  },
  label: {
    fontSize: theme.typography.size.bodySmall,
    lineHeight: theme.typography.lineHeight.bodySmall,
    fontWeight: theme.typography.weight.semibold
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
