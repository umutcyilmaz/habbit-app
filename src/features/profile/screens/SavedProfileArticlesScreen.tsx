import { useRouter } from "expo-router";
import { View, Pressable } from "react-native";
import { AppScreen } from "../../../shared/components/v4/AppScreen";
import { AppText } from "../../../shared/components/v4/AppText";
import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { BloomNestedBackButton } from "../../../shared/navigation/BloomNestedBackButton";
import { LibraryArticleRow } from "../../library/LibraryArticleRow";
import { savedProfileArticles } from "../profileReadModel";

export function SavedProfileArticlesScreen() {
  const bloom = useBloomLocalState(), router = useRouter();
  const articles = savedProfileArticles(bloom.durableState);
  return <AppScreen scroll testID="bloom.profile.saved-list" includeBottomNavClearance={false} style={{backgroundColor:"#000"}} contentContainerStyle={{paddingTop:8,paddingBottom:32}}>
    <View style={{flexDirection:"row",alignItems:"center",gap:8,marginBottom:22}}><BloomNestedBackButton /><AppText accessibilityRole="header" style={{fontSize:23,fontFamily:"Inter_700Bold",flex:1}}>Kaydedilen yazılar</AppText></View>
    {bloom.hydrationStatus !== "ready" ? <AppText>Kaydedilmiş yazılar şu an kullanılamıyor.</AppText> : articles.length > 0 ? <View style={{backgroundColor:"#141415",borderRadius:26,paddingHorizontal:16}}>{articles.map((article,index) => <LibraryArticleRow key={article.id} article={article} border={index > 0} />)}</View>
      : <View style={{gap:14,padding:20,backgroundColor:"#141415",borderRadius:26}}><AppText style={{fontSize:18,fontFamily:"Inter_600SemiBold"}}>Henüz kaydedilen yazı yok</AppText><AppText tone="secondary">Library’de bir yazıyı kaydettiğinde burada görünür.</AppText><Pressable accessibilityRole="button" testID="bloom.profile.open-library" onPress={() => router.push("/library")} style={{paddingVertical:14}}><AppText tone="accent">Library’yi aç ›</AppText></Pressable></View>}
  </AppScreen>;
}
