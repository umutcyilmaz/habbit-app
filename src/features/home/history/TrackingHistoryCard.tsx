import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppButton } from "../../../shared/components/v4/AppButton";
import { AppCard } from "../../../shared/components/v4/AppCard";
import { AppText } from "../../../shared/components/v4/AppText";
import type { MasturbationEndingReason } from "../../../domain/models/MasturbationSession";
import { formatContentFreeEventTime } from "../../content-free/contentFreeView";
import { ActivityLegend, TrackingActivityCalendar } from "./ActivityCalendar";
import { formatHistoryDuration, type getTrackingHistory } from "./activityHistory";

const endings: Record<MasturbationEndingReason, string> = { climaxed: "Boşaldım", stoppedBeforeClimax: "Boşalmadan durdum", firmnessDecreased: "Sertlik azaldı", feltAnxious: "Kaygılı hissettim", stoppedByChoice: "Kendi isteğimle bıraktım", other: "Diğer" };
export function TrackingHistoryCard({ history }: { history: ReturnType<typeof getTrackingHistory> }) {
  const [expanded, setExpanded] = useState(false);
  const sessions = expanded ? history.sessions : history.sessions.slice(0, 3);
  const scored = history.sessions.filter(s => Number.isInteger(s.erectionQuality) && s.erectionQuality >= 1 && s.erectionQuality <= 10).slice(0, 6).reverse();
  return <AppCard testID="bloom.home.history" style={styles.card}>
    <AppText accessibilityRole="header" style={styles.title}>Takip geçmişin</AppText>
    <AppText style={styles.copy}>Son 4 hafta · {history.days.reduce((sum, d) => sum + d.count, 0)} tamamlanan oturum</AppText>
    <TrackingActivityCalendar days={history.days} /><ActivityLegend />
    <AppText style={styles.fine}>Her kare bir takvim günü. Oturum, bitiş tarihinde sayılır; boş kare kayıt bulunmadığını gösterir. Saat dilimi: {history.timeZone}.</AppText>
    {scored.length > 0 ? <View style={styles.section} testID="bloom.home.history.quality">
      <AppText accessibilityRole="header" style={styles.title}>Ereksiyon kalitesi</AppText>
      <AppText style={styles.copy}>Son {scored.length} puan · 1–10 kişisel değerlendirme</AppText>
      {scored.map(s => <View key={s.id} accessible accessibilityLabel={`${formatContentFreeEventTime(s.endedAt)}: ${s.erectionQuality}/10`} style={styles.sample}>
        <View style={styles.row}><AppText style={styles.copy}>{new Date(s.endedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}</AppText><AppText style={styles.score}>{s.erectionQuality}/10</AppText></View>
        <View style={styles.segments}>{Array.from({ length: 10 }, (_, i) => <View key={i} style={[styles.segment, i < s.erectionQuality && styles.filled]} />)}</View>
      </View>)}
      <AppText style={styles.fine}>Her satır tek bir kayıt; satırlar arasında ölçüm veya eğilim varsayılmaz.</AppText>
    </View> : null}
    <AppText accessibilityRole="header" style={styles.title}>Son oturumlar</AppText>
    {sessions.length === 0 ? <AppText testID="bloom.home.history.empty" style={styles.copy}>Henüz tamamlanmış oturum yok. Geri bildirimi kaydettiğinde gerçek tarih ve yanıtların burada görünür.</AppText> : sessions.map(s => <View testID={`bloom.home.history.session.${s.id}`} key={s.id} style={styles.record}>
      <AppText style={styles.recordTitle}>{formatContentFreeEventTime(s.endedAt)}</AppText>
      <AppText style={styles.copy}>Ereksiyon kalitesi: {s.erectionQuality == null ? "Kaydedilmedi" : `${s.erectionQuality}/10`} · Süre: {formatHistoryDuration(s.durationSeconds)}</AppText>
      <AppText style={styles.copy}>Bilinçli açık içerik: {s.usedExplicitContent == null ? "Kaydedilmedi" : s.usedExplicitContent ? "Evet" : "Hayır"} · Bitiş: {endings[s.endingReason] ?? "Kaydedilmedi"}</AppText>
      <AppText style={styles.fine}>Başlangıç: {formatContentFreeEventTime(s.startedAt)} · {s.pauses.length} duraklama</AppText>
    </View>)}
    {history.sessions.length > 3 ? <AppButton testID="bloom.home.history.toggle" variant="ghost" label={expanded ? "Daha az göster" : `Tüm ${history.sessions.length} kaydı göster`} onPress={() => setExpanded(!expanded)} /> : null}
    {history.incomplete ? <View testID="bloom.home.history.incomplete" style={styles.record}>
      <AppText style={styles.recordTitle}>{history.incomplete.status === "active" ? "Devam eden oturum" : "Geri bildirim bekleniyor"}</AppText>
      <AppText style={styles.copy}>{formatContentFreeEventTime(history.incomplete.startedAt)} · Tamamlanan oturum sayısına ve kalite grafiğine dahil edilmedi.</AppText>
    </View> : null}
  </AppCard>;
}
const styles = StyleSheet.create({
  card: { backgroundColor: "#141415", borderColor: "rgba(255,255,255,.07)", borderRadius: 30, padding: 20, gap: 14 }, title: { fontFamily: "Inter_600SemiBold", fontSize: 17, lineHeight: 24 }, recordTitle: { fontFamily: "Inter_500Medium", fontSize: 14, lineHeight: 21 }, copy: { fontSize: 14, lineHeight: 22, color: "#b4b4c0" }, fine: { fontSize: 12, lineHeight: 18, color: "#9999a6" },
  record: { gap: 6, paddingTop: 14, borderTopWidth: 1, borderTopColor: "#303036" }, section: { gap: 14, paddingVertical: 14, borderTopWidth: 1, borderBottomWidth: 1, borderColor: "#303036" }, sample: { gap: 7 }, row: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 8 }, score: { color: "#aab3ff", fontSize: 14, lineHeight: 22, fontFamily: "Inter_600SemiBold" }, segments: { flexDirection: "row", gap: 4 }, segment: { flex: 1, height: 8, borderRadius: 4, backgroundColor: "#303036" }, filled: { backgroundColor: "#aab3ff" },
});
