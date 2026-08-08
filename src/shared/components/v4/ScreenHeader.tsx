import { StyleSheet, View, type ViewProps } from "react-native";

import { theme } from "../../design-system/v4/theme";
import { AppText } from "./AppText";

export type ScreenHeaderProps = ViewProps & {
  title: string;
  body?: string;
};

export function ScreenHeader({ title, body, style, ...props }: ScreenHeaderProps) {
  return (
    <View {...props} style={[styles.header, style]}>
      <AppText variant="heading1" tone="primary" style={styles.text}>
        {title}
      </AppText>
      {body && body !== "" ? (
        <AppText variant="body" tone="secondary" style={styles.text}>
          {body}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    gap: theme.spacing.xs,
    justifyContent: "center",
    width: "100%"
  },
  text: {
    textAlign: "center"
  }
});
