import { Image, View, StyleSheet, type ImageSourcePropType } from "react-native";
const images:Record<string,ImageSourcePropType>={
  wave:require("./assets/wave.png"),halt:require("./assets/halt.png"),loop:require("./assets/loop.png"),
  pelvic:require("./assets/pelvic.png"),moon:require("./assets/moon.png"),reset:require("./assets/reset.png"),
  heart:require("./assets/heart.png"),rel:require("./assets/rel.png")
};
export function LibraryCover({motif,size="small",heroOffset=0}:{motif:string;size?:"small"|"featured"|"hero";heroOffset?:number}) {
  return <View style={[size==="small" && styles.thumbnailFrame,size==="hero" && {height:330,overflow:"hidden"}]}><Image accessible={false} source={images[motif] ?? images.wave!} resizeMode="cover" style={[
    size==="hero" && {transform:[{translateY:heroOffset*.4},{scale:1+Math.max(0,-heroOffset)/400}]},styles.cover,size==="small" ? styles.small : size==="featured" ? styles.featured : styles.hero
  ]} />{size==="hero" && <Image accessible={false} source={require("./assets/hero-fade.png")} resizeMode="stretch" style={{position:"absolute",left:0,top:0,width:"100%",height:330}}/>}</View>;
}
const styles=StyleSheet.create({cover:{backgroundColor:"#0a0f3d"},thumbnailFrame:{width:62,height:62,borderRadius:16,overflow:"hidden"},small:{width:62,height:62,transform:[{scale:1.5}]},featured:{width:"100%",height:230},hero:{width:"100%",height:330}});
