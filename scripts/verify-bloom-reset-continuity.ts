import { isDeepStrictEqual } from "node:util";
import { readFileSync } from "node:fs";
import { verifyBloomContinuationUi } from "./verify-bloom-continuation-ui";
import { createResetContinuityFixture } from "./fixtures/resetContinuity";
import { createPopulatedState } from "./verify-bloom-product-persistence";
import {
  activateContentFreeState, deactivateContentFreeState, completeElapsedResetPeriodState,
  decideResetContentFreeContinuationState, recordActiveResetViolationState, undoActiveResetViolationState,
  recordManualContentFreeViolationState, undoManualContentFreeViolationState, recordBehaviorSlipState,
  type BloomLocalState
} from "../src/storage/bloomState";
import { getContentFreeProgress } from "../src/domain/contentFree/getContentFreeProgress";
import { getResetContentFreeCredit, getResetContentFreeContinuationOffer, canOfferResetContentFreeContinuation } from "../src/domain/contentFree/getResetContentFreeCredit";
import { getResetProgress } from "../src/domain/reset/getResetProgress";
import { getBloomHomeReadModel } from "../src/domain/home/getBloomHomeReadModel";
import { getBloomContentFreeEntryIntent } from "../src/app/flows/getBloomContentFreeEntryIntent";
import { createContentFreeController } from "../src/features/content-free/contentFreeController";
import { getResetRouteView } from "../src/features/reset/resetView";
import { createResetController } from "../src/features/reset/resetController";
import { createBloomProductFlowActions } from "../src/app/flows/bloomProductFlowActions";
import { createBloomProductAcknowledgedActions } from "../src/app/providers/bloomProductAcknowledgedActions";
import { createBloomLocalStateMutationRuntime } from "../src/app/providers/bloomLocalStateMutationRuntime";
import { persistBloomLocalState, loadBloomLocalState, BLOOM_STATE_STORAGE_KEY, type BloomStateWriteReceipt } from "../src/storage/bloomStatePersistence";
import { validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import { createMemoryStorageClient } from "../src/storage/storageAdapters";

export async function verifyBloomResetContinuity() {
  const f = createResetContinuityFixture();
  const day10 = f.observeDays(10);
  const original = JSON.stringify(f.state);
  assert(f.state.contentFree.status === "inactive", "Reset must earn credit without activating Content-Free.");
  const active = activateContentFreeState(f.state, { activationId: "day10-activation", activatedAt: day10 });
  assert(active.contentFree.status === "active" && active.contentFree.activatedAt === day10 && active.contentFree.currentStreakStartedAt === day10,
    "Activation boundaries remain real even with ten days of credit.");
  days(active, day10, 10, "Day 10 credit");
  days(active, f.observeDays(5), 0, "Observation before activation cannot expose future credit");
  days(active, f.observeDays(15), 15, "Five additional days must not double count credit");
  days(active, f.observeDays(20), 20, "Independently active tracking keeps running after Reset");
  assert(JSON.stringify(f.state) === original, "Selectors and activation must preserve their source.");
  const displayDay10 = f.observeDays(9, 1234);
  assert(getResetProgress(f.state.resetJourney, displayDay10)?.currentDay === 10, "Fixture uses display Day 10, not ten completed days.");
  const fractional = activateContentFreeState(f.state, { activationId: "fractional", activatedAt: displayDay10 });
  seconds(fractional, f.observeDays(14, 2100), 14 * 86400 + 2, "Elapsed credit and independent milliseconds floor only once");

  for (const reason of ["masturbation", "intentionalExplicitContent", "masturbationWithExplicitContent"] as const) {
    const at = f.observeDays(5);
    const restarted = slip(f.state, reason, at);
    assert(restarted !== f.state && restarted.contentFree.status === "inactive", "Implicit violation must not activate Content-Free.");
    const carried = activateContentFreeState(restarted, { activationId: `after-${reason}`, activatedAt: day10 });
    days(carried, day10, reason === "masturbation" ? 10 : 5, `${reason} implicit credit`);
    const undoneBefore = undoActiveResetViolationState(restarted, { violationId: `violation-${reason}`, undoneAt: f.observeDays(11) });
    assert(undoneBefore !== restarted, "Latest restart must undo before activation.");
    const afterUndo = activateContentFreeState(undoneBefore, { activationId: `undo-${reason}`, activatedAt: day10 });
    days(afterUndo, day10, 10, "Effective tombstones restore implicit history");
    const undoneAfter = undoActiveResetViolationState(carried, { violationId: `violation-${reason}`, undoneAt: f.observeDays(11) });
    assert(undoneAfter !== carried, "A pre-activation violation must remain eligible for Reset undo.");
    days(undoneAfter, f.observeDays(11), 11, "Undo reconciles pre-activation credit");
    await roundTrip(undoneAfter);

    const linked = slip(active, reason, f.observeDays(11));
    days(linked, f.observeDays(12), reason === "masturbation" ? 12 : 1, `${reason} active continuity`);
    const restored = undoActiveResetViolationState(linked, { violationId: `violation-${reason}`, undoneAt: f.observeDays(12) });
    assert(restored !== linked, "Linked active violation undo must restore credit and best exactly.");
    days(restored, f.observeDays(12), 12, "Active undo restores prior continuity");
    equal(restored.contentFree.bestStreakSeconds, active.contentFree.bestStreakSeconds, "Undo rolls best back without credit corruption");
    await roundTrip(restored);
  }

  const completed = completeElapsedResetPeriodState(f.state, { observedAt: f.observeDays(20) });
  assert(completed.resetJourney.status === "completed" && completed.resetJourney.completedAt === f.observeDays(15), "Late observation must save the actual Day 15 end.");
  assert(!canOfferResetContentFreeContinuation(f.state, f.state) && !canOfferResetContentFreeContinuation(completed, f.state), "Elapsed or accepted-only completion must never show the offer.");
  assert(canOfferResetContentFreeContinuation(completed, completed), "Only durable canonical completion offers continuation.");
  assert(getResetRouteView(completed.resetJourney, { mode: "completion", journeyId: "continuity-reset", attemptId: "continuity-attempt" }, day10).kind === "completed", "Saved completion has a resumable route.");
  assert(getBloomHomeReadModel(completed, f.observeDays(20))?.primaryAction?.id === "reviewResetContentFreeContinuation", "Home must resume an undecided saved offer.");
  assert(activateContentFreeState(completed, { activationId: "wrong-path", activatedAt: f.observeDays(20) }) === completed,
    "Ordinary activation must leave the pending offer and earned credit intact.");
  const reopened = await roundTrip(completed);
  equal(getBloomContentFreeEntryIntent(reopened, f.observeDays(20)), {
    flow: "resetCompletion", journeyId: "continuity-reset", attemptId: "continuity-attempt", progress: getResetProgress(reopened.resetJourney, f.observeDays(20))
  }, "Content-Free entry after restart must guide to the pending acknowledged continuation");
  assert(getResetContentFreeContinuationOffer(reopened, reopened)?.primaryLabel === "15 günlük serimle devam et",
    "A full fifteen completed days derives the fifteen-day CTA.");
  verifyBloomContinuationUi(getResetContentFreeContinuationOffer(reopened, reopened)!);
  const acceptedInput = { decision: "accepted" as const, decidedAt: f.observeDays(20), activationId: "continued" };
  const accepted = decideResetContentFreeContinuationState(completed, acceptedInput);
  days(accepted, f.observeDays(20), 15, "Late acceptance carries only the verified fifteen days");
  days(accepted, f.observeDays(21), 16, "Independent continuity starts at actual acceptance");
  assert(decideResetContentFreeContinuationState(accepted, acceptedInput) === accepted &&
    decideResetContentFreeContinuationState(accepted, { ...acceptedInput, activationId: "duplicate" }) === accepted, "Acceptance can create exactly one activation.");
  const declined = decideResetContentFreeContinuationState(completed, { ...acceptedInput, decision: "declined" });
  assert(declined.contentFree === completed.contentFree && !canOfferResetContentFreeContinuation(declined, declined), "Decline persists without altering any streak or activation.");
  for (const state of [completed, accepted, declined]) await roundTrip(state);
  const finishedActive = completeElapsedResetPeriodState(active, { observedAt: f.observeDays(20) });
  assert(finishedActive.contentFree === active.contentFree && !canOfferResetContentFreeContinuation(finishedActive, finishedActive), "Completion must not mutate active Content-Free or create an offer.");
  const longer = { ...f.state, contentFree: createPopulatedState().contentFree };
  const longerDone = completeElapsedResetPeriodState(longer, { observedAt: f.observeDays(20) });
  assert(longerDone.contentFree === longer.contentFree, "Longer history is preserved by reference on completion.");
  equal(getContentFreeProgress(longer.contentFree, f.observeDays(20)), getContentFreeProgress(longerDone.contentFree, f.observeDays(20)), "Longer existing progress is never reduced");
  await roundTrip(longerDone);

  const deactivated = deactivateContentFreeState(active, { endedAt: f.observeDays(11) });
  const reactivated = activateContentFreeState(deactivated, { activationId: "reactivated", activatedAt: f.observeDays(12) });
  days(reactivated, f.observeDays(12), 12, "Deactivation does not truncate independently verified Reset time");
  days(reactivated, f.observeDays(15), 15, "Reactivation derives elapsed verified time once, without adding archived streaks");
  equal(reactivated.contentFree.pastActivations, deactivated.contentFree.pastActivations, "Reactivation preserves independent activation history exactly");
  equal(deactivated.contentFree.bestStreakSeconds, 11 * 86400, "Archiving includes earned first-streak credit");
  await roundTrip(reactivated);
  const deactivatedDone = completeElapsedResetPeriodState(deactivated, { observedAt: f.observeDays(20) });
  assert(getResetContentFreeContinuationOffer(deactivatedDone, deactivatedDone)?.completedDays === 15,
    "Manual deactivation must retain all verified fifteen days in the pending offer.");
  const deactivatedAccepted = decideResetContentFreeContinuationState(deactivatedDone, { decision: "accepted", decidedAt: f.observeDays(20), activationId: "after-manual-deactivation" });
  days(deactivatedAccepted, f.observeDays(20), 15, "Continuation uses Reset elapsed time once, not archived eleven days plus fifteen");
  equal(deactivatedAccepted.contentFree.pastActivations, deactivated.contentFree.pastActivations, "Continuation preserves prior archived activations exactly");
  await roundTrip(deactivatedAccepted);
  const conservativeV7 = JSON.parse(JSON.stringify(reactivated)) as BloomLocalState;
  assert(conservativeV7.contentFree.status === "active" && conservativeV7.contentFree.resetCredit !== undefined, "Conservative v7 fixture requires credit.");
  conservativeV7.contentFree.resetCredit.earnedStartedAt = f.observeDays(11);
  await roundTrip(conservativeV7);
  days(conservativeV7, f.observeDays(12), 1, "Previously persisted conservative v7 credit loads without silent historical rewriting");

  // Older independent history can carry a relevant explicit-content violation
  // without the newer atomic Reset transaction. Its effective evidence still
  // limits transferable credit and must produce truthful offer messaging.
  const independentlyRecorded = recordManualContentFreeViolationState({ ...active, resetJourney: { status: "inactive", durationDays: 15, bestCompletedDays: 0, pastAttempts: [], violations: [] } }, {
    violationId: "historical-cut", logActionId: "historical-cut-source", occurredAt: f.observeDays(12, 1000), recordedAt: f.observeDays(12, 1000)
  });
  const limited = completeElapsedResetPeriodState({ ...deactivateContentFreeState(independentlyRecorded, { endedAt: f.observeDays(13) }), resetJourney: f.state.resetJourney }, { observedAt: f.observeDays(20) });
  const limitedOffer = getResetContentFreeContinuationOffer(limited, limited);
  assert(limitedOffer?.completedDays === 2 && limitedOffer.primaryLabel === "2 günlük serimle devam et",
    "Fractional transferable credit below fifteen completed days must never use the fifteen-day CTA.");
  verifyBloomContinuationUi(limitedOffer);
  const limitedAccepted = decideResetContentFreeContinuationState(limited, { decision: "accepted", decidedAt: f.observeDays(20), activationId: "limited-credit" });
  seconds(limitedAccepted, f.observeDays(20), 3 * 86400 - 1, "Acceptance imports exactly the same credit displayed by the canonical selector");
  await roundTrip(limitedAccepted);
  const accident = recordBehaviorSlipState(active, { reason: "accidentalExposure" as never, occurredAt: f.observeDays(11), recordedAt: f.observeDays(11), logActionId: "accident", resetViolationId: "accident-reset", replacementResetAttemptId: "accident-attempt", contentFreeViolationId: "accident-content" });
  assert(accident === active, "Accidental exposure cannot break continuity.");

  const zero = slip(active, "intentionalExplicitContent", day10);
  days(zero, day10, 0, "Violation at the activation boundary must consume all credit");
  const zeroUndo = undoActiveResetViolationState(zero, { violationId: "violation-intentionalExplicitContent", undoneAt: f.observeDays(11) });
  days(zeroUndo, day10, 10, "Boundary undo must restore credit");

  // Undo an older restart after its original Reset would have expired.
  const lateRestart = slip(f.state, "intentionalExplicitContent", f.observeDays(10));
  const lateActive = activateContentFreeState(lateRestart, { activationId: "late-before-undo", activatedAt: f.observeDays(19) });
  days(lateActive, f.observeDays(19), 9, "Restarted implicit period fixture");
  const lateViolation = recordManualContentFreeViolationState(lateActive, { violationId: "late-manual", logActionId: "late-manual-source", occurredAt: f.observeDays(26), recordedAt: f.observeDays(26) });
  const lateUndo = undoActiveResetViolationState(lateViolation, { violationId: "violation-intentionalExplicitContent", undoneAt: f.observeDays(27) });
  assert(lateUndo !== lateViolation && lateUndo.contentFree.status === "active" && lateUndo.contentFree.resetCredit?.earnedUntil === f.observeDays(15), "Undo must retract credit beyond the restored Reset end.");
  equal(lateUndo.contentFree.bestStreakSeconds, 22 * 86400, "Best uses corrected 15-day credit plus seven independent days");
  const undoLaterManual = undoManualContentFreeViolationState(lateUndo, { violationId: "late-manual", undoneAt: f.observeDays(28) });
  assert(undoLaterManual !== lateUndo, "Corrected snapshots must still support later manual undo.");
  days(undoLaterManual, f.observeDays(28), 24, "Restored streak excludes four unverified gap days");
  await roundTrip(undoLaterManual);

  const sameBoundary = activateContentFreeState(lateRestart, { activationId: "same-boundary", activatedAt: f.observeDays(25) });
  const firstBoundary = recordManualContentFreeViolationState(sameBoundary, { violationId: "boundary-first", logActionId: "boundary-first-source", occurredAt: f.observeDays(25), recordedAt: f.observeDays(25) });
  const secondBoundary = recordManualContentFreeViolationState(firstBoundary, { violationId: "boundary-second", logActionId: "boundary-second-source", occurredAt: f.observeDays(25), recordedAt: f.observeDays(25) });
  const boundaryCorrection = undoActiveResetViolationState(secondBoundary, { violationId: "violation-intentionalExplicitContent", undoneAt: f.observeDays(26) });
  assert(boundaryCorrection !== secondBoundary, "Equal-time standalone events must not prevent pre-activation Reset undo.");
  equal(boundaryCorrection.contentFree.bestStreakSeconds, 15 * 86400, "Only the first equal-time violation archives credit");
  const boundarySecondUndo = undoManualContentFreeViolationState(boundaryCorrection, { violationId: "boundary-second", undoneAt: f.observeDays(27) });
  assert(boundarySecondUndo !== boundaryCorrection, "Equal-time later snapshot retains the corrected prior best.");
  const boundaryFirstUndo = undoManualContentFreeViolationState(boundarySecondUndo, { violationId: "boundary-first", undoneAt: f.observeDays(27) });
  days(boundaryFirstUndo, f.observeDays(27), 17, "Sequential same-boundary undo restores credit exactly once");
  await roundTrip(boundaryFirstUndo);

  const clippedFirst = activateContentFreeState(lateRestart, { activationId: "clip-first", activatedAt: f.observeDays(18) });
  const clippedEnd = deactivateContentFreeState(clippedFirst, { endedAt: f.observeDays(19) });
  const clippedNext = activateContentFreeState(clippedEnd, { activationId: "clip-next", activatedAt: f.observeDays(20) });
  days(clippedNext, f.observeDays(20), 10, "Second activation retains verified time since the explicit violation");
  const clippedUndo = undoActiveResetViolationState(clippedNext, { violationId: "violation-intentionalExplicitContent", undoneAt: f.observeDays(21) });
  assert(clippedUndo !== clippedNext && clippedUndo.contentFree.status === "active" && clippedUndo.contentFree.resetCredit?.earnedUntil === f.observeDays(15),
    "Undo caps both credits at the restored verified end, irrespective of deactivation.");
  days(clippedUndo, f.observeDays(21), 16, "Corrected credit excludes the unobserved gap and preserves independent elapsed time");
  equal(clippedUndo.contentFree.bestStreakSeconds, 16 * 86400, "Archived best must also retract unverified credit");
  await roundTrip(clippedUndo);

  const firstRestart = slip(f.state, "masturbation", f.observeDays(4));
  const secondRestart = slip(firstRestart, "intentionalExplicitContent", f.observeDays(8));
  const thirdRestart = recordActiveResetViolationState(secondRestart, { reason: "masturbation", occurredAt: f.observeDays(9), recordedAt: f.observeDays(9),
    violationId: "third-violation", replacementAttemptId: "third-attempt", source: { kind: "manual", logActionId: "third-source" } });
  const multiple = activateContentFreeState(thirdRestart, { activationId: "multiple", activatedAt: day10 });
  days(multiple, day10, 2, "Multiple attempts use latest effective explicit violation, not latest attempt start");
  const undoThird = undoActiveResetViolationState(multiple, { violationId: "third-violation", undoneAt: f.observeDays(11) });
  days(undoThird, f.observeDays(11), 3, "Masturbation undo preserves multiple-attempt continuity");
  const undoSecond = undoActiveResetViolationState(undoThird, { violationId: "violation-intentionalExplicitContent", undoneAt: f.observeDays(12) });
  days(undoSecond, f.observeDays(12), 12, "Sequential explicit undo restores the connected coverage");
  await roundTrip(undoSecond);

  await verifyAcknowledgements();
  await verifyCompatibilityAndValidation(accepted);
  const appSource = readFileSync("src/features/reset/useResetFeature.ts", "utf8");
  assert(!appSource.includes("resetContinuity") && !appSource.includes("dateOffsetDays"), "Test-only fixture clock cannot be reached by the production feature.");
  console.log("Bloom Reset continuity verification passed (all 15 requested regression groups, fractional/boundary credit, multiple restarts, undo corrections, isolated injected clock, saved offers, retries, and v7 preservation).");
}

function slip(state: BloomLocalState, reason: "masturbation" | "intentionalExplicitContent" | "masturbationWithExplicitContent", at: string) {
  return recordActiveResetViolationState(state, { reason, occurredAt: at, recordedAt: at,
    violationId: `violation-${reason}`, replacementAttemptId: `replacement-${reason}`,
    source: { kind: "manual", logActionId: `source-${reason}` }, contentFreeViolationId: `content-${reason}` });
}
function seconds(state: BloomLocalState, at: string, expected: number, message: string) {
  const progress = getContentFreeProgress(state.contentFree, at);
  assert(progress?.status === "active" && progress.currentStreakSeconds === expected, `${message}: expected ${expected}, got ${JSON.stringify(progress)}.`);
}
function days(state: BloomLocalState, at: string, expected: number, message: string) { seconds(state, at, expected * 86400, message); }
async function roundTrip(state: BloomLocalState) {
  assert(validateAndNormalizeBloomState(state).success, "Continuity state must validate before persistence.");
  const storage = createMemoryStorageClient();
  const now = () => new Date("2026-12-01T00:00:00.000Z");
  await persistBloomLocalState(state, storage, now);
  const loaded = await loadBloomLocalState(storage, now);
  assert(loaded.status === "success", "Continuity must rehydrate successfully.");
  equal(loaded.state, state, "Credit, decisions, tombstones, and old histories must survive restart");
  return loaded.state;
}
async function verifyCompatibilityAndValidation(accepted: BloomLocalState) {
  const old = createPopulatedState();
  await roundTrip(old);
  const storage = createMemoryStorageClient();
  const bytes = JSON.stringify({ version: 7, savedAt: "2026-12-01T00:00:00.000Z", state: old });
  await storage.setItem(BLOOM_STATE_STORAGE_KEY, bytes);
  const loaded = await loadBloomLocalState(storage);
  assert(loaded.status === "success" && loaded.source === "current", "Original v7 data without new fields must load safely.");
  equal(loaded.state, old, "Old v7 history must not be inferred or discarded");
  for (const mutate of [
    (s: any) => { s.contentFree.resetCredit.earnedUntil = "invalid"; },
    (s: any) => { s.contentFree.resetCredit.earnedStartedAt = s.contentFree.resetCredit.earnedUntil; },
    (s: any) => { s.contentFree.resetCredit.earnedUntil = "2027-01-01T00:00:00.000Z"; },
    (s: any) => { s.contentFree.resetCredit.bestStreakSecondsBefore = -1; },
    (s: any) => { s.contentFree.resetCredit.earnedStartedAt = "2026-01-01T00:00:00.000Z"; },
    (s: any) => { s.resetJourney.contentFreeContinuation.decidedAt = "2020-01-01T00:00:00.000Z"; },
    (s: any) => { s.resetJourney.contentFreeContinuation.decision = "maybe"; },
    (s: any) => { delete s.contentFree.resetCredit; }
  ]) {
    const malformed = JSON.parse(JSON.stringify(accepted)); mutate(malformed);
    assert(!validateAndNormalizeBloomState(malformed).success, "Malformed credit and decision records must be rejected, never silently normalized away.");
    const raw = JSON.stringify({ version: 7, savedAt: "2026-12-01T00:00:00.000Z", state: malformed });
    const client = createMemoryStorageClient(); await client.setItem(BLOOM_STATE_STORAGE_KEY, raw);
    const result = await loadBloomLocalState(client);
    assert(result.status === "corrupt" && result.backupKey !== null && JSON.parse((await client.getItem(result.backupKey))!).rawPayload === raw && await client.getItem(BLOOM_STATE_STORAGE_KEY) === raw, "Corrupt new fields must preserve original payload for recovery.");
  }
}
async function verifyAcknowledgements() {
  const f = createResetContinuityFixture();
  f.observeDays(15);
  const attempts: Array<{ state: BloomLocalState; succeed: () => void; fail: () => void }> = [];
  const runtime = createBloomLocalStateMutationRuntime({ initialState: f.state, initialHydrationStatus: "ready",
    persistState: (state) => new Promise<BloomStateWriteReceipt>((resolve, reject) => attempts.push({ state,
      succeed: () => resolve({ status: "persisted", writeId: attempts.length, generation: 0 }), fail: () => reject(new Error("Synthetic persistence failure")) })) });
  let ids = 0;
  const flow = createBloomProductFlowActions({ productActions: createBloomProductAcknowledgedActions({ applyAcknowledgedMutation: runtime.applyAcknowledgedMutation }), now: f.now, createId: (prefix) => `${prefix}-${++ids}` });
  const controller = createResetController({ flowActions: flow, getState: runtime.getState, getDisplayTime: () => f.now().toISOString(),
    getRoute: () => ({ mode: "completion", journeyId: "continuity-reset", attemptId: "continuity-attempt" }), retryPersistedMutation: runtime.retryPersistence });
  const pending = controller.completeElapsed(runtime.getState().resetJourney);
  assert(pending !== null && !canOfferResetContentFreeContinuation(runtime.getState(), runtime.getDurableState()), "Pending completion is not an offer.");
  attempts[0]!.fail(); await pending;
  assert(!canOfferResetContentFreeContinuation(runtime.getState(), runtime.getDurableState()), "Failed completion is not an offer.");
  const retry = controller.retry(); assert(retry !== null, "Failed completion must retry the same receipt.");
  attempts[1]!.succeed(); await retry;
  assert(canOfferResetContentFreeContinuation(runtime.getState(), runtime.getDurableState()), "Retried durable completion unlocks the offer.");
  const contentController = createContentFreeController({ flowActions: flow, getState: runtime.getState, retryPersistedMutation: runtime.retryPersistence });
  assert(contentController.activate(runtime.getState().contentFree) === null && ids === 0 && attempts.length === 2,
    "Ordinary controller activation cannot generate identities, save zero credit, or consume the offer.");
  const ordinary = await flow.contentFree.activate();
  assert(!ordinary.ok && !ordinary.accepted && attempts.length === 2 && runtime.getState().contentFree.status === "inactive",
    "Direct acknowledged ordinary activation must fail closed without an activation write.");
  const beforeAcceptIds = ids;
  const accept = controller.decideContinuation("accepted", runtime.getState().resetJourney);
  assert(accept !== null && controller.decideContinuation("accepted", runtime.getState().resetJourney) === accept && ids === beforeAcceptIds + 1, "Duplicate acceptance shares one activation and in-flight receipt.");
  attempts[2]!.fail(); await accept;
  assert(controller.getSnapshot().result?.ok === false && !canOfferResetContentFreeContinuation(runtime.getState(), runtime.getDurableState()), "Failed activation cannot claim saved success or repeat the offer.");
  const accepted = runtime.getState();
  const again = controller.retry(); assert(again !== null, "Activation failure must remain retryable.");
  assert(runtime.getState() === accepted && ids === beforeAcceptIds + 1 && attempts[3]!.state === accepted, "Retry persists the identical activation without replay or regenerated facts.");
  attempts[3]!.succeed(); await again;
  assert(runtime.getDurableState() === accepted && controller.getSnapshot().result?.ok === true, "Only a durable retry reports success.");
  days(accepted, f.now().toISOString(), 15, "Acknowledged acceptance carries fifteen days exactly once");
  await roundTrip(accepted);
}
function equal(a: unknown, b: unknown, message: string) { assert(isDeepStrictEqual(a, b), message); }
function assert(value: boolean, message: string): asserts value { if (!value) throw new Error(message); }
