import type { BloomLocalState } from "./bloomState";
import { PRACTICE_INTRO_VERSION, type CompletedPracticeSession, type PracticeIntroduction } from "../domain/models/PracticeState";
import { normalizeCompletedPracticeSession, normalizePracticeIntroduction } from "./bloomPracticeSchema";
import { getPracticeAvailability } from "../domain/productPolicy/getPracticeAvailability";
export function acknowledgePracticeIntroductionState(state: BloomLocalState, input: PracticeIntroduction): BloomLocalState {
  let introduction: PracticeIntroduction;
  try { introduction=normalizePracticeIntroduction(input); } catch { return state; }
  if(introduction.version!==PRACTICE_INTRO_VERSION || !getPracticeAvailability(state,true).canStart || state.practice.introduction?.version===introduction.version) return state;
  return {...state,practice:{...state.practice,introduction}};
}
export function saveCompletedPracticeSessionState(state: BloomLocalState, input: CompletedPracticeSession): BloomLocalState {
  let session: CompletedPracticeSession;
  try { session=normalizeCompletedPracticeSession(input); } catch { return state; }
  if(!getPracticeAvailability(state,true).canStart || state.practice.introduction?.version!==PRACTICE_INTRO_VERSION || state.practice.sessions.some(s=>s.id===session.id)) return state;
  return {...state,practice:{...state.practice,sessions:[...state.practice.sessions,session]}};
}
