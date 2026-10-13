import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn, FadeOut, useReducedMotion } from "react-native-reanimated";
import { AppText } from "../../../shared/components/v4/AppText";
import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { usePersistenceNavigationGuard } from "../../../shared/navigation/usePersistenceNavigationGuard";
import { getBloomPersistenceRecovery } from "../../../shared/navigation/bloomPersistenceRecovery";
import { routes } from "../../../constants/navigation";
import { LibraryCover } from "../LibraryCover";
import { LibraryArticleRow } from "../LibraryArticleRow";
import { findLibraryArticle, libraryCategories, nextLibraryArticle, type LibraryArticle } from "../libraryContent";
import { createLibraryPersistenceController, type LibrarySaveRequest } from "../libraryPersistenceController";
import { libraryStyles as s } from "../libraryTheme";

export function LibraryArticleScreen() {
  const {id}=useLocalSearchParams<{id?:string}>();
  const article=typeof id==="string" ? findLibraryArticle(id) : undefined;
  return <ArticleReader key={typeof id==="string" ? id : "unknown"} article={article} />;
}
function RichText({text}:{text:string}) {
  return <>{text.split(/(<b>.*?<\/b>)/g).map((part,i)=>part.startsWith("<b>") ? <Text key={i} style={{fontFamily:"Inter_600SemiBold"}}>{part.slice(3,-4)}</Text> : part)}</>;
}
function CompletionCelebration() {
  return <Animated.View pointerEvents="none" entering={FadeIn.duration(180)} exiting={FadeOut.duration(300)} style={StyleSheet.absoluteFill}>
    {Array.from({length:28},(_,i)=><View key={i} style={{position:"absolute",left:`${(i*29)%96}%`,top:`${15+(i*17)%65}%`,width:6,height:10,borderRadius:2,backgroundColor:["#3a4bff","#aab3ff","#fff","#eaa95c","#5ad0a0","#e5484d"][i%6],transform:[{rotate:`${i*41}deg`}]}} />)}
  </Animated.View>;
}
function ArticleReader({article}:{article:LibraryArticle|undefined}) {
  const router=useRouter(),insets=useSafeAreaInsets(),bloom=useBloomLocalState(),reduced=useReducedMotion();
  const controller=useMemo(()=>createLibraryPersistenceController({actions:bloom.productActions.library,getState:bloom.getAcceptedState,getDurableState:bloom.getDurableState,
    retryPersistedMutation:bloom.retryPersistedMutation,confirmCurrentPersistence:bloom.confirmCurrentPersistence}),
    [bloom.productActions,bloom.getAcceptedState,bloom.getDurableState,bloom.retryPersistedMutation,bloom.confirmCurrentPersistence]);
  const operation=useSyncExternalStore(controller.subscribe,controller.getSnapshot,controller.getSnapshot);
  const recovery=getBloomPersistenceRecovery(operation,bloom.state,bloom.durableState);
  usePersistenceNavigationGuard(recovery.navigationBlocked);
  const [progress,setProgress]=useState(0),[feedback,setFeedback]=useState<string|null>(null),[celebrate,setCelebrate]=useState(false),[notice,setNotice]=useState<string|null>(null);
  const scroll=useRef<ScrollView>(null),height=useRef(0),viewport=useRef(0),offset=useRef(0),mounted=useRef(true);
  const refreshProgress=()=>setProgress(Math.max(0,Math.min(1,offset.current/Math.max(1,height.current-viewport.current))));
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
  useEffect(()=>{if(!celebrate)return;const timer=setTimeout(()=>setCelebrate(false),2000);return ()=>clearTimeout(timer);},[celebrate]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(null),2500);return ()=>clearTimeout(timer);},[notice]);
  const saved=!!article && bloom.durableState.library.bookmarkedArticleIds.includes(article.id);
  const done=!!article && bloom.durableState.library.completedArticleIds.includes(article.id);
  const blockedNow=()=>controller.getSnapshot().busy || bloom.getAcceptedState()!==bloom.getDurableState() || recovery.navigationBlocked;
  const back=()=>{if(!blockedNow())router.canGoBack() ? router.back() : router.replace(routes.library);};
  const observe=async(promise:ReturnType<typeof controller.set>,request:LibrarySaveRequest|null)=>{
    if(!promise)return;
    setNotice(null);
    try {
      const result=await promise;
      if(!mounted.current || !result.ok || !request)return;
      const key=request.kind==="bookmark" ? "bookmarkedArticleIds" : "completedArticleIds";
      // Only an acknowledged receipt and matching current durable fact can show success.
      if(bloom.getAcceptedState()!==bloom.getDurableState() || bloom.getDurableState().library[key].includes(request.id)!==request.enabled)return;
      setNotice(request.kind==="bookmark" ? request.enabled ? "Kaydedildi" : "Kaydedilenlerden çıkarıldı" : request.enabled ? "Tamamlandı" : "Okundu bilgisi geri alındı");
      if(request.kind==="completion" && request.enabled && !reduced)setCelebrate(true);
    } catch { /* The controller exposes a recoverable message. */ }
  };
  const change=(kind:LibrarySaveRequest["kind"],enabled:boolean)=>{
    if(!article || blockedNow())return;
    const request={kind,id:article.id,enabled};void observe(controller.set(request),request);
  };
  const goKegel=()=>{
    if(blockedNow())return;
    router.push(routes.kegel);
  };
  const next=article ? nextLibraryArticle(article.id) : undefined;
  return <View testID="library.reader" style={s.screen}>
    <ScrollView ref={scroll} testID="library.reader.scroll" scrollEventThrottle={16} contentContainerStyle={{paddingBottom:insets.bottom+30}}
      onContentSizeChange={(_,h)=>{height.current=h;refreshProgress();}} onLayout={e=>{viewport.current=e.nativeEvent.layout.height;refreshProgress();}}
      onScroll={e=>{offset.current=e.nativeEvent.contentOffset.y;refreshProgress();}}>
      {article ? <>
        <LibraryCover motif={article.motif} size="hero" heroOffset={reduced ? 0 : offset.current} />
        <View style={styles.body}>
          <AppText style={styles.category}>{libraryCategories[article.cat]} · {article.min} dk okuma</AppText>
          <AppText accessibilityRole="header" style={styles.title}>{article.title}</AppText>
          <AppText style={styles.lead}>{article.lead}</AppText><View style={styles.rule}/>
          {article.body.map((block,i)=>{
            if(block[0]==="p")return <AppText key={i} style={styles.paragraph}>{block[1]}</AppText>;
            if(block[0]==="h")return <AppText key={i} accessibilityRole="header" style={styles.heading}>{block[1]}</AppText>;
            if(block[0]==="quote")return <AppText key={i} style={styles.quote}>{block[1]}</AppText>;
            if(block[0]==="list")return <View key={i} style={{gap:10,marginTop:14}}>{block[1].map((text,j)=><View key={j} style={styles.listItem}><View style={styles.dot}/><AppText style={styles.listText}><RichText text={text}/></AppText></View>)}</View>;
            if(block[0]==="try")return <View key={i} style={styles.tryBox}><View style={{flexDirection:"row",gap:14,alignItems:"center"}}><View accessible={false} style={{width:44,height:44,borderRadius:14,backgroundColor:"#3a4bff",alignItems:"center",justifyContent:"center"}}><View style={{width:0,height:0,borderLeftWidth:12,borderTopWidth:7,borderBottomWidth:7,borderLeftColor:"#fff",borderTopColor:"transparent",borderBottomColor:"transparent",marginLeft:3}}/></View><View style={{flex:1,gap:2}}><AppText style={s.rowTitle}>{block[1]}</AppText><AppText style={s.muted}>{block[2]}</AppText></View></View>
              {block[4]==="practice" ? <View testID="library.practice.unavailable" style={{gap:4,marginTop:8}}><AppText style={s.rowTitle}>Pratik yakında</AppText><AppText style={s.muted}>Yeni Pratik deneyimi henüz kullanıma açık değil.</AppText></View> : block[4]==="run60" ? <AppText style={s.muted}>Bir dakikalık nefes uygulaması henüz kullanıma açık değil.</AppText> : <Pressable testID="library.practice.kegel" accessibilityRole="button" disabled={recovery.navigationBlocked} style={[s.button,{backgroundColor:"#3a4bff",marginTop:8}]} onPress={goKegel}><AppText style={[s.buttonText,{color:"#fff"}]}>{block[3]}</AppText></Pressable>}
            </View>;
            return null;
          })}
          <View style={styles.keys}><AppText style={[styles.category,{marginBottom:6}]}>ÖZET</AppText>{article.keys.map((key,i)=><View key={key} style={[styles.key,i>0 && s.rowBorder]}><View accessible={false} style={{width:22,height:22,borderRadius:11,backgroundColor:"rgba(58,75,255,.25)",marginTop:1}}><View style={{position:"absolute",left:8,top:4.5,width:5,height:10,borderRightWidth:2.2,borderBottomWidth:2.2,borderColor:"#aab3ff",transform:[{rotate:"45deg"}]}}/></View><AppText style={{flex:1,fontSize:16,lineHeight:23}}>{key}</AppText></View>)}</View>
          <View style={{alignItems:"center",marginTop:30,gap:8}}>
            <Pressable accessibilityRole="button" accessibilityLabel={done ? "Okundu bilgisini geri al" : "Okundu olarak işaretle"} testID="library.complete" disabled={recovery.navigationBlocked}
              onPress={()=>change("completion",!done)} style={({pressed})=>[s.button,done && styles.done,pressed && s.pressed]}><AppText style={[s.buttonText,done && {color:"#fff"}]}>{done ? "Tamamlandı" : "Okundu olarak işaretle"}  ✓</AppText></Pressable>
            {done && <AppText style={s.muted}>Geri almak için tekrar dokun.</AppText>}
          </View>
          <View style={{alignItems:"center",marginTop:24,gap:12}}><AppText style={s.rowTitle}>Faydalı oldu mu?</AppText><View style={{flexDirection:"row",gap:10}}>{["Evet","Pek değil"].map(text=><Pressable key={text} accessibilityRole="button" accessibilityState={{selected:feedback===text}} style={[styles.feedback,feedback===text && {backgroundColor:"#3a4bff"}]} onPress={()=>setFeedback(text)}><AppText>{text}</AppText></Pressable>)}</View><AppText style={s.muted}>{feedback ? "Teşekkürler. Bu yanıt yalnız bu ekranda tutulur." : " "}</AppText></View>
          {next && <><AppText style={[s.section,{marginTop:30,marginBottom:12}]}>Sıradaki</AppText><View style={s.group}><LibraryArticleRow article={next} disabled={recovery.navigationBlocked} onPress={()=>{if(!blockedNow())router.replace({pathname:"/bloom/library/article",params:{id:next.id}});}}/></View></>}
        </View>
      </> : <View style={[s.content,{paddingTop:insets.top+80}]}><AppText style={s.title}>Yazı bulunamadı</AppText><AppText style={[s.muted,{marginTop:16}]}>Bu içerik artık kullanıma açık değil. Library'ye dönebilirsin.</AppText></View>}
    </ScrollView>
    {/* Keep scrolled content out of the system status area; continue the reference fade below it. */}
    <View testID="library.status.scrim" pointerEvents="none" style={{position:"absolute",left:0,right:0,top:0}}>
      <View style={{height:insets.top,backgroundColor:"#000"}}/>
      <Image accessible={false} source={require("../assets/status-fade.png")} resizeMode="stretch" style={{width:"100%",height:64}}/>
    </View>
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Okuma ilerlemesi" accessibilityValue={{min:0,max:100,now:Math.round(progress*100)}} style={[styles.progress,{top:insets.top}]}><View style={{width:`${progress*100}%`,height:3,backgroundColor:"#aab3ff"}}/></View>
    <View pointerEvents="box-none" style={[styles.navigation,{top:insets.top+12}]}>
      <Pressable testID="library.back" accessibilityRole="button" accessibilityLabel="Geri" disabled={recovery.navigationBlocked} onPress={back} style={s.circle}><AppText style={{fontSize:28}}>‹</AppText></Pressable>
      <View style={{flexDirection:"row",gap:10,alignItems:"center"}}>{done && <Animated.View {...(reduced ? {} : {entering:FadeIn})} style={styles.badge}><AppText style={{color:"#aab3ff",fontSize:13}}>✓ Tamamlandı</AppText></Animated.View>}
        {article && <Pressable testID="library.bookmark" accessibilityRole="button" accessibilityLabel={saved ? "Kaydedilenlerden çıkar" : "Kaydet"} accessibilityState={{selected:saved,disabled:recovery.navigationBlocked}} disabled={recovery.navigationBlocked} onPress={()=>change("bookmark",!saved)} style={s.circle}><Image source={saved ? require("../assets/bookmark.png") : require("../assets/bookmark-outline.png")} style={{width:18,height:20,tintColor:saved ? "#aab3ff" : "#fff",opacity:1}}/></Pressable>}
      </View>
    </View>
    {notice && !recovery.navigationBlocked && <View pointerEvents="none" style={[styles.notice,{top:insets.top+66}]}><AppText accessibilityLiveRegion="polite" style={{fontSize:13}}>{notice}</AppText></View>}
    {(recovery.navigationBlocked || operation.message) && <View testID="library.save.recovery" style={s.recovery}><AppText accessibilityLiveRegion="polite" style={{fontSize:14}}>{operation.busy ? "Kaydediliyor…" : operation.message ?? recovery.recoveryGuidance}</AppText>
      {!operation.busy && operation.result && !operation.result.ok && operation.result.retryable && <Pressable testID="library.save.retry" accessibilityRole="button" style={s.button} onPress={()=>{void observe(controller.retry(),operation.request);}}><AppText style={s.buttonText}>Kaydetmeyi tekrar dene</AppText></Pressable>}
      {!operation.busy && !(operation.result && !operation.result.ok && operation.result.retryable) && <Pressable testID="library.save.confirm" accessibilityRole="button" style={s.button} onPress={()=>{void observe(controller.confirm(),null);}}><AppText style={s.buttonText}>Güncel kaydı doğrula</AppText></Pressable>}
    </View>}
    {celebrate && <CompletionCelebration/>}
  </View>;
}
const styles=StyleSheet.create({body:{paddingHorizontal:22,marginTop:-40},category:{fontSize:13,lineHeight:18,fontFamily:"Inter_600SemiBold",color:"#aab3ff"},title:{fontSize:31,lineHeight:35,fontFamily:"Inter_700Bold",letterSpacing:-.9,marginTop:8},lead:{fontSize:18,lineHeight:26,color:"#bfbfc2",marginTop:12},rule:{height:1,backgroundColor:"#29292d",marginTop:24,marginBottom:6},paragraph:{fontSize:17,lineHeight:28,color:"#dbdbdd",marginTop:16},heading:{fontSize:21,lineHeight:27,fontFamily:"Inter_700Bold",marginTop:30},quote:{fontSize:23,lineHeight:31,fontFamily:"Inter_600SemiBold",borderLeftWidth:3,borderLeftColor:"#3a4bff",paddingLeft:20,paddingVertical:4,marginTop:30,marginBottom:8},listItem:{padding:14,paddingLeft:17,borderRadius:18,backgroundColor:"#141415",flexDirection:"row",alignItems:"flex-start",gap:14},dot:{width:8,height:8,borderRadius:4,backgroundColor:"#aab3ff",marginTop:8},listText:{flex:1,fontSize:16,lineHeight:24,color:"#d1d1d4"},tryBox:{padding:18,gap:6,borderRadius:24,backgroundColor:"#10153a",borderWidth:1,borderColor:"#303761",marginTop:24},keys:{padding:20,borderRadius:26,backgroundColor:"#141415",marginTop:34},key:{flexDirection:"row",gap:12,paddingVertical:10},done:{backgroundColor:"#141415",borderWidth:1.5,borderColor:"#3a4bff"},feedback:{height:44,paddingHorizontal:22,borderRadius:24,backgroundColor:"#1c1c1e",justifyContent:"center"},progress:{position:"absolute",left:0,right:0,height:3},navigation:{position:"absolute",left:16,right:16,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},badge:{paddingHorizontal:12,paddingVertical:6,borderRadius:20,backgroundColor:"#141c54"},notice:{position:"absolute",alignSelf:"center",padding:10,borderRadius:20,backgroundColor:"#141415"}});
