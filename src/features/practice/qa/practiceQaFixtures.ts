import populatedV8Fixture from "./populatedV8Fixture";
import { validateAndNormalizeBloomState } from "../../../storage/bloomStateSchema";
import { createDefaultBloomState, activateContentFreeState, completeElapsedResetPeriodState, completeKegelOnboardingState, saveCompletedKegelSessionState } from "../../../storage/bloomState";
import { createResetContinuityFixture } from "../../debug/phase10/resetContinuityFixture";
import type { CompletedPracticeSession } from "../../../domain/models/PracticeState";
export function practiceQaRecord(id="qa-guided-practice"):CompletedPracticeSession {
  return {id,version:1,source:"guided_practice",startedAt:"2026-10-13T08:00:00.000Z",completedAt:"2026-10-13T08:02:00.000Z",timezone:{name:"Europe/Istanbul",utcOffsetMinutes:-180},foregroundExerciseMs:60000,activeMs:45000,intentionalPauseMs:15000,pauses:[{startMs:20000,endMs:35000}],arousalReports:[{atMs:19000,reportedAt:"2026-10-13T08:00:19.000Z",level:7}],erectionQuality:8,explicitContent:false,ending:"stopped",feelings:["Sakin"]};
}
export const practiceQaFixtures=["fresh-v8","populated-v8","reset-active","reset-elapsed","reset-baseline","reset-completed-pending","corrupt-v9","unsupported-v9"] as const;
export function createPracticeQaFixture(name:string) {
  let state=createDefaultBloomState();
  if(name!=="fresh-v8") {
    state.library={bookmarkedArticleIds:["wave"],completedArticleIds:["wave"]};
    state=completeKegelOnboardingState(state,"2026-10-12T08:00:00.000Z");
    state=saveCompletedKegelSessionState(state,{id:"qa-kegel-preserved",status:"completed",startedAt:"2026-10-12T08:00:00.000Z",completedAt:"2026-10-12T08:01:03.000Z",completionDate:"2026-10-12",completionUtcOffsetMinutes:-180,program:{configurationId:"qa-preserved",provisional:true,repetitions:10,contractionSeconds:3,relaxationSeconds:3,countdownSeconds:3,dailyTarget:3},completedRepetitions:10,metrics:{activeExerciseSeconds:60,elapsedSeconds:63,pausedSeconds:0,pauseCount:0}});
    state=activateContentFreeState(state,{activationId:"qa-content-preserved",activatedAt:"2026-10-12T08:00:00.000Z"});
  }
  if(name==="populated-v8") {
    const validated=validateAndNormalizeBloomState({...populatedV8Fixture,kegel:state.kegel});
    if(!validated.success)throw new Error("Invalid isolated populated fixture");state=validated.state;
  }
  if(name.startsWith("reset-")) {
    state.resetJourney=createResetContinuityFixture().state.resetJourney;
    state.practice={introduction:{version:1,acknowledgedAt:"2026-10-12T08:00:00.000Z"},sessions:[practiceQaRecord()]};
    if(name==="reset-active") {
      const reset=state.resetJourney;if(reset.status==="active") {const today=new Date().toISOString();state.resetJourney={...reset,startedAt:today,baseline:{...reset.baseline,capturedAt:today},currentAttempt:{...reset.currentAttempt,startedAt:today}};}
    }
    if(name==="reset-elapsed"||name==="reset-completed-pending") {
      const reset=state.resetJourney;if(reset.status==="active") {const start="2026-09-01T10:00:00.250Z";state.resetJourney={...reset,startedAt:start,baseline:{...reset.baseline,capturedAt:start},currentAttempt:{...reset.currentAttempt,startedAt:start}};}
    }
    if(name==="reset-baseline")state.resetJourney={...createDefaultBloomState().resetJourney,status:"baseline_pending",id:"qa-baseline"};
    if(name==="reset-completed-pending") {state.contentFree=createDefaultBloomState().contentFree;state=completeElapsedResetPeriodState(state,{observedAt:"2026-09-16T10:00:00.250Z"});}
  }
  // v8 has no Practice slice. Non-v8 fixtures explicitly test v9 records.
  if(name==="fresh-v8"||name==="populated-v8") {const {practice,...v8}=state;return {key:"bloom.localState.v8",payload:JSON.stringify({version:8,savedAt:new Date().toISOString(),state:v8})};}
  return {key:"bloom.localState.v9",payload:name==="corrupt-v9"?"{broken":JSON.stringify({version:name==="unsupported-v9"?99:9,savedAt:new Date().toISOString(),state})};
}
