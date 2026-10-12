import { useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { getKegelFrame } from "./kegelSession";
import { kegelConfig, type KegelWorkoutConfig } from "./kegelConfig";
import type { KegelSessionMetrics } from "../../domain/models/KegelState";

export function useKegelExercise(onComplete:(metrics:KegelSessionMetrics)=>void, initialPaused = false, initialActiveMs = 0, config:KegelWorkoutConfig = kegelConfig) {
  const [paused,setPaused] = useState(initialPaused);
  const [activeMs,setActiveMs] = useState(initialActiveMs);
  const elapsed = useRef(initialActiveMs);
  const anchor = useRef<number|null>(null);
  const complete = useRef(false);
  const began = useRef<number|null>(null);
  const pauseCount = useRef(initialPaused ? 1 : 0);
  const finish = useRef(onComplete);finish.current=onComplete;
  const frame = getKegelFrame(activeMs,config);
  const pause = () => {
    if(anchor.current!==null) { pauseCount.current++;elapsed.current+=performance.now()-anchor.current;anchor.current=null;setActiveMs(elapsed.current); }
    setPaused(true);
  };
  const resume = () => setPaused(false);
  useEffect(() => {
    if(paused || complete.current) return;
    anchor.current=performance.now();
    if(began.current===null) began.current=anchor.current-initialActiveMs;
    const timer=setInterval(() => {
      if(anchor.current===null) return;
      const next=elapsed.current+performance.now()-anchor.current;
      setActiveMs(next);
      if(getKegelFrame(next,config).phase==="completed" && !complete.current) {
        complete.current=true;clearInterval(timer);anchor.current=null;
        const activeExerciseSeconds=config.repetitions*(config.contractionSeconds+config.relaxationSeconds);
        const pausedSeconds=Math.max(0,(performance.now()-(began.current ?? performance.now())-next)/1000);
        const elapsedSeconds=activeExerciseSeconds+config.countdownSeconds+pausedSeconds;
        finish.current({activeExerciseSeconds,elapsedSeconds,pausedSeconds,pauseCount:pauseCount.current});
      }
    },50);
    return () => { clearInterval(timer);if(anchor.current!==null) {elapsed.current+=performance.now()-anchor.current;anchor.current=null;} };
  },[paused]);
  useEffect(() => {
    const subscription=AppState.addEventListener("change",state => { if(state!=="active") pause(); });
    return () => subscription.remove();
  },[]);
  return {frame,paused,pause,resume};
}
