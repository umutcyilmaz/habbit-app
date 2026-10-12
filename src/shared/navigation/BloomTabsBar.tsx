import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import { useBloomLocalState } from "../../app/providers/BloomLocalStateProvider";
import { tabRoutes } from "../../constants/navigation";
import { BloomBottomNavigation } from "./BloomBottomNavigation";
import { canChangeBloomTab } from "./bloomTabNavigation";

export function BloomTabsBar({state,navigation}:BottomTabBarProps) {
  const bloom=useBloomLocalState(),router=useRouter();
  const current=state.routes[state.index]?.name;
  const active=tabRoutes.find(tab=>tab.name===current)?.name;
  return <BloomBottomNavigation active={active} blocked={!canChangeBloomTab(bloom.hasHydrated,bloom.state,bloom.durableState)} onSelect={tab=>{
    if(!canChangeBloomTab(bloom.hasHydrated,bloom.getAcceptedState(),bloom.getDurableState())) return;
    const target=state.routes.find(route=>route.name===tab.name);
    if(!target) return;
    const event=navigation.emit({type:"tabPress",target:target.key,canPreventDefault:true});
    if(event.defaultPrevented) return;
    // Keep the established Kegel stack and its beforeRemove/gesture/retry guards.
    if(tab.name==="kegel") router.push(tab.href);
    else if(current!==tab.name) navigation.navigate(tab.name);
  }} />;
}
