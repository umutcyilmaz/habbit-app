import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { AppState, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { routes } from "../../../constants/navigation";
import { AppScreen } from "../../../shared/components/v4/AppScreen";
import { AppText } from "../../../shared/components/v4/AppText";
import { AppCard } from "../../../shared/components/v4/AppCard";
import { BloomTabIcon } from "../../../shared/navigation/BloomBottomNavigation";
import { ProfileIcon, type ProfileIconName } from "../components/ProfileIcon";
import { getProfileReadModel } from "../profileReadModel";

export function ProfileEntryScreen() {
  const router = useRouter(), insets = useSafeAreaInsets(), reduced = useReducedMotion();
  const largeText = useWindowDimensions().fontScale > 1.5;
  const bloom = useBloomLocalState();
  const [clock, setClock] = useState(() => bloom.now());
  useFocusEffect(useCallback(() => {
    const refresh = () => setClock(bloom.now());
    refresh();
    const timer = setInterval(refresh, 60000);
    const subscription = AppState.addEventListener("change", state => { if (state === "active") refresh(); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [bloom.now]));
  const profile = getProfileReadModel(bloom, clock);
  const enter = (delay: number) => reduced ? {} : { entering: FadeInDown.delay(delay).duration(350) };
  return <View style={[styles.safeArea, { paddingTop: insets.top }]}>
    <StatusBar style="light" />
    <AppScreen scroll testID="bloom.profile" includeBottomNavClearance={false} style={styles.screen} contentContainerStyle={styles.content}>
      <Animated.View {...enter(0)}>
        <View style={styles.header}><AppText accessibilityRole="header" style={styles.title}>Profil</AppText>
          <Pressable testID="bloom.profile.settings" accessibilityRole="button" accessibilityLabel="Ayarlar" style={({pressed}) => [styles.settings, pressed && styles.pressed]} onPress={() => router.push(routes.settings)}><ProfileIcon name="settings" color="#fff" size={22} /></Pressable>
        </View>
        <AppCard style={[styles.identity,largeText && styles.identityLarge]}>
          <View accessible={false} style={styles.avatar}><BloomTabIcon name="profile" color="#fff" /></View>
          <View style={[styles.identityText,largeText && styles.identityTextLarge]}><AppText style={styles.name}>Kişisel alanın</AppText><AppText style={styles.copy}>Verilerin bu cihazda</AppText></View>
          <View style={[styles.badge,largeText && styles.badgeLarge]}><AppText style={styles.badgeText}>Yerel profil</AppText></View>
        </AppCard>
      </Animated.View>
      {profile === null ? <AppCard style={styles.card}><AppText accessibilityLiveRegion="polite">Profil özeti şu an kullanılamıyor.</AppText></AppCard> : <>
        <Animated.View {...enter(70)}>
          <AppCard style={[styles.stats,largeText && styles.statsLarge]}>
            {[
              {id:"content-free",value:profile.contentFreeDays ?? "—",label:"İçeriksiz\ngün",spoken:profile.contentFreeDays === null ? "İçeriksiz sayaç kapalı" : `${profile.contentFreeDays} tamamlanan içeriksiz gün`},
              {id:"practice",value:profile.completedPracticeCount,label:"Takip\noturumu",spoken:`${profile.completedPracticeCount} tamamlanan takip oturumu, tüm zamanlar`},
              {id:"kegel",value:profile.kegelStreak,label:"Kegel\nserisi",spoken:`${profile.kegelStreak} gün Kegel serisi`}
            ].map((stat,index) => <View key={stat.id} accessible accessibilityLabel={stat.spoken} style={[styles.stat,largeText && styles.statLarge,index > 0 && (largeText ? styles.statLargeBorder : styles.statBorder)]}>
              <AppText testID={`bloom.profile.stat.${stat.id}`} style={styles.number}>{stat.value}</AppText><AppText style={styles.statLabel}>{stat.label}</AppText>
            </View>)}
          </AppCard>
          <AppCard style={styles.records}><AppText accessibilityRole="header" style={styles.cardHeading}>Rekorların</AppText>
            {[
              ["En uzun içeriksiz seri",`${profile.bestContentFreeDays} gün`],
              ["Tamamlanan Kegel seti",String(profile.completedKegelSets)],
              ["Toplam Kegel tekrarı",String(profile.kegelRepetitions)],
              ["Tamamlanan yazı",String(profile.completedArticleCount)]
            ].map(([label,value],index) => <View key={label} style={[styles.record,index > 0 && styles.separator]} accessible accessibilityLabel={`${label}: ${value}`}><AppText style={styles.recordLabel}>{label}</AppText><AppText style={styles.recordValue}>{value}</AppText></View>)}
          </AppCard>
          <AppText style={styles.note}>İçeriksiz günler tamamlanan 24 saatleri, Kegel serisi kayıtlı yerel günleri sayar. Takip sayısı, tamamlanan tüm takip oturumlarını kapsar.</AppText>
        </Animated.View>
        <Animated.View {...enter(130)}>
          <Section title="Senin için" />
          <AppCard style={styles.group}>
            <ProfileRow icon="assessment" id="assessment" title="Değerlendirmem" detail={profile.assessmentDetail} onPress={profile.assessmentAvailable ? () => router.push("/bloom/starting-recommendation") : undefined} />
            <ProfileRow border icon="report" id="reports" title="Reset raporları" detail={`${profile.completedResetCount > 0 ? `${profile.completedResetCount} tamamlanan Reset · ` : "Henüz tamamlanan Reset yok · "}raporlar henüz kullanıma açık değil`} />
            <ProfileRow border icon="saved" id="saved" title="Kaydedilen yazılar" detail={`${profile.savedArticleCount} yazı`} onPress={() => router.push("/bloom/profile/saved")} />
          </AppCard>
        </Animated.View>
      </>}
      <Animated.View {...enter(180)}>
        <Section title="Abonelik" />
        <AppCard style={styles.group}><ProfileRow icon="member" id="membership" title="Üyelik bilgisi kullanılamıyor" detail="Satın alma ve abonelik yönetimi henüz kullanıma açık değil" /></AppCard>
        <Section title="Ayarlar ve gizlilik" />
        <AppCard style={styles.group}>
          <ProfileRow icon="settings" id="settings-row" title="Ayarlar" detail="Tercihler ve mevcut kontroller" onPress={() => router.push(routes.settings)} />
          <ProfileRow border icon="privacy" id="privacy" title="Gizlilik" detail="Yerel veri ve gizlilik bilgileri" onPress={() => router.push(routes.settingsPrivacy)} />
          <ProfileRow border icon="data" id="data-controls" title="Veri kontrolleri" detail="Cihazındaki verileri yönet" onPress={() => router.push(routes.settingsDataControls)} />
        </AppCard>
        <AppText style={styles.footer}>Kendi ritminde, kendin için.</AppText>
      </Animated.View>
    </AppScreen>
  </View>;
}
function Section({title}:{title:string}) { return <AppText accessibilityRole="header" style={styles.section}>{title.toLocaleUpperCase("tr-TR")}</AppText>; }
function ProfileRow({icon,id,title,detail,border=false,onPress}:{icon:ProfileIconName;id:string;title:string;detail:string;border?:boolean;onPress?: (() => void) | undefined}) {
  const content = <><View accessible={false} style={styles.rowIcon}><ProfileIcon name={icon} /></View><View style={styles.rowText}><AppText style={styles.rowTitle}>{title}</AppText><AppText style={styles.copy}>{detail}</AppText></View>{onPress ? <AppText accessible={false} style={styles.chevron}>›</AppText> : null}</>;
  const base = [styles.row,border && styles.separator];
  return onPress ? <Pressable testID={`bloom.profile.${id}`} accessibilityRole="button" accessibilityLabel={`${title}, ${detail}`} onPress={onPress} style={({pressed}) => [...base,pressed && styles.pressed]}>{content}</Pressable>
    : <View testID={`bloom.profile.${id}`} accessible accessibilityLabel={`${title}, ${detail}`} style={base}>{content}</View>;
}
const styles = StyleSheet.create({
  safeArea:{flex:1,backgroundColor:"#000"}, screen:{backgroundColor:"#000",paddingTop:0}, content:{paddingHorizontal:16,paddingTop:8,paddingBottom:30},
  header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:6,marginBottom:8,gap:8}, title:{flex:1,fontFamily:"Inter_700Bold",fontSize:31,lineHeight:42,letterSpacing:-.9},
  settings:{width:44,height:44,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:"#141415"}, pressed:{opacity:.65},
  card:{backgroundColor:"#141415",borderColor:"rgba(255,255,255,.07)",borderRadius:30,padding:20}, identity:{backgroundColor:"#141415",borderColor:"rgba(255,255,255,.07)",borderRadius:30,padding:20,flexDirection:"row",alignItems:"center",gap:14},
  avatar:{width:60,height:60,borderRadius:30,backgroundColor:"#3a4bff",alignItems:"center",justifyContent:"center"}, identityText:{flex:1,gap:2}, name:{fontFamily:"Inter_600SemiBold",fontSize:19,lineHeight:24},
  identityLarge:{flexDirection:"column",alignItems:"flex-start"},identityTextLarge:{flex:0,width:"100%"},badgeLarge:{maxWidth:"100%"},statsLarge:{flexDirection:"column"},statLarge:{flex:0,width:"100%",paddingVertical:14},statLargeBorder:{borderTopWidth:1,borderTopColor:"rgba(255,255,255,.08)"},
  copy:{fontSize:13.5,lineHeight:19,color:"#8e8e93"}, badge:{borderRadius:20,backgroundColor:"rgba(58,75,255,.17)",paddingHorizontal:9,paddingVertical:6,maxWidth:80}, badgeText:{color:"#aab3ff",fontSize:11,lineHeight:15,fontFamily:"Inter_600SemiBold",textAlign:"center"},
  stats:{backgroundColor:"#141415",borderColor:"rgba(255,255,255,.07)",borderRadius:30,paddingVertical:20,paddingHorizontal:8,marginTop:14,flexDirection:"row"}, stat:{flex:1,alignItems:"center",paddingHorizontal:4}, statBorder:{borderLeftWidth:1,borderLeftColor:"rgba(255,255,255,.08)"}, number:{fontFamily:"Inter_700Bold",fontSize:34,lineHeight:41}, statLabel:{fontSize:13,lineHeight:18,color:"#8e8e93",textAlign:"center",marginTop:8},
  records:{backgroundColor:"#141415",borderColor:"rgba(255,255,255,.07)",borderRadius:30,padding:20,marginTop:14}, cardHeading:{fontSize:16,fontFamily:"Inter_600SemiBold",marginBottom:8}, record:{flexDirection:"row",alignItems:"center",gap:12,paddingVertical:12}, recordLabel:{flex:1,fontSize:15,lineHeight:21,color:"#8e8e93"}, recordValue:{fontFamily:"Inter_600SemiBold",fontSize:15,lineHeight:21}, note:{fontSize:12,lineHeight:18,color:"#8e8e93",marginHorizontal:6,marginTop:12},
  section:{fontSize:13,lineHeight:18,fontFamily:"Inter_600SemiBold",letterSpacing:.8,color:"#8e8e93",marginTop:30,marginBottom:10,marginHorizontal:6},
  group:{minHeight:0,backgroundColor:"#141415",borderColor:"rgba(255,255,255,.07)",borderRadius:26,paddingHorizontal:16,paddingVertical:2}, row:{minHeight:70,flexDirection:"row",alignItems:"center",gap:14,paddingVertical:13}, separator:{borderTopWidth:1,borderTopColor:"rgba(255,255,255,.08)"}, rowIcon:{width:38,height:38,borderRadius:12,backgroundColor:"#2a2a2d",alignItems:"center",justifyContent:"center"}, rowText:{flex:1,gap:2}, rowTitle:{fontFamily:"Inter_500Medium",fontSize:16.5,lineHeight:22}, chevron:{color:"#8e8e93",fontSize:24}, footer:{color:"#8e8e93",fontSize:12,textAlign:"center",marginTop:24}
});
