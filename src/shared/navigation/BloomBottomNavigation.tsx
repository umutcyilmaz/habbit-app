import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { tabRoutes, type BloomTab } from "../../constants/navigation";
import { AppText } from "../components/v4/AppText";

export const bloomTabBarColors = { background:"#0e0e10", active:"#ffffff", inactive:"#6c6c73" } as const;
export function BloomBottomNavigation({active,blocked=false,onSelect}:{active:BloomTab["name"]|undefined;blocked?:boolean;onSelect:(tab:BloomTab)=>void}) {
  const insets=useSafeAreaInsets();
  return <View testID="bloom.bottom-navigation" accessibilityLabel="Ana menü" style={[styles.bar,{
    paddingBottom:Math.max(insets.bottom,16),paddingLeft:Math.max(insets.left,8),paddingRight:Math.max(insets.right,8)
  }]}>{tabRoutes.map(tab=><TabButton key={tab.name} tab={tab} selected={active===tab.name} blocked={blocked} onPress={()=>onSelect(tab)} />)}</View>;
}
function TabButton({tab,selected,blocked,onPress}:{tab:BloomTab;selected:boolean;blocked:boolean;onPress:()=>void}) {
  const scale=useSharedValue(1),reduced=useReducedMotion();
  const iconStyle=useAnimatedStyle(()=>({transform:[{scale:scale.value}]}));
  const color=selected ? bloomTabBarColors.active : bloomTabBarColors.inactive;
  return <Pressable testID={`bloom.tab.${tab.name}`} accessibilityRole="tab" accessibilityLabel={tab.title}
    accessibilityState={{selected,disabled:blocked}} disabled={blocked} style={styles.button} onPress={onPress}
    onPressIn={()=>{scale.value=reduced ? 1 : withTiming(.88,{duration:100});}}
    onPressOut={()=>{scale.value=reduced ? 1 : withSpring(1,{damping:16,stiffness:220});}}>
    <Animated.View accessible={false} style={iconStyle}><BloomTabIcon name={tab.name} color={color} /></Animated.View>
    <AppText style={[styles.label,{color}]}>{tab.title}</AppText>
  </Pressable>;
}
// Native geometry follows the supplied TAB_ICONS; no new icon dependency.
export function BloomTabIcon({name,color}:{name:BloomTab["name"];color:string}) {
  return <View accessible={false} style={{width:24,height:24}}>
    {name==="today" && <>
      <View style={{position:"absolute",left:5,top:4,width:14,height:14,borderRadius:1,backgroundColor:color,transform:[{rotate:"45deg"}]}} />
      <View style={{position:"absolute",left:5,top:10,width:14,height:11,borderRadius:1,backgroundColor:color}} />
      <View style={{position:"absolute",left:10,top:15,width:4,height:7,backgroundColor:bloomTabBarColors.background}} />
    </>}
    {name==="library" && <>
      <View style={{position:"absolute",left:2.5,top:5,width:8.5,height:14.5,borderRadius:1.5,backgroundColor:color,transform:[{skewY:"10deg"}]}} />
      <View style={{position:"absolute",right:2.5,top:5,width:8.5,height:14.5,borderRadius:1.5,backgroundColor:color,transform:[{skewY:"-10deg"}]}} />
    </>}
    {name==="kegel" && <>
      <View style={{position:"absolute",left:3.5,top:5,width:17,height:11,borderWidth:2.4,borderTopWidth:0,borderColor:color,borderBottomLeftRadius:11,borderBottomRightRadius:11}} />
      <View style={{position:"absolute",left:7,top:17,width:10,height:4,borderBottomWidth:2.4,borderColor:color,borderBottomLeftRadius:8,borderBottomRightRadius:8}} />
    </>}
    {name==="profile" && <>
      <View style={{position:"absolute",left:7.6,top:3.2,width:8.8,height:8.8,borderRadius:4.4,backgroundColor:color}} />
      <View style={{position:"absolute",left:3.6,top:13.4,width:16.8,height:8,borderTopLeftRadius:9,borderTopRightRadius:9,borderBottomLeftRadius:1.5,borderBottomRightRadius:1.5,backgroundColor:color}} />
    </>}
  </View>;
}
const styles=StyleSheet.create({
  bar:{flexDirection:"row",paddingTop:12,backgroundColor:bloomTabBarColors.background,borderTopWidth:StyleSheet.hairlineWidth,borderTopColor:"rgba(255,255,255,.08)"},
  button:{flex:1,height:50,minWidth:44,alignItems:"center",justifyContent:"center",gap:3},
  label:{fontSize:11,lineHeight:15,fontWeight:"600",includeFontPadding:false}
});
