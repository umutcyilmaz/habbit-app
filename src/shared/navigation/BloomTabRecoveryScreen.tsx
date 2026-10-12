import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import { View } from "react-native";
import { useBloomLocalState } from "../../app/providers/BloomLocalStateProvider";
import { AppText } from "../components/v4/AppText";
import { AppButton } from "../components/v4/AppButton";
import { usePersistenceNavigationGuard } from "./usePersistenceNavigationGuard";

/** Keep whole-state recovery reachable when tabs are locked, including migration failure. */
export function BloomTabRecoveryScreen({children}:PropsWithChildren) {
  const bloom=useBloomLocalState();
  const [busy,setBusy]=useState(false),[message,setMessage]=useState<string|null>(null);
  const inFlight=useRef(false),mounted=useRef(true);
  const unconfirmed=bloom.state!==bloom.durableState;
  usePersistenceNavigationGuard(busy || unconfirmed);
  useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;};},[]);
  useEffect(()=>{if(!unconfirmed) setMessage(null);},[unconfirmed]);
  const confirm=async()=>{
    if(inFlight.current || bloom.getAcceptedState()===bloom.getDurableState()) return;
    inFlight.current=true;setBusy(true);setMessage(null);
    try {
      const result=await bloom.confirmCurrentPersistence();
      if(mounted.current && (!result.ok || bloom.getAcceptedState()!==bloom.getDurableState())) setMessage("Güncel kaydın doğrulanmadı. Yeniden dene.");
    } catch {if(mounted.current)setMessage("Kayıt kontrolü tamamlanamadı. Yeniden dene.");}
    finally {inFlight.current=false;if(mounted.current)setBusy(false);}
  };
  return <View style={{flex:1}}>{children}
    {(unconfirmed || busy) && <View testID="bloom.tab-save.recovery" style={{padding:16,gap:10,backgroundColor:"#141415"}}>
      <AppText accessibilityLiveRegion="polite">{busy ? "Kaydediliyor…" : message ?? "Güncel kayıtlar bu cihaza henüz doğrulanmadı. Sekme değiştirmeden önce kaydı doğrula."}</AppText>
      <AppButton testID="bloom.tab-save.confirm" label="Güncel kaydı doğrula" loading={busy} disabled={busy} onPress={()=>{void confirm();}} />
    </View>}
  </View>;
}
