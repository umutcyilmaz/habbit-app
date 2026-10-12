import { useRouter } from "expo-router";
import { Pressable, View } from "react-native";
import { routes } from "../../constants/navigation";

export function BloomNestedBackButton() {
  const router=useRouter();
  // Normal stack removal still goes through each screen's existing save guard.
  return <Pressable testID="bloom.nested.back" accessibilityRole="button" accessibilityLabel="Geri"
    style={{width:44,height:44,justifyContent:"center",alignItems:"center"}}
    onPress={()=>router.canGoBack() ? router.back() : router.replace(routes.profile)}>
    <View style={{width:11,height:11,borderLeftWidth:2,borderBottomWidth:2,borderColor:"#fff",transform:[{rotate:"45deg"}]}} />
  </Pressable>;
}
