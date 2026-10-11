import type { PropsWithChildren } from "react";
import { Pressable, StyleSheet, View, type PressableProps } from "react-native";
import { AppCard } from "../../../shared/components/v4/AppCard";
import { AppText } from "../../../shared/components/v4/AppText";
import { AppIconButton } from "../../../shared/components/v4/AppIconButton";
import { kegelColors as c } from "../kegelTheme";
import { KegelSymbol } from "./KegelVisuals";

export function KegelButton({ label, secondary = false, icon, style, ...props }: PressableProps & { label:string; secondary?:boolean; icon?:string | undefined }) {
  return <Pressable accessibilityRole="button" {...props} style={state => [styles.button, secondary && styles.secondary, props.disabled && { opacity:.35 }, state.pressed && { transform:[{scale:.97}],opacity:.85 }, typeof style === "function" ? style(state) : style]}>
    {icon && <KegelSymbol name={icon} color={c.text} size={18} />}<AppText variant="title" style={styles.buttonText}>{label}</AppText>
  </Pressable>;
}

export function KegelCard({ children, style, ...props }: React.ComponentProps<typeof AppCard>) {
  return <AppCard {...props} style={[styles.card,style]}>{children}</AppCard>;
}

export function KegelBack({ back = false, onPress, testID = "kegel.back" }: { back?:boolean; onPress:()=>void; testID?:string }) {
  return <AppIconButton testID={testID} accessibilityLabel={back ? "Geri" : "Kapat"} onPress={onPress}
    style={styles.back} icon={<KegelSymbol name={back ? "back" : "close"} color={c.text} size={18} />} />;
}

export function KegelRow({ icon, title, detail, warning = false }: { icon:string; title:string; detail:string; warning?:boolean }) {
  return <View style={styles.row}><View style={[styles.icon,warning && { backgroundColor:"rgba(234,169,92,.14)" }]}><KegelSymbol name={icon} color={warning ? c.warning : c.light} /></View>
    <View style={{flex:1}}><AppText variant="title" style={{fontSize:16,lineHeight:22}}>{title}</AppText><AppText style={styles.detail}>{detail}</AppText></View>
  </View>;
}

export function KegelHint({ children, warning = false }: PropsWithChildren<{warning?:boolean}>) {
  return <View style={styles.hint}><KegelSymbol name={warning ? "warn" : "info"} color={warning ? c.warning : c.light} size={18} /><AppText style={{flex:1,color:c.muted,fontSize:14,lineHeight:20}}>{children}</AppText></View>;
}

export const kegelStyles = StyleSheet.create({
  title: { fontSize:28,lineHeight:33,letterSpacing:-.7,textAlign:"center" },
  subtitle: { fontSize:16,lineHeight:23,color:c.muted,textAlign:"center",marginTop:10,maxWidth:330,alignSelf:"center" },
  cardTitle: { fontSize:20,lineHeight:25,letterSpacing:-.4 },
  cardSub: { fontSize:16,lineHeight:23,color:c.muted,marginTop:4 },
  section: { fontSize:17,lineHeight:24,color:c.muted },
  footer: { paddingTop:14,gap:8 }
});

const styles = StyleSheet.create({
  button: { minHeight:56,borderRadius:999,backgroundColor:c.blue,alignItems:"center",justifyContent:"center",paddingHorizontal:18,paddingVertical:12,flexDirection:"row",gap:9,borderTopWidth:1,borderTopColor:"rgba(255,255,255,.2)" },
  buttonText: { fontSize:18,lineHeight:25 },
  secondary: { backgroundColor:c.raised,borderTopWidth:0 },
  card: { backgroundColor:c.card,borderRadius:30,borderWidth:0,borderTopWidth:1,borderTopColor:"rgba(255,255,255,.07)",padding:20,minHeight:0,shadowOpacity:0,elevation:0 },
  back: { backgroundColor:"rgba(255,255,255,.1)",width:44,height:44,borderRadius:22 },
  row: { flexDirection:"row",alignItems:"center",gap:14,paddingVertical:9 },
  icon: { width:44,height:44,borderRadius:14,backgroundColor:"rgba(58,75,255,.18)",alignItems:"center",justifyContent:"center" },
  detail: { fontSize:14,lineHeight:20,color:c.muted,marginTop:2 },
  hint: { flexDirection:"row",alignItems:"flex-start",gap:10,backgroundColor:"rgba(255,255,255,.05)",borderRadius:20,padding:14,marginTop:14 }
});
