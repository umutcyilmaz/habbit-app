import { Pressable, ScrollView, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../../../shared/components/v4/AppText";
import { LibraryArticleRow } from "../LibraryArticleRow";
import { articlesForCategory, libraryCategories, type LibraryCategoryId } from "../libraryContent";
import { libraryStyles as s } from "../libraryTheme";
export function LibraryCategoryScreen() {
  const {id}=useLocalSearchParams<{id?:string}>(),router=useRouter(),insets=useSafeAreaInsets();
  const valid=typeof id==="string" && Object.prototype.hasOwnProperty.call(libraryCategories,id);
  const category=valid ? id as LibraryCategoryId : null;
  return <View style={[s.screen,{paddingTop:insets.top}]}><View style={{flexDirection:"row",alignItems:"center",paddingHorizontal:16,gap:10}}>
    <Pressable testID="library.back" accessibilityRole="button" accessibilityLabel="Geri" style={s.circle} onPress={()=>router.canGoBack() ? router.back() : router.replace("/library")}><AppText style={{fontSize:28}}>‹</AppText></Pressable>
    <AppText style={s.section}>{category ? libraryCategories[category] : "Kategori bulunamadı"}</AppText>
  </View><ScrollView testID="library.category" contentContainerStyle={[s.content,{paddingBottom:insets.bottom+30}]}>{category ? <View style={s.group}>{articlesForCategory(category).map((a,i)=><LibraryArticleRow key={a.id} article={a} border={i>0}/>)}</View> : <AppText style={s.muted}>Bu kategori artık kullanıma açık değil. Library'ye dönebilirsin.</AppText>}</ScrollView></View>;
}
