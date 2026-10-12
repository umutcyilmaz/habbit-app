import { useRouter } from "expo-router";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { routes } from "../../../constants/navigation";
import { AppScreen } from "../../../shared/components/v4/AppScreen";
import { AppText } from "../../../shared/components/v4/AppText";
import { AppCard } from "../../../shared/components/v4/AppCard";
import { BloomTabIcon } from "../../../shared/navigation/BloomBottomNavigation";
export function ProfileEntryScreen() {
  const router=useRouter();
  const insets=useSafeAreaInsets();
  return <View style={[styles.safeArea,{paddingTop:insets.top}]}><AppScreen scroll testID="bloom.profile" includeBottomNavClearance={false} style={styles.screen} contentContainerStyle={styles.content}>
    <View style={styles.header}><AppText variant="display" accessibilityRole="header" style={styles.title}>Profil</AppText>
      <Pressable testID="bloom.profile.settings" accessibilityRole="button" accessibilityLabel="Ayarlar" style={styles.settings} onPress={()=>router.push(routes.settings)}><SettingsSymbol /></Pressable>
    </View>
    <AppCard style={styles.profile}><View style={styles.avatar}><BloomTabIcon name="profile" color="#aab3ff" /></View>
      <View style={{flex:1,gap:5}}><AppText variant="title" style={{fontSize:21}}>Kişisel alanın</AppText><AppText style={styles.copy}>Verilerin bu cihazda saklanır.</AppText></View>
    </AppCard>
    <AppText variant="label" style={styles.section}>AYARLAR</AppText>
    <AppCard style={styles.group}>{[
      {title:"Ayarlar",detail:"Mevcut tercih ve veri kontrolleri",href:routes.settings,id:"settings-row"},
      {title:"Gizlilik",detail:"Yerel veri ve gizlilik bilgileri",href:routes.settingsPrivacy,id:"privacy"},
      {title:"Veri kontrolleri",detail:"Mevcut yerel veri yönetimi",href:routes.settingsDataControls,id:"data-controls"}
    ].map((row,i)=><Pressable key={row.id} testID={`bloom.profile.${row.id}`} accessibilityRole="button" onPress={()=>router.push(row.href)} style={[styles.row,i>0 && styles.separator]}>
      <View style={{flex:1,gap:4}}><AppText variant="titleSmall">{row.title}</AppText><AppText style={styles.copy}>{row.detail}</AppText></View><AppText style={{color:"#6c6c73",fontSize:25}}>›</AppText>
    </Pressable>)}</AppCard>
    <AppText style={styles.copy}>Profil özeti ve geçmiş görünümleri henüz hazır değil.</AppText>
  </AppScreen></View>;
}
function SettingsSymbol() {
  return <View accessible={false} style={{width:24,height:24}}>
    {[0,45,90,135].map(angle=><View key={angle} style={{position:"absolute",width:24,height:24,transform:[{rotate:`${angle}deg`}]}}>
      <View style={{position:"absolute",left:9.5,top:0,width:5,height:4,borderRadius:1,backgroundColor:"#fff"}} />
      <View style={{position:"absolute",left:9.5,bottom:0,width:5,height:4,borderRadius:1,backgroundColor:"#fff"}} />
    </View>)}
    <View style={{position:"absolute",left:4,top:4,width:16,height:16,borderRadius:8,backgroundColor:"#fff"}} />
    <View style={{position:"absolute",left:9,top:9,width:6,height:6,borderRadius:3,backgroundColor:"#141415"}} />
  </View>;
}
const styles=StyleSheet.create({safeArea:{flex:1,backgroundColor:"#000"},screen:{backgroundColor:"#000",paddingTop:0},content:{paddingHorizontal:20,paddingTop:16,paddingBottom:30,gap:18},
  header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},title:{fontSize:31,lineHeight:39,letterSpacing:-.9},
  settings:{width:44,height:44,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:"#141415"},
  profile:{backgroundColor:"#141415",borderRadius:28,padding:20,flexDirection:"row",alignItems:"center",gap:14},
  avatar:{width:56,height:56,borderRadius:28,backgroundColor:"#252b54",alignItems:"center",justifyContent:"center"},
  copy:{fontSize:14,lineHeight:21,color:"#8e8e93"},section:{color:"#8e8e93",letterSpacing:.7,marginTop:8},
  group:{backgroundColor:"#141415",borderRadius:24,paddingHorizontal:18,paddingVertical:0},
  row:{minHeight:76,flexDirection:"row",alignItems:"center",gap:12,paddingVertical:14},separator:{borderTopWidth:1,borderTopColor:"rgba(255,255,255,.08)"}});
