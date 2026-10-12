import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppScreen } from "../../../shared/components/v4/AppScreen";
import { AppText } from "../../../shared/components/v4/AppText";
import { AppCard } from "../../../shared/components/v4/AppCard";
import { BloomTabIcon } from "../../../shared/navigation/BloomBottomNavigation";
export function LibraryEntryScreen() {
  const insets=useSafeAreaInsets();
  return <View style={[styles.safeArea,{paddingTop:insets.top}]}><AppScreen scroll testID="bloom.library" includeBottomNavClearance={false} style={styles.screen} contentContainerStyle={styles.content}>
    <AppText variant="display" accessibilityRole="header" style={styles.title}>Library</AppText>
    <AppCard style={styles.feature}><View style={styles.cover}><BloomTabIcon name="library" color="#aab3ff" /></View>
      <AppText variant="title" style={styles.cardTitle}>Kendini daha iyi tanı</AppText>
      <AppText style={styles.copy}>Yazılar, sesler ve araştırmalar burada yer alacak. İçerik kütüphanesi henüz hazır değil.</AppText>
    </AppCard>
    <AppText variant="title" style={styles.section}>Kategoriler</AppText>
    <View style={styles.categories}>{["Yazılar","Rahatlatıcı sesler","Araştırmalar"].map(title=><AppCard key={title} style={styles.category}>
      <AppText variant="titleSmall">{title}</AppText><AppText style={styles.copy}>Henüz içerik yok</AppText>
    </AppCard>)}</View>
  </AppScreen></View>;
}
const styles=StyleSheet.create({safeArea:{flex:1,backgroundColor:"#000"},screen:{backgroundColor:"#000",paddingTop:0},content:{paddingHorizontal:20,paddingTop:22,paddingBottom:30,gap:16},
  title:{fontSize:31,lineHeight:39,letterSpacing:-.9},feature:{backgroundColor:"#141415",borderRadius:28,padding:20,gap:12},
  cover:{height:130,borderRadius:20,backgroundColor:"#11162d",alignItems:"center",justifyContent:"center"},
  cardTitle:{fontSize:21,lineHeight:27},copy:{fontSize:14,lineHeight:21,color:"#8e8e93"},section:{marginTop:8,fontSize:20},
  categories:{gap:10},category:{backgroundColor:"#141415",borderRadius:22,padding:18,gap:6}});
