import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { getKegelFrame } from "./kegelSession";

export function useKegelExercise(onComplete:()=>void, initialPaused = false, initialActiveMs = 0) {
  const [paused,setPaused] = useState(initialPaused);
  const [activeMs,setActiveMs] = useState(initialActiveMs);
  const elapsed = useRef(initialActiveMs);
  const anchor = useRef<number|null>(null);
  const complete = useRef(false);
  const finish = useRef(onComplete);finish.current=onComplete;
  const frame = getKegelFrame(activeMs);
  const pause = () => {
    if(anchor.current!==null) { elapsed.current+=performance.now()-anchor.current;anchor.current=null;setActiveMs(elapsed.current); }
    setPaused(true);
  };
  const resume = () => setPaused(false);
  useEffect(() => {
    if(paused || complete.current) return;
    anchor.current=performance.now();
    const timer=setInterval(() => {
      if(anchor.current===null) return;
      const next=elapsed.current+performance.now()-anchor.current;
      setActiveMs(next);
      if(getKegelFrame(next).phase==="completed" && !complete.current) { complete.current=true;clearInterval(timer);anchor.current=null;finish.current(); }
    },50);
    return () => { clearInterval(timer);if(anchor.current!==null) {elapsed.current+=performance.now()-anchor.current;anchor.current=null;} };
  },[paused]);
  useEffect(() => {
    const subscription=AppState.addEventListener("change",state => { if(state!=="active") pause(); });
    return () => subscription.remove();
  },[]);
  return {frame,paused,pause,resume};
}
