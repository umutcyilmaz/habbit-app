import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppCard } from "../../../shared/components/v4/AppCard";
import { AppText } from "../../../shared/components/v4/AppText";
import { AppButton } from "../../../shared/components/v4/AppButton";
import { HomeIcon } from "../../home/components/HomeIcon";
import { ActivityLegend, ContentActivityCalendar } from "../../home/history/ActivityCalendar";
import { formatHistoryDuration, type getContentStreakHistory, type getContentActivity } from "../../home/history/activityHistory";
import { formatContentFreeEventTime } from "../contentFreeView";

export function ContentFreeActivity({ weeks, week, streaks, timeZone }: {
  weeks: ReturnType<typeof getContentActivity>; week: ReturnType<typeof getContentActivity>;
  streaks: ReturnType<typeof getContentStreakHistory>; timeZone: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const tracked = week.filter(d => d.trackedSeconds > 0).length;
  return <View style={styles.stack}>
    <AppCard testID="bloom.content-free.activity" style={styles.card}>
      <AppText accessibilityRole="header" style={styles.title}>Seri takvimi</AppText>
      <AppText style={styles.copy}>Bu hafta {tracked} takvim gününde takip süresi var</AppText>
      <ContentActivityCalendar days={week} weekly />
      <View style={styles.divider} /><AppText style={styles.eyebrow}>SON 4 HAFTA</AppText>
      <ContentActivityCalendar days={weeks} /><ActivityLegend content />
      <AppText style={styles.fine}>Renkler kayıtlı sayaç ve kazanılmış Reset sürelerini gösterir. Kısmi gün tam gün sayılmaz. Bilinçli kullanım amber; geri alınmış kayıt işaretlenmez. Takip olmayan günler için içerik kullanımı bilinmez.</AppText>
      <AppText style={styles.fine}>Soldan sağa, eskiden yeniye · Saat dilimi: {timeZone}</AppText>
    </AppCard>
    <AppCard testID="bloom.content-free.streak-history" style={styles.card}>
      <AppText accessibilityRole="header" style={styles.title}>Seri geçmişin</AppText>
      {streaks.length === 0 ? <AppText style={styles.copy}>Henüz bir seri yok. Sayacı başlattığında geçmişin oluşmaya başlar.</AppText> : (expanded ? streaks : streaks.slice(0, 3)).map(s => <View key={s.id} style={styles.record} testID={`bloom.content-free.streak.${s.id}`}>
        <AppText style={styles.value}>{formatHistoryDuration(s.seconds)}</AppText>
        <AppText style={styles.copy}>{s.endReason === "active" ? "Devam ediyor" : s.endReason === "stopped" ? "Sayaç durduruldu" : "Bilinçli kullanım kaydıyla sona erdi"}</AppText>
        <AppText style={styles.fine}>{formatContentFreeEventTime(s.startedAt)} → {s.endReason === "active" ? "Şimdi" : formatContentFreeEventTime(s.endedAt)}</AppText>
        {s.resetSeconds > 0 ? <AppText style={styles.fine}>Süreye {formatHistoryDuration(s.resetSeconds)} kazanılmış Reset süresi dahil. Reset ile aktivasyon arasındaki boşluk sayılmaz.</AppText> : null}
      </View>)}
      {streaks.length > 3 ? <AppButton testID="bloom.content-free.streak-history.toggle" variant="ghost" label={expanded ? "Daha az göster" : `Tüm ${streaks.length} seriyi göster`} onPress={() => setExpanded(!expanded)} /> : null}
    </AppCard>
    <AppCard testID="bloom.content-free.protection-unavailable" style={styles.card}>
      <View style={styles.protectionLabel}><HomeIcon name="shield" /><AppText style={styles.eyebrow}>KORUMA · YOK</AppText></View>
      <AppText accessibilityRole="header" style={styles.title}>Engel yok</AppText>
      <View accessible={false} style={styles.shield}><HomeIcon name="shield" size={60} /></View>
      <AppText style={styles.copy}>Bloom’da sistem düzeyinde içerik engelleme şu anda kullanılamıyor. Sayaç yalnızca zaman ve bildirdiğin bilinçli kullanım kayıtlarını izler.</AppText>
    </AppCard>
  </View>;
}
const styles = StyleSheet.create({
  stack: { gap: 14 }, card: { backgroundColor: "#141415", borderColor: "rgba(255,255,255,.07)", borderRadius: 30, padding: 20, gap: 16 }, title: { fontFamily: "Inter_600SemiBold", fontSize: 19, lineHeight: 27 }, copy: { fontSize: 14, lineHeight: 22, color: "#b4b4c0" }, fine: { fontSize: 12, lineHeight: 19, color: "#9999a6" }, eyebrow: { fontFamily: "Inter_600SemiBold", fontSize: 11, lineHeight: 17, color: "#aab3ff", letterSpacing: .8, flexShrink: 1 }, value: { fontSize: 19, lineHeight: 28, fontFamily: "Inter_600SemiBold", color: "#aab3ff" }, record: { gap: 6, borderTopWidth: 1, borderColor: "#303036", paddingTop: 14 }, divider: { height: 1, backgroundColor: "#303036", marginVertical: 4 }, protectionLabel: { flexDirection: "row", alignItems: "center", gap: 9 }, shield: { alignSelf: "center", padding: 26, borderRadius: 100, backgroundColor: "#222333" },
});
