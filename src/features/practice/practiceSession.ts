// Temporary Practice runtime. No storage, tracking transitions or physiological inference.
export type PracticePhase = "intro" | "running" | "paused" | "reflection" | "summary" | "discarded";
export const practiceEndings = { came:"Boşaldım", stopped:"Boşalmadan bitirdim", soft:"Sertlik azaldı, bıraktım", other:"Diğer" } as const;
export const practiceFeelings = ["Kontrollü", "Sakin", "Aceleci", "Kaygılı", "Yorgun"] as const;
export type PracticeEnding = keyof typeof practiceEndings;
export type PracticeFeeling = typeof practiceFeelings[number];
export type PracticeSnapshot = {
  phase:PracticePhase; elapsedMs:number; pauseMs:number; question:0|1|2;
  pauses:readonly {atMs:number; durationMs:number}[];
  levels:readonly {atMs:number; level:number}[];
  quality:number|null; content:boolean|null; ending:PracticeEnding|null; feelings:readonly PracticeFeeling[];
  background:boolean; confirmingExit:boolean;
};
export const formatPracticeTime = (ms:number) => {
  const seconds=Math.floor(ms/1000);
  return `${String(Math.floor(seconds/60)).padStart(2,"0")}:${String(seconds%60).padStart(2,"0")}`;
};
export function createPracticeSession(now:()=>number) {
  let state:PracticeSnapshot={phase:"intro",elapsedMs:0,pauseMs:0,question:0,pauses:[],levels:[],quality:null,content:null,ending:null,feelings:[],background:false,confirmingExit:false};
  let anchor:number|null=null, pauseAt=0, disposed=false;
  const listeners=new Set<()=>void>();
  const timed=()=>state.phase==="running" || state.phase==="paused";
  const canAct=()=>!disposed && !state.background && !state.confirmingExit;
  const publish=(patch:Partial<PracticeSnapshot>)=>{if(disposed)return;state={...state,...patch};listeners.forEach(f=>f());};
  const settle=()=>{
    const stamp=now();
    if(anchor!==null){const delta=Math.max(0,stamp-anchor);anchor=stamp;publish({elapsedMs:state.elapsedMs+delta,pauseMs:state.pauseMs+(state.phase==="paused"?delta:0)});}
  };
  const closePause=()=>state.phase==="paused" ? [...state.pauses,{atMs:pauseAt,durationMs:state.pauseMs}] : state.pauses;
  return {
    activate:()=>{disposed=false;if(timed()&&!state.background&&!state.confirmingExit)anchor=now();},
    getSnapshot:()=>state,
    subscribe:(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};},
    tick:()=>{if(!disposed)settle();},
    start:()=>{if(state.phase!=="intro"||!canAct())return;anchor=now();publish({phase:"running"});},
    pause:()=>{if(state.phase!=="running"||!canAct())return;settle();pauseAt=state.elapsedMs;publish({phase:"paused",pauseMs:0});},
    resume:()=>{if(state.phase!=="paused"||!canAct())return;settle();publish({phase:"running",pauses:closePause(),pauseMs:0});},
    reportLevel:(level:number)=>{if(!timed()||!canAct()||!Number.isInteger(level)||level<1||level>10)return;settle();publish({levels:[...state.levels,{atMs:state.elapsedMs,level}]});},
    finish:()=>{if(!timed()||disposed||state.background)return;settle();anchor=null;publish({phase:"reflection",pauses:closePause(),pauseMs:0,question:0,confirmingExit:false});},
    background:()=>{if(!timed()||disposed||state.background)return;settle();anchor=null;publish({background:true});},
    continueForeground:()=>{if(!timed()||disposed||state.confirmingExit||!state.background)return;anchor=now();publish({background:false});},
    askExit:()=>{if(disposed||state.phase==="intro"||state.phase==="discarded"||state.confirmingExit)return;settle();anchor=null;publish({confirmingExit:true});},
    keep:()=>{if(disposed||!state.confirmingExit)return;if(timed()&&!state.background)anchor=now();publish({confirmingExit:false});},
    discard:()=>{anchor=null;publish({phase:"discarded",confirmingExit:false});},
    answerQuality:(quality:number)=>{if(state.phase==="reflection"&&state.question===0&&canAct()&&Number.isInteger(quality)&&quality>=1&&quality<=10)publish({quality});},
    answerContent:(content:boolean)=>{if(state.phase==="reflection"&&state.question===1&&canAct())publish({content});},
    answerEnding:(ending:PracticeEnding)=>{if(state.phase==="reflection"&&state.question===2&&canAct()&&ending in practiceEndings)publish({ending});},
    toggleFeeling:(feeling:PracticeFeeling)=>{if(state.phase==="reflection"&&state.question===2&&canAct()&&practiceFeelings.includes(feeling))publish({feelings:state.feelings.includes(feeling)?state.feelings.filter(f=>f!==feeling):[...state.feelings,feeling]});},
    next:(expected:0|1|2,skip=false)=>{
      if(state.phase!=="reflection"||state.question!==expected||!canAct())return;
      if(!skip && (expected===0?state.quality===null:expected===1?state.content===null:state.ending===null))return;
      const patch=skip?(expected===0?{quality:null}:expected===1?{content:null}:{ending:null}):{};
      publish({...patch,...(expected===2?{phase:"summary" as const}:{question:(expected+1) as 1|2})});
    },
    back:(expected:0|1|2)=>{if(state.phase==="reflection"&&state.question===expected&&expected>0&&canAct())publish({question:(expected-1) as 0|1});},
    edit:()=>{if(state.phase==="summary"&&canAct())publish({phase:"reflection",question:0});},
    dispose:()=>{anchor=null;disposed=true;listeners.clear();}
  };
}
