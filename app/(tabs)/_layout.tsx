import { BloomGuardedTabs as Tabs } from "../../src/shared/navigation/BloomGuardedNavigators";
import { StatusBar } from "expo-status-bar";
import { useReducedMotion } from "react-native-reanimated";
import { hiddenLegacyTabs, tabRoutes } from "../../src/constants/navigation";
import { BloomTabRecoveryScreen } from "../../src/shared/navigation/BloomTabRecoveryScreen";
import { BloomTabsBar } from "../../src/shared/navigation/BloomTabsBar";

export default function TabsLayout() {
  const reduced=useReducedMotion();
  return <><StatusBar style="light" /><Tabs initialRouteName="today" backBehavior="history" tabBar={props=><BloomTabsBar {...props} />}
    screenOptions={{headerShown:false,animation:reduced ? "none" : "fade"}} screenLayout={({children})=><BloomTabRecoveryScreen>{children}</BloomTabRecoveryScreen>}>
    {tabRoutes.map(tab=><Tabs.Screen key={tab.name} name={tab.name} options={{title:tab.title,tabBarButtonTestID:`bloom.tab.${tab.name}`}} />)}
    {hiddenLegacyTabs.map(name=><Tabs.Screen key={name} name={name} options={{tabBarButton:()=>null,tabBarItemStyle:{display:"none"}}} />)}
  </Tabs></>;
}
