import type { NavigationAction, NavigationState, Router } from "@react-navigation/native";
type FocusState = {index?:number;routes:readonly {key?:string;name:string}[]};
export type PreventedRoutes = Readonly<Record<string,{preventRemove:boolean}>>;
const navigationActions=new Set(["NAVIGATE","NAVIGATE_DEPRECATED","PUSH","REPLACE","RESET","JUMP_TO","POP","POP_TO","POP_TO_TOP"]);
const focused=(state:FocusState)=>state.routes[state.index ?? state.routes.length-1];
function returningToRecovery(state:FocusState,next:FocusState,prevented:PreventedRoutes) {
  const current=focused(state),target=focused(next);
  return !prevented[current?.key ?? ""]?.preventRemove && !!prevented[target?.key ?? ""]?.preventRemove &&
    next.routes.length<=state.routes.length && state.routes.some(route=>route.key===target?.key);
}
export function shouldBlockBloomNavigation(state:FocusState,next:FocusState|null,actionType:string,prevented:PreventedRoutes,unconfirmed:boolean) {
  if(next===null || next===state) return false;
  const current=focused(state),target=focused(next);
  // Entry redirects keep existing hydration/migration recovery reachable.
  // A displaced unprotected screen may return to an existing recovery owner.
  if(unconfirmed && current?.name!=="index" && navigationActions.has(actionType) && !returningToRecovery(state,next,prevented)) return true;
  // Existing beforeRemove callbacks still own actual removal. They cannot
  // protect a retained screen hidden by a forward PUSH/NAVIGATE.
  return !!current && !!prevented[current.key ?? ""]?.preventRemove && target?.key!==current.key && next.routes.some(route=>route.key===current.key);
}
export function shouldBlockBloomRouteFocus(state:FocusState,next:FocusState,prevented:PreventedRoutes,unconfirmed:boolean) {
  const current=focused(state);
  return current?.name!=="index" && (unconfirmed || !!prevented[current?.key ?? ""]?.preventRemove) &&
    focused(next)?.key!==current?.key && !returningToRecovery(state,next,prevented);
}
export function createBloomRouterBoundary<S extends NavigationState,A extends NavigationAction>(original:Router<S,A>,getPrevented:()=>PreventedRoutes,hasUnconfirmedSave:()=>boolean):Partial<Router<S,A>> {
  return {
    getStateForAction:(state,action,options)=>{
      const next=original.getStateForAction(state,action,options);
      return shouldBlockBloomNavigation(state,next,action.type,getPrevented(),hasUnconfirmedSave()) ? state : next;
    },
    getStateForRouteFocus:(state,key)=>{
      const next=original.getStateForRouteFocus(state,key);
      return shouldBlockBloomRouteFocus(state,next,getPrevented(),hasUnconfirmedSave()) ? state : next;
    }
  };
}
