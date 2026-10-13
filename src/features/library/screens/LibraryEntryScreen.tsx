import { useRouter } from "expo-router";
import { Pressable, ScrollView, View } from "react-native";
import Animated, { FadeInDown, useReducedMotion } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../../../shared/components/v4/AppText";
import { LibraryCover } from "../LibraryCover";
import { LibraryArticleRow } from "../LibraryArticleRow";
import { articlesForCategory, findLibraryArticle, featuredLibraryArticleId, libraryCategories, type LibraryCategoryId } from "../libraryContent";
import { libraryStyles as s } from "../libraryTheme";
import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { SoundLibrarySection } from "../../relaxing-sounds/SoundLibrarySection";
export function LibraryEntryScreen() {
  const router=useRouter(),insets=useSafeAreaInsets(),reduced=useReducedMotion();
  const article=findLibraryArticle(featuredLibraryArticleId)!;
  const {durableState}=useBloomLocalState();
  const done=durableState.library.completedArticleIds.includes(article.id);
  return <View style={[s.screen,{paddingTop:insets.top}]}><ScrollView testID="bloom.library" contentContainerStyle={s.content}>
    <Animated.View {...(reduced ? {} : {entering:FadeInDown.duration(350)})}><AppText accessibilityRole="header" style={s.title}>Library</AppText>
      <AppText style={[s.section,{marginTop:24,marginBottom:12}]}>Bugün için</AppText>
      <Pressable accessibilityRole="button" testID="library.featured" onPress={()=>router.push({pathname:"/bloom/library/article",params:{id:article.id}})} style={({pressed})=>[{borderRadius:30,overflow:"hidden",backgroundColor:"#141415"},pressed && s.pressed]}>
        <LibraryCover motif={article.motif} size="featured"/><View style={{paddingHorizontal:20,paddingTop:18,paddingBottom:22}}>
          <AppText style={{fontSize:14,color:"#aab3ff",fontFamily:"Inter_600SemiBold"}}>{libraryCategories[article.cat]} · {article.min} dk{done ? " · Tamamlandı" : ""}</AppText>
          <AppText style={{fontSize:22,lineHeight:27,fontFamily:"Inter_700Bold",marginTop:6}}>{article.title}</AppText>
          <AppText style={{fontSize:15,lineHeight:22,color:"#8e8e93",marginTop:6}}>{article.lead}</AppText>
        </View>
      </Pressable>
    </Animated.View>
    {(Object.keys(libraryCategories) as LibraryCategoryId[]).map((category,index)=>{
      const articles=articlesForCategory(category);
      return <Animated.View key={category} {...(reduced ? {} : {entering:FadeInDown.delay(100+index*40).duration(350)})}>
        <Pressable testID={`library.category.${category}`} accessibilityRole="button" accessibilityLabel={`${libraryCategories[category]}, ${articles.length} yazı`} style={s.sectionHeader} onPress={()=>router.push({pathname:"/bloom/library/category",params:{id:category}})}>
          <AppText style={s.section}>{libraryCategories[category]}</AppText><AppText style={s.muted}>{articles.length} yazı ›</AppText>
        </Pressable><View style={s.group}>{articles.map((a,i)=><LibraryArticleRow key={a.id} article={a} border={i>0}/>)}</View>
      </Animated.View>;
    })}
    <SoundLibrarySection />
    {["Araştırmalar"].map(title=><View key={title}><View style={s.sectionHeader}><AppText style={s.section}>{title}</AppText><AppText style={s.muted}>Yakında</AppText></View><View style={[s.group,{padding:18}]}><AppText style={s.muted}>Bu içerikler henüz kullanıma açık değil.</AppText></View></View>)}
  </ScrollView></View>;
}
