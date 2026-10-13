import { StyleSheet } from "react-native";
export const libraryStyles = StyleSheet.create({
  screen:{flex:1,backgroundColor:"#000"}, content:{paddingHorizontal:20,paddingTop:22,paddingBottom:30},
  title:{fontSize:30,lineHeight:38,fontFamily:"Inter_700Bold",letterSpacing:-.6,color:"#fff"},
  section:{fontSize:20,lineHeight:27,fontFamily:"Inter_700Bold",color:"#fff"},
  muted:{fontSize:13.5,lineHeight:19,color:"#8e8e93"},
  group:{backgroundColor:"#141415",borderRadius:28,paddingHorizontal:14,paddingVertical:6},
  sectionHeader:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:28,marginBottom:12,minHeight:32},
  row:{flexDirection:"row",gap:14,alignItems:"center",paddingVertical:10,minHeight:76},
  rowBorder:{borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:"#29292d"},
  rowTitle:{fontSize:16.5,lineHeight:21,fontFamily:"Inter_600SemiBold",color:"#fff"},
  rowMeta:{marginTop:3,fontSize:13.5,lineHeight:19,color:"#8e8e93"},
  button:{height:54,borderRadius:30,backgroundColor:"#fff",alignItems:"center",justifyContent:"center",paddingHorizontal:26},
  buttonText:{fontFamily:"Inter_700Bold",fontSize:16,color:"#000"},
  circle:{width:44,height:44,borderRadius:22,alignItems:"center",justifyContent:"center",backgroundColor:"#101018"},
  recovery:{padding:16,gap:10,backgroundColor:"#141415"},
  pressed:{opacity:.8,transform:[{scale:.98}]}
});
