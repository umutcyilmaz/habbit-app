import { Pressable, StyleSheet, type PressableProps } from "react-native";
import { PracticeText } from "./PracticeText";

// Full visible and accessible label. Height grows with wrapping, never overlays content.
// Stateless; no Kegel or tracking session semantics.
export function PracticeButton({label,secondary=false,style,...props}:PressableProps&{label:string;secondary?:boolean}) {
  return <Pressable {...props} accessibilityRole="button" accessibilityLabel={props.accessibilityLabel??label} accessibilityState={{disabled:!!props.disabled}} style={state=>[s.button,secondary&&s.secondary,props.disabled&&{opacity:.35},state.pressed&&{opacity:.8},typeof style==="function"?style(state):style]}>
    <PracticeText textRole="control" variant="title" style={s.text}>{label}</PracticeText>
  </Pressable>;
}
const s=StyleSheet.create({button:{minHeight:56,borderRadius:28,backgroundColor:"#3a4bff",alignItems:"center",justifyContent:"center",paddingHorizontal:18,paddingVertical:12,borderTopWidth:1,borderTopColor:"rgba(255,255,255,.2)"},secondary:{backgroundColor:"#1e1e20",borderTopWidth:0},text:{fontSize:18,lineHeight:25,textAlign:"center",width:"100%",flexShrink:1}});
