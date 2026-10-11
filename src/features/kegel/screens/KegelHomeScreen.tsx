import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, useReducedMotion } from "react-native-reanimated";
import { AppScreen } from "../../../shared/components/v4/AppScreen";
import { AppText } from "../../../shared/components/v4/AppText";
import { kegelPreviewConfig as config } from "../kegelConfig";
import { getKegelSetName, type KegelPreviewData } from "../kegelSession";
import { kegelColors as c } from "../kegelTheme";
import { KegelButton, KegelCard, KegelHint, KegelRow, kegelStyles as s } from "../components/KegelUI";
import { KegelGlow, KegelMetrics, KegelSymbol, PelvicMuscle } from "../components/KegelVisuals";

export function KegelHomeScreen({ introduced, data, onIntro, onStart, onMenu }: {
  introduced:boolean; data:KegelPreviewData; onIntro:()=>void; onStart:()=>void; onMenu:()=>void;
}) {
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const {width}=useWindowDimensions();
  const heatCellSize = (width - 72 - 65) / 14;
  const weekDone = data.week?.filter((n,i) => data.dayIndex!==null && i <= data.dayIndex && n > 0).length;
  // Keep the safe-area gutter outside the scroll view's bounds so scrolled
  // cards cannot paint behind the iOS time and system icons.
  return <View style={[styles.safeArea, { paddingTop: insets.top }]}>
    <AppScreen testID={introduced ? "kegel.home" : "kegel.initial"} scroll includeBottomNavClearance={false}
    showsVerticalScrollIndicator={false} style={{backgroundColor:c.canvas,paddingTop:0}} contentContainerStyle={styles.content}>
    <KegelGlow />
    <View style={styles.header}><AppText variant="display" style={styles.headerTitle}>Kegel</AppText>
      <Pressable testID="kegel.preview.menu" accessibilityRole="button" accessibilityLabel={`${data.kind==="design" ? "Örnek veri" : "Önizleme"}, Kegel önizleme seçenekleri`} onPress={onMenu} hitSlop={8} style={styles.previewTag}>
        <AppText variant="labelSmall" style={{color:c.light}}>{data.kind==="design" ? "Örnek veri" : "Önizleme"}</AppText>
      </Pressable>
    </View>
    {!introduced ? <>
      <View style={styles.hero}><PelvicMuscle demo /><AppText variant="display" style={[s.title,{fontSize:27,lineHeight:31,marginTop:14,textAlign:"left",width:"100%",paddingHorizontal:6}]}>Önce kası bul,{"\n"}sonra güçlendir</AppText></View>
      <KegelCard style={{marginTop:14}}>
        <View style={styles.chip}><KegelSymbol name="timer" size={14} /><AppText variant="labelSmall" style={{color:c.light}}>2 dakika</AppText></View>
        <AppText variant="heading1" style={s.cardTitle}>Kasını bulmayı öğren</AppText>
        <AppText style={s.cardSub}>Kısa ve etkileşimli bir tanıtım: kas nerede, nasıl bulunur, nasıl doğru sıkılır.</AppText>
        <View style={styles.mini}>{["Nerede","Bul","Sık","Teknik"].map(text => <View key={text} style={{flex:1}}><View style={styles.miniLine} /><AppText variant="labelSmall" style={{color:c.muted,textAlign:"center"}}>{text}</AppText></View>)}</View>
        <KegelButton testID="kegel.intro.start" label="Tanıtımı başlat" icon="play" onPress={onIntro} style={{marginTop:18}} />
      </KegelCard>
      <KegelCard style={{marginTop:14}}><AppText variant="heading1" style={s.cardTitle}>Neden Kegel?</AppText><View style={{marginTop:14}}>
        <KegelRow icon="drop" title="Mesane kontrolü" detail="Kaçırma ve damlamaya karşı destek" />
        <KegelRow icon="wave" title="Cinsel işlev" detail="Ereksiyon ve kontrolü destekleyebilir" />
        <KegelRow icon="body" title="Her yerde" detail="Kimse fark etmeden, günde birkaç dakika" />
      </View></KegelCard>
    </> : <>
      <View style={styles.score}>
        <AppText variant="title" style={{color:"rgba(255,255,255,.85)"}}>Bugün</AppText>
        <View style={styles.bigRow}><AppText variant="display" style={styles.big}>{data.done}</AppText><AppText variant="title" style={styles.of}>/{config.dailyTarget}</AppText></View>
        <AppText variant="titleSmall" style={{color:c.light}}>set tamamlandı</AppText>
        <KegelMetrics values={[
          {icon:"flame",value:data.streak === null ? "—" : String(data.streak),label:"Seri"},
          {icon:"cal",value:weekDone === undefined ? "—" : `${weekDone}/7`,label:"Bu hafta"},
          {icon:"rep",value:data.total === null ? "—" : String(data.total),label:"Tekrar"}
        ]} />
      </View>
      <Animated.View {...(reduceMotion ? {} : {entering:FadeIn.duration(500)})}>
        <KegelCard style={{marginTop:28}}>
          <AppText variant="heading1" style={s.cardTitle}>{data.done === 0 ? "İlk egzersizin hazır" : data.done >= config.dailyTarget ? "Bugünün setleri tamam" : getKegelSetName(data.done)}</AppText>
          <AppText style={s.cardSub}>{config.repetitions} tekrar · {config.contractionSeconds} sn sık · ~{Math.ceil(config.repetitions*(config.contractionSeconds+config.relaxationSeconds)/60)} dk</AppText>
          <KegelButton testID="kegel.exercise.start" label="Egzersizi başlat" icon="play" onPress={onStart} style={{marginTop:16}} />
        </KegelCard>
      </Animated.View>
      <KegelCard style={{marginTop:14}} testID="kegel.history">
        <AppText variant="title" style={s.section}>Seri</AppText>
        <AppText variant="heading1" style={styles.insight}>{data.kind === "design" ? `Bu hafta ${weekDone} gün egzersiz yaptın` : "Henüz egzersiz geçmişi yok"}</AppText>
        <View style={styles.week}>{["Pzt","Sal","Çar","Per","Cum","Cmt","Paz"].map((label,i) => {
          const n = data.week?.[i] ?? 0;
          return <View key={label} style={styles.day}><View style={[styles.dayRing,n >= config.dailyTarget && styles.dayFull,n > 0 && n < config.dailyTarget && styles.dayPart,i===data.dayIndex && {outlineColor:c.light,outlineWidth:1,outlineOffset:4}]}>{n >= config.dailyTarget && <KegelSymbol name="check" size={16} color={c.text} />}</View><AppText variant="labelSmall" style={{marginTop:8,color:i===data.dayIndex ? c.text : c.muted}}>{label}</AppText></View>;
        })}</View>
        <View style={styles.divider} /><AppText variant="labelSmall" style={{color:c.muted,letterSpacing:.7}}>SON 4 HAFTA</AppText>
        <View style={styles.heat}>{Array.from({length:28},(_,i) => <View key={i} style={[styles.heatCell,{width:heatCellSize,height:heatCellSize,backgroundColor:["rgba(255,255,255,.06)","#1f2766","#5868ff",c.light][data.heat?.[i] ?? 0]}]} />)}</View>
        {data.kind === "empty" ? <AppText style={styles.note}>Geçmiş verisi bağlı değil. Deneme setleri burada geçmiş veya seri oluşturmaz.</AppText> : <AppText style={styles.note}>Örnek tasarım verisi · Gerçek kullanıcı geçmişi değil</AppText>}
      </KegelCard>
      <KegelCard style={{marginTop:14}}><AppText variant="title" style={s.section}>Program</AppText>
        {config.exampleLevels.map((level,i) => <View key={level.name} style={[styles.level,i>0 && {borderTopWidth:1,borderTopColor:c.line}]}>
          <View style={[styles.levelNumber,i===0 && {backgroundColor:c.blue}]}><AppText variant="title" style={{color:i===0 ? c.text : c.muted}}>{i+1}</AppText></View>
          <View style={{flex:1}}><AppText variant="title" style={{fontSize:16.5}}>{level.name}</AppText><AppText style={{color:c.muted,fontSize:14}}>{level.seconds} sn sık · {level.seconds} sn gevşe</AppText></View>
          <AppText variant="labelSmall" style={{color:c.muted}}>Örnek</AppText>
        </View>)}
        <KegelHint>Bu süreler ve günlük hedef tasarım örneğidir. Program ve seviye geçişleri henüz belirlenmedi.</KegelHint>
      </KegelCard>
      <KegelButton label="Tekniği tekrar gör" secondary onPress={onIntro} style={{marginTop:14}} />
    </>}
    <AppText style={[styles.note,{textAlign:"center",marginTop:18}]}>İzole önizleme · Denemeler kaydedilmez</AppText>
  </AppScreen></View>;
}

const styles = StyleSheet.create({
  safeArea: { flex:1,backgroundColor:c.canvas },
  content: { paddingHorizontal:16,paddingTop:0,paddingBottom:40 },
  header: { height:60,flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:6 },
  headerTitle: { fontSize:31,lineHeight:39,letterSpacing:-.9 },
  previewTag: { minHeight:44,paddingHorizontal:10,justifyContent:"center" },
  hero: { alignItems:"center",paddingTop:10 },
  chip: { alignSelf:"flex-start",backgroundColor:"rgba(58,75,255,.22)",borderRadius:999,paddingHorizontal:12,paddingVertical:6,flexDirection:"row",alignItems:"center",gap:6,marginBottom:12 },
  mini: { flexDirection:"row",gap:6,marginTop:16 }, miniLine: { height:4,borderRadius:2,backgroundColor:c.subtle,marginBottom:8 },
  score: { alignItems:"center",paddingTop:30 },bigRow: { flexDirection:"row",gap:6,alignItems:"center",marginTop:6 },
  big: { fontSize:64,lineHeight:72,letterSpacing:-1 },of: { fontSize:30,lineHeight:38,color:c.muted,marginTop:12 },
  insight: { fontSize:19,lineHeight:25,textAlign:"center",marginTop:14 },
  week: { flexDirection:"row",marginTop:18,justifyContent:"space-between" },day: { alignItems:"center",flex:1 },
  dayRing: { width:36,height:36,borderRadius:18,borderWidth:2,borderColor:"rgba(255,255,255,.1)",alignItems:"center",justifyContent:"center" },
  dayFull: { backgroundColor:c.blue,borderColor:c.highlight },dayPart: { borderTopColor:c.light,borderRightColor:c.light },
  divider: { height:1,backgroundColor:c.line,marginVertical:18 },
  heat: { flexDirection:"row",flexWrap:"wrap",gap:5,marginTop:14 },heatCell: { borderRadius:5 },
  note: { fontSize:12,lineHeight:18,color:c.muted,marginTop:12 },
  level: { flexDirection:"row",alignItems:"center",gap:14,paddingVertical:12 },levelNumber: { width:38,height:38,borderRadius:13,backgroundColor:c.icon,alignItems:"center",justifyContent:"center" }
});
