import { Pressable, StyleSheet, useWindowDimensions, type PressableProps } from "react-native";
import { AppText } from "../../shared/components/v4/AppText";

// Feature-local button: text wraps within the target at the largest Dynamic Type.
// Stateless; no Kegel or tracking session semantics.
export function PracticeButton({label,compactLabel,secondary=false,style,...props}:PressableProps&{label:string;compactLabel?:string;secondary?:boolean}) {
  const {fontScale}=useWindowDimensions();
  return <Pressable {...props} accessibilityRole="button" accessibilityLabel={props.accessibilityLabel??label} accessibilityState={{disabled:!!props.disabled}} style={state=>[s.button,secondary&&s.secondary,props.disabled&&{opacity:.35},state.pressed&&{opacity:.8},typeof style==="function"?style(state):style]}>
    <AppText variant="title" style={s.text}>{fontScale>1.4&&compactLabel?compactLabel:label}</AppText>
  </Pressable>;
}
const s=StyleSheet.create({button:{minHeight:56,borderRadius:999,backgroundColor:"#3a4bff",alignItems:"center",justifyContent:"center",paddingHorizontal:18,paddingVertical:12,borderTopWidth:1,borderTopColor:"rgba(255,255,255,.2)"},secondary:{backgroundColor:"#1e1e20",borderTopWidth:0},text:{fontSize:18,lineHeight:25,textAlign:"center",width:"100%",flexShrink:1}});
