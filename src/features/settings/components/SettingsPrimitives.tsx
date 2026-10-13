import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppScreen } from "../../../shared/components/v4/AppScreen";
import { AppText } from "../../../shared/components/v4/AppText";
import { AppCard } from "../../../shared/components/v4/AppCard";
import { SettingsIcon, type SettingsIconName } from "./SettingsIcon";

export function SettingsPage({ children, id }: PropsWithChildren<{ id: string }>) {
  const insets = useSafeAreaInsets();
  return <AppScreen scroll testID={`bloom.settings.${id}`} includeBottomNavClearance={false}
    style={{ backgroundColor: "#000", paddingTop: 0 }}
    contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 30 + insets.bottom }}>
    {children}
  </AppScreen>;
}

export function SettingsGroup({ title, children }: PropsWithChildren<{ title: string }>) {
  return <View style={styles.section}>
    <AppText accessibilityRole="header" style={styles.sectionTitle}>{title.toLocaleUpperCase("tr-TR")}</AppText>
    <AppCard style={styles.group}>{children}</AppCard>
  </View>;
}

type RowProps = {
  id: string; title: string; detail: string; icon?: SettingsIconName;
  border?: boolean; danger?: boolean; onPress?: (() => void) | undefined;
};
export function SettingsRow({ id, title, detail, icon = "settings", border, danger, onPress }: RowProps) {
  const content = <>
    <View accessible={false} style={styles.icon}><SettingsIcon name={icon} color={danger ? "#ff6b70" : "#aab3ff"} /></View>
    <View style={styles.text}><AppText style={[styles.rowTitle, danger && styles.danger]}>{title}</AppText><AppText style={styles.copy}>{detail}</AppText></View>
    {onPress ? <AppText accessible={false} style={styles.chevron}>›</AppText> : null}
  </>;
  const base = [styles.row, border && styles.border];
  return onPress ? <Pressable testID={`bloom.settings.${id}`} accessibilityRole="button" accessibilityLabel={`${title}, ${detail}`}
    onPress={onPress} style={({ pressed }) => [...base, pressed && { opacity: .65 }]}>{content}</Pressable>
    : <View testID={`bloom.settings.${id}`} accessible accessibilityLabel={`${title}, ${detail}`} style={base}>{content}</View>;
}

export function SettingsNote({ children }: PropsWithChildren) {
  return <AppText style={styles.note}>{children}</AppText>;
}

export const settingsStyles = StyleSheet.create({
  panel: { backgroundColor: "#141415", borderRadius: 26, borderColor: "rgba(255,255,255,.07)", padding: 20, gap: 14, marginBottom: 20 },
  heading: { fontFamily: "Inter_600SemiBold", fontSize: 20, lineHeight: 28 },
  copy: { color: "#8e8e93", fontSize: 14, lineHeight: 21 },
  danger: { color: "#ff6b70" },
  actions: { gap: 10 },
  button: { borderRadius: 28 },
});
const styles = StyleSheet.create({
  section: { marginBottom: 36 },
  sectionTitle: { fontSize: 13, lineHeight: 18, fontFamily: "Inter_600SemiBold", letterSpacing: .8, color: "#8e8e93", marginHorizontal: 6, marginBottom: 10 },
  group: { minHeight: 0, backgroundColor: "#141415", borderColor: "rgba(255,255,255,.07)", borderRadius: 26, paddingHorizontal: 16, paddingVertical: 2 },
  row: { minHeight: 70, flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13 },
  border: { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,.08)" },
  icon: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#2a2a2d", alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 }, rowTitle: { fontFamily: "Inter_500Medium", fontSize: 16.5, lineHeight: 22 },
  copy: { fontSize: 13.5, lineHeight: 19, color: "#8e8e93" }, danger: { color: "#ff6b70" },
  chevron: { color: "#8e8e93", fontSize: 24 }, note: { fontSize: 13, lineHeight: 20, color: "#8e8e93", textAlign: "center", marginHorizontal: 6, marginBottom: 20 },
});
