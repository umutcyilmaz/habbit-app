import { StyleSheet, View, useWindowDimensions } from "react-native";
import { AppText } from "../../../shared/components/v4/AppText";
import type { ContentActivityDay, CalendarDay } from "./activityHistory";

const statusLabels = { untracked: "Takip yok", partial: "Kısmi takip", tracked: "Tam gün takip", violation: "Bilinçli kullanım kaydı", future: "Gelecek gün" };
const colors = { untracked: "#29292e", partial: "#5661a8", tracked: "#3a4bff", violation: "#ffbf69", future: "#19191c" };
export function ContentActivityCalendar({ days, weekly = false }: { days: ContentActivityDay[]; weekly?: boolean }) {
  const large = useWindowDimensions().fontScale > 1.5;
  const cell = (day: ContentActivityDay) => <View key={day.key} accessible accessibilityLabel={`${day.dateLabel}: ${day.end === day.start ? "Bu saat diliminde bu takvim gününe karşılık gelen zaman aralığı yok" : statusLabels[day.status]}${day.violationCount > 0 ? `, ${day.violationCount} kayıt` : ""}${day.today ? ", bugün" : ""}`}
      style={[styles.cell, !weekly && styles.heatCell, weekly && styles.weekCell, weekly && large && styles.largeWeek]}>
      <View style={[weekly ? styles.circle : styles.square, { backgroundColor: colors[day.status] }, day.today && styles.today]}>
        {weekly && !large && (day.status === "tracked" || day.status === "violation") ? <AppText accessible={false} style={styles.mark}>{day.status === "violation" ? "!" : "✓"}</AppText> : null}
      </View>
      {weekly ? <AppText accessible={false} style={styles.day}>{day.label}</AppText> : null}
    </View>;
  return <View style={weekly ? styles.grid : styles.heatRows} testID={weekly ? "bloom.content-free.week" : "bloom.content-free.four-weeks"}>
    {weekly ? days.map(cell) : [days.slice(0, 14), days.slice(14)].map((row, index) => <View key={index} style={styles.heatRow}>{row.map(cell)}</View>)}
  </View>;
}
export function TrackingActivityCalendar({ days }: { days: (CalendarDay & { count: number })[] }) {
  return <View style={styles.heatRows} testID="bloom.home.history.calendar">
    {[days.slice(0, 14), days.slice(14)].map((row, index) => <View key={index} style={styles.heatRow}>{row.map(day => <View key={day.key} style={[styles.cell, styles.heatCell]} accessible accessibilityLabel={`${day.dateLabel}: ${day.end === day.start ? "Bu saat diliminde bu takvim gününe karşılık gelen zaman aralığı yok" : `${day.count} tamamlanan oturum`}${day.today ? ", bugün" : ""}`}>
      <View style={[styles.square, { backgroundColor: day.count > 0 ? "#aab3ff" : "#29292e" }, day.today && styles.today]} />
    </View>)}</View>)}
  </View>;
}
export function ActivityLegend({ content = false }: { content?: boolean }) {
  const items = content ? [["#3a4bff", "Tam gün takip"], ["#5661a8", "Kısmi takip"], ["#ffbf69", "Bilinçli kullanım"], ["#29292e", "Takip yok"]] : [["#aab3ff", "Oturum var"], ["#29292e", "Kayıt yok"]];
  return <View style={styles.legend}>{items.map(([color, label]) => <View key={label} style={styles.legendItem}><View accessible={false} style={[styles.swatch, { backgroundColor: color! }]} /><AppText style={styles.legendText}>{label}</AppText></View>)}</View>;
}
const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", rowGap: 10, width: "100%", justifyContent: "space-between" },
  heatRows: { gap: 10 }, heatRow: { flexDirection: "row", justifyContent: "space-between", width: "100%" },
  heatCell: { width: "6%" },
  cell: { width: "13%", alignItems: "center" }, weekCell: { gap: 9 }, largeWeek: { width: "30%" },
  circle: { width: 30, height: 30, borderRadius: 20, alignItems: "center", justifyContent: "center" }, square: { width: "100%", aspectRatio: 1, borderRadius: 7 }, today: { borderColor: "#fff", borderWidth: 2 },
  // Marks are decorative; spoken cell labels carry the same distinction.
  mark: { fontSize: 17, lineHeight: 24, color: "#fff", fontFamily: "Inter_600SemiBold", maxWidth: "100%" }, day: { fontSize: 11, lineHeight: 16, color: "#c1c3d1", textAlign: "center" },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, legendItem: { maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 6 }, swatch: { width: 9, height: 9, borderRadius: 3 }, legendText: { fontSize: 12, lineHeight: 18, color: "#b4b4c0", flexShrink: 1 },
});
