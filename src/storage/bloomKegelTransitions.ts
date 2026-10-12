import type { CompletedKegelSession } from "../domain/models/KegelState";
import type { BloomLocalState } from "./bloomState";
import { normalizeCompletedKegelSession } from "./bloomKegelSchema";
import { isValidBloomIsoTimestamp } from "./bloomValueValidation";

export function completeKegelOnboardingState(state: BloomLocalState, completedAt: string): BloomLocalState {
  if (state.kegel.onboardingCompletedAt !== null || !isValidBloomIsoTimestamp(completedAt)) return state;
  return { ...state, kegel: { ...state.kegel, onboardingCompletedAt: completedAt } };
}

export function saveCompletedKegelSessionState(state: BloomLocalState, input: CompletedKegelSession): BloomLocalState {
  let session: CompletedKegelSession;
  try { session = normalizeCompletedKegelSession(input); } catch { return state; }
  // Identity is captured at start and retained through every callback/retry.
  // Existing identities are immutable, even if a duplicate carries new metrics.
  if (state.kegel.sessions.some(entry => entry.id === session.id)) return state;
  return { ...state, kegel: { ...state.kegel, sessions: [...state.kegel.sessions, session] } };
}
