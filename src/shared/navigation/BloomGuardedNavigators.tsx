import { useCallback, useRef, type ComponentProps, type PropsWithChildren, type RefObject, type ReactNode } from "react";
import { withLayoutContext } from "expo-router";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { usePreventRemoveContext } from "@react-navigation/native";
import { useBloomLocalState } from "../../app/providers/BloomLocalStateProvider";
import { createBloomRouterBoundary, type PreventedRoutes } from "./guardBloomNavigation";

const NativeStack=withLayoutContext(createNativeStackNavigator().Navigator);
const NativeTabs=withLayoutContext(createBottomTabNavigator().Navigator);
function CapturePreventedRoutes({target,children}:PropsWithChildren<{target:RefObject<PreventedRoutes>}>) {
  const {preventedRoutes}=usePreventRemoveContext();
  target.current=preventedRoutes;
  return children;
}
function useBoundary() {
  const bloom=useBloomLocalState(),prevented=useRef<PreventedRoutes>({});
  const getters=useRef({accepted:bloom.getAcceptedState,durable:bloom.getDurableState});
  getters.current={accepted:bloom.getAcceptedState,durable:bloom.getDurableState};
  const getPrevented=useCallback(()=>prevented.current,[]);
  const hasUnconfirmedSave=useCallback(()=>getters.current.accepted()!==getters.current.durable(),[]);
  const layout=useCallback(({children}:{children:ReactNode})=><CapturePreventedRoutes target={prevented}>{children}</CapturePreventedRoutes>,[]);
  return {layout,getPrevented,hasUnconfirmedSave};
}
function GuardedStack(props:ComponentProps<typeof NativeStack>) {
  const {layout,getPrevented,hasUnconfirmedSave}=useBoundary();
  const override=useCallback<NonNullable<ComponentProps<typeof NativeStack>["UNSTABLE_router"]>>(
    original=>createBloomRouterBoundary(original,getPrevented,hasUnconfirmedSave),[getPrevented,hasUnconfirmedSave]);
  return <NativeStack {...props} layout={layout} UNSTABLE_router={override} />;
}
function GuardedTabs(props:ComponentProps<typeof NativeTabs>) {
  const {layout,getPrevented,hasUnconfirmedSave}=useBoundary();
  const override=useCallback<NonNullable<ComponentProps<typeof NativeTabs>["UNSTABLE_router"]>>(
    original=>createBloomRouterBoundary(original,getPrevented,hasUnconfirmedSave),[getPrevented,hasUnconfirmedSave]);
  return <NativeTabs {...props} layout={layout} UNSTABLE_router={override} />;
}
// Public Expo Router layout bridge and already-installed native navigators.
// Existing usePreventRemove owns removal; the extra router boundary stops
// forward/deep-link focus changes that would otherwise bypass it.
export const BloomGuardedStack=Object.assign(GuardedStack,{Screen:NativeStack.Screen});
export const BloomGuardedTabs=Object.assign(GuardedTabs,{Screen:NativeTabs.Screen});
