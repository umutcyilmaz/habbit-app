import type { PropsWithChildren } from "react";
import { Text, type TextProps } from "react-native";

import { theme } from "../../design-system/v4/theme";
import type { TypographyRole } from "../../design-system/v4/typography";

export type AppTextTone = keyof typeof theme.colors.text;

export type AppTextProps = PropsWithChildren<
  TextProps & {
    variant?: TypographyRole;
    tone?: AppTextTone;
  }
>;

export function AppText({
  children,
  variant = "body",
  tone = "primary",
  style,
  ...props
}: AppTextProps) {
  return (
    <Text
      {...props}
      style={[theme.typography[variant], { color: theme.colors.text[tone] }, style]}
    >
      {children}
    </Text>
  );
}
