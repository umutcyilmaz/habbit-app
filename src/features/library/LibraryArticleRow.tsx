import { Pressable, View } from "react-native";
import { useRouter } from "expo-router";
import { AppText } from "../../shared/components/v4/AppText";
import { useBloomLocalState } from "../../app/providers/BloomLocalStateProvider";
import { LibraryCover } from "./LibraryCover";
import { libraryStyles as s } from "./libraryTheme";
import type { LibraryArticle } from "./libraryContent";
export function LibraryArticleRow({article,border=false,onPress,disabled=false}:{article:LibraryArticle;border?:boolean;onPress?:()=>void;disabled?:boolean}) {
  const router=useRouter(),{durableState}=useBloomLocalState();
  const done=durableState.library.completedArticleIds.includes(article.id),saved=durableState.library.bookmarkedArticleIds.includes(article.id);
  return <Pressable disabled={disabled} testID={`library.article.${article.id}`} accessibilityRole="button"
    accessibilityLabel={`${article.title}, ${article.min} dakika okuma${done ? ", Okundu" : ""}${saved ? ", Kaydedildi" : ""}`}
    onPress={onPress ?? (()=>router.push({pathname:"/bloom/library/article",params:{id:article.id}}))}
    style={({pressed})=>[s.row,border && s.rowBorder,pressed && s.pressed]}>
    <LibraryCover motif={article.motif} /><View style={{flex:1}}><AppText style={s.rowTitle}>{article.title}</AppText><AppText style={s.rowMeta}>{article.min} dk okuma{saved ? " · Kaydedildi" : ""}</AppText></View>
    <AppText style={{color:done ? "#aab3ff" : "#6c6c73",fontSize:22}}>{done ? "✓" : "›"}</AppText>
  </Pressable>;
}
