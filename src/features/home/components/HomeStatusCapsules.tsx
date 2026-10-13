import { StyleSheet, View, useWindowDimensions } from "react-native";
import Svg, { Path } from "react-native-svg";
import { HomeIcon, type HomeIconName } from "./HomeIcon";
import { AppText } from "../../../shared/components/v4/AppText";

export function HomeStatusCapsules({ values }: { values: readonly { label: string; value: string; icon?: HomeIconName; id?: string; spoken?: string }[] }) {
  const large = useWindowDimensions().fontScale > 1.5;
  return <View style={styles.wrap}>
    {!large ? <Svg accessible={false} width="85%" height={28} viewBox="0 0 290 28" preserveAspectRatio="none"><Path d="M145 0V28M36 28V18Q36 12 42 12H248Q254 12 254 18V28" fill="none" stroke="rgba(255,255,255,.22)" strokeWidth={1.5} /></Svg> : null}
    <View style={[styles.row, large && styles.vertical]}>{values.map(item => <View key={item.label} style={[styles.cell, large && styles.largeCell]} accessible accessibilityLabel={item.spoken ?? `${item.label}: ${item.value}`}>
      <View style={styles.pill}>{item.icon ? <HomeIcon name={item.icon} /> : null}<AppText testID={item.id} style={styles.value}>{item.value}</AppText></View><AppText style={styles.label}>{item.label}</AppText>
    </View>)}</View>
  </View>;
}
const styles = StyleSheet.create({
  wrap: { alignItems: "center", alignSelf: "center", marginTop: 24, width: "100%", maxWidth: 380 }, row: { flexDirection: "row", gap: 8, width: "100%", maxWidth: 380 }, vertical: { flexDirection: "column", alignItems: "center", gap: 14 },
  cell: { flex: 1, minWidth: 0, alignItems: "center", gap: 10 }, largeCell: { flex: 0, width: "100%" },
  pill: { flexDirection: "row", gap: 6, minWidth: 84, minHeight: 44, borderRadius: 28, borderWidth: 1.5, borderColor: "#8693ed", backgroundColor: "rgba(0,0,0,.35)", alignItems: "center", justifyContent: "center", paddingHorizontal: 12, paddingVertical: 9, maxWidth: "100%" },
  value: { fontSize: 18, lineHeight: 24, fontFamily: "Inter_600SemiBold", fontVariant: ["tabular-nums"], textAlign: "center" }, label: { fontSize: 13, lineHeight: 18, fontFamily: "Inter_500Medium", color: "#c1c3d1", textAlign: "center" },
});
