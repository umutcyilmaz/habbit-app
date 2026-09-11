import { isDeepStrictEqual } from "node:util";

import type { BehaviorEventSource, ResetJourney, ResetViolation } from "../src/domain/models";
import { getResetProgress } from "../src/domain/reset/getResetProgress";
import {
  createDefaultBloomState, recordActiveResetViolationState, undoActiveResetViolationState, type BloomLocalState
} from "../src/storage/bloomState";
import {
  BLOOM_CORRUPT_BACKUP_PREFIX, BLOOM_LEGACY_STATE_STORAGE_KEYS, BLOOM_STATE_STORAGE_KEY,
  createBloomStatePersistenceCoordinator, loadBloomLocalState, persistBloomLocalState
} from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION, validateAndNormalizeBloomState } from "../src/storage/bloomStateSchema";
import type { StorageClient } from "../src/storage/storageAdapters";
import { createPopulatedState } from "./verify-bloom-product-persistence";
import { createActiveState, createInput } from "./verify-bloom-reset-violations";

const undoneAt = "2026-09-07T12:02:00.000Z";
const v6Key = "bloom.localState.v6";
const historicalKeys = [v6Key, "bloom.localState.v5", "bloom.localState.v4", "bloom.localState.v3", "bloom.localState.v2", "bloom.localState.v1"] as const;
const reasons = ["masturbation", "intentionalExplicitContent", "masturbationWithExplicitContent"] as const;
const now = () => new Date("2026-10-30T12:00:00.000Z");
type UndoInput = Parameters<typeof undoActiveResetViolationState>[1];
type RecordInput = Parameters<typeof recordActiveResetViolationState>[1];

export async function verifyBloomResetViolationUndo() {
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7", "Undo lifecycle facts must use canonical v7 storage.");
  equal(BLOOM_LEGACY_STATE_STORAGE_KEYS, historicalKeys, "Migration sources must prefer v6 through v1.");
  await verifyImmediateUndoAndRoundTrip();
  await verifySequentialUndo();
  verifyTruthfulBestRestoration();
  verifyInactiveContentFreeProof();
  const rejected = verifyUnsafeUndo();
  await verifyV6Migration();
  await verifyMigrationDurability();
  const corrupted = await verifyMalformedUndoFacts();
  await verifyDeletionAndFuturePreservation();
  console.log(`Bloom Reset violation undo verification passed (${rejected} rejected atomic undos; ${corrupted} corrupt tombstone cases; immediate/sequential restoration, stale retries, truthful best rollback, and v6–v7 migration).`);
}

async function verifyImmediateUndoAndRoundTrip() {
  for (const reason of reasons) {
    for (const kind of ["manual", "masturbationSession"] as const) {
      for (const contentActive of [false, true]) {
        for (const history of [false, true]) {
          const original = createActiveState(history, contentActive);
          const input = createInput(reason, sourceFor(kind, "mistaken-behavior"));
          const logged = recordActiveResetViolationState(original, input);
          const target = last(logged.resetJourney.violations);
          assert(logged !== original && target?.status === "recorded", "Logging must create a recorded violation before undo.");
          assert(target.bestCompletedDaysBefore === original.resetJourney.bestCompletedDays, "New violations must retain the exact prior best, including values not represented by remaining history.");
          const loggedBytes = JSON.stringify(logged);
          const restored = undoActiveResetViolationState(logged, { violationId: input.violationId, undoneAt });
          assert(restored !== logged && restored.resetJourney.status === "active" && original.resetJourney.status === "active", `${reason}/${kind}: latest undo must restore an active original attempt.`);
          equal(restored.resetJourney, {
            ...original.resetJourney,
            violations: [...original.resetJourney.violations, { ...target, status: "undone", undoneAt }]
          }, "Undo must restore the original attempt/history/best and retain only the mistaken violation as an undone tombstone.");
          assert(restored.resetJourney.currentAttempt.id === original.resetJourney.currentAttempt.id && restored.resetJourney.currentAttempt.startedAt === original.resetJourney.currentAttempt.startedAt, "Undo must restore the original attempt identity and start, discarding the replacement attempt.");
          assert(!("completedDays" in restored.resetJourney.currentAttempt), "Restored active attempts must derive progress without a persisted day count.");
          assert(getResetProgress(restored.resetJourney, undoneAt)?.completedDays === 6, "Elapsed progress after undo must use the original attempt start.");
          const contentAffected = contentActive && reason !== "masturbation";
          if (contentAffected) {
            const linked = last(logged.contentFree.violations);
            assert(linked?.status === "recorded", "Linked recorded Content-Free violation required.");
            equal(restored.contentFree, {
              ...original.contentFree,
              violations: [...original.contentFree.violations, { ...linked, status: "undone", undoneAt }]
            }, "Linked undo must atomically restore the exact prior streak/best and preserve activation/history with an undone Content-Free tombstone.");
          }
          for (const key of Object.keys(logged) as Array<keyof BloomLocalState>) {
            if (key !== "resetJourney" && (key !== "contentFree" || !contentAffected)) assert(restored[key] === logged[key], `Undo must preserve ${key} by reference, including onboarding, Tracking, Urge Control, Protect, and every legacy slice.`);
          }
          assert(JSON.stringify(logged) === loggedBytes, "Undo must not mutate its input snapshot.");
          equal(undoActiveResetViolationState(logged, { violationId: input.violationId, undoneAt }), restored, "Undo must be deterministic with an explicit target and timestamp.");
          const repeated = undoActiveResetViolationState(restored, { violationId: input.violationId, undoneAt: "2026-09-08T12:00:00.000Z" });
          assert(repeated === restored && last(repeated.resetJourney.violations)?.status === "undone", "Second undo must be an exact no-op without overwriting original undoneAt.");
          assert(recordActiveResetViolationState(restored, input) === restored, "An undone source tombstone must block stale manual/session logging retries.");
          const differentIds = { ...input, violationId: "stale-retry-new-id", replacementAttemptId: "stale-retry-attempt", contentFreeViolationId: "stale-retry-content", occurredAt: "2026-09-08T12:00:00.000Z", recordedAt: "2026-09-08T12:01:00.000Z" };
          assert(recordActiveResetViolationState(restored, differentIds) === restored, "Changing supplied record IDs or timestamps must not reapply an already undone source.");
          const newBehavior = recordActiveResetViolationState(restored, { ...differentIds, source: sourceFor(kind, "genuinely-new-behavior") });
          assert(newBehavior !== restored, "A genuinely new behavior source must remain loggable after an undo.");
          const validation = validateAndNormalizeBloomState(restored);
          assert(validation.success, `Restored tombstones must satisfy practical history invariants: ${validation.success ? "" : validation.error}`);
          const client = new UndoTestStorage();
          await persistBloomLocalState(restored, client, now);
          const loaded = await loadBloomLocalState(client, now);
          assert(loaded.status === "success" && loaded.source === "current" && loaded.state.resetJourney.status === "active", "Undone v7 state must reload as active without automatic completion or further correction.");
          equal(loaded.state, restored, "Both undone tombstones and the restored original attempt/streak must survive a v7 round trip.");
          assert(recordActiveResetViolationState(loaded.state, input) === loaded.state, "Stale retry protection must survive persistence and reload.");
        }
      }
    }
  }
  const original = createActiveState(false, true);
  const input = createInput("intentionalExplicitContent");
  const logged = recordActiveResetViolationState(original, input);
  const lateUndo = undoActiveResetViolationState(logged, { violationId: input.violationId, undoneAt: "2026-10-01T12:00:00.000Z" });
  assert(lateUndo !== logged && lateUndo.resetJourney.status === "active", "Undo may correct an unambiguous mistake after the original and replacement periods have elapsed.");
  assert(getResetProgress(lateUndo.resetJourney, "2026-10-01T12:00:00.000Z")?.isPeriodComplete === true, "Late undo restores elapsed completion as a signal without auto-transitioning the lifecycle.");
  const straySnapshot = clone(logged);
  replaceAtPath(straySnapshot, "contentFree.violations.0.streakBefore.activationId", "must-not-overwrite-activation", false);
  const safeRestoration = undoActiveResetViolationState(straySnapshot, { violationId: input.violationId, undoneAt });
  assert(safeRestoration !== straySnapshot && safeRestoration.contentFree.status === "active" && original.contentFree.status === "active" && safeRestoration.contentFree.activationId === original.contentFree.activationId, "Snapshot restoration must copy only streak fields so tolerated extra properties cannot overwrite activation identity.");
}

async function verifySequentialUndo() {
  for (const kind of ["manual", "masturbationSession"] as const) {
    for (const contentActive of [false, true]) {
      const original = createActiveState(false, contentActive);
      original.contentFree.bestStreakSeconds = 0;
      const firstInput = timedInput("first", "masturbationWithExplicitContent", kind, "2026-09-03T12:00:00.000Z");
      const first = recordActiveResetViolationState(original, firstInput);
      const secondInput = timedInput("second", "intentionalExplicitContent", kind, "2026-09-06T12:00:00.000Z");
      const second = recordActiveResetViolationState(first, secondInput);
      assert(second !== first && second.resetJourney.status === "active", "Two effective restart fixtures required.");
      assert(undoActiveResetViolationState(second, { violationId: firstInput.violationId, undoneAt }) === second, "An older effective restart must not be undone before the later dependent restart.");
      const undoSecond = undoActiveResetViolationState(second, { violationId: secondInput.violationId, undoneAt });
      assert(undoSecond !== second && undoSecond.resetJourney.status === "active", "Undoing the latest restart must restore the intermediate attempt.");
      equal(undoSecond.resetJourney.currentAttempt, first.resetJourney.status === "active" ? first.resetJourney.currentAttempt : null, "Newest undo must restore Attempt B before earlier undo.");
      const undoFirst = undoActiveResetViolationState(undoSecond, { violationId: firstInput.violationId, undoneAt: "2026-09-07T12:03:00.000Z" });
      assert(undoFirst !== undoSecond && undoFirst.resetJourney.status === "active", "Sequential earlier undo must ignore later undone tombstones when proving the latest effective restart.");
      equal(undoFirst.resetJourney.currentAttempt, original.resetJourney.status === "active" ? original.resetJourney.currentAttempt : null, "Sequential undo must return to the original Attempt A.");
      equal(undoFirst.resetJourney.pastAttempts, original.resetJourney.pastAttempts, "Both false restarted attempts must be removed without leaving a fabricated restart history.");
      assert(undoFirst.resetJourney.bestCompletedDays === original.resetJourney.bestCompletedDays, "Sequential rollback must restore best progress before either mistaken restart.");
      assert(undoFirst.resetJourney.violations.length === 2 && undoFirst.resetJourney.violations.every((violation) => violation.status === "undone"), "Both Reset tombstones must remain, including one referring to an intermediate attempt no longer retained.");
      if (contentActive) {
        assert(undoFirst.contentFree.status === "active" && original.contentFree.status === "active", "Active Content-Free fixture required.");
        assert(undoFirst.contentFree.currentStreakStartedAt === original.contentFree.currentStreakStartedAt && undoFirst.contentFree.bestStreakSeconds === 0, "Sequential Content-Free undo must restore both original streak start and original best.");
        assert(undoFirst.contentFree.violations.length === 2 && undoFirst.contentFree.violations.every((violation) => violation.status === "undone"), "Both linked Content-Free tombstones must remain after sequential restoration.");
      }
      assert(validateAndNormalizeBloomState(undoFirst).success, "Sequential undone references must validate without requiring removed replacement attempts to persist.");
      for (const input of [firstInput, secondInput]) assert(recordActiveResetViolationState(undoFirst, input) === undoFirst, "Both sequentially undone sources must remain protected against stale retries.");
      const newInput = timedInput("new-after-undo", "masturbationWithExplicitContent", kind, "2026-09-08T12:00:00.000Z");
      assert(recordActiveResetViolationState(undoFirst, { ...newInput, replacementAttemptId: firstInput.replacementAttemptId }) === undoFirst, "New behavior must not reuse a removed intermediate attempt ID still owned by an undone violation tombstone.");
      assert(recordActiveResetViolationState(undoFirst, newInput) !== undoFirst, "A fresh source and fresh replacement identity must remain loggable after sequential undo.");
      const client = new UndoTestStorage();
      await persistBloomLocalState(undoFirst, client, now);
      const loaded = await loadBloomLocalState(client, now);
      assert(loaded.status === "success", "Sequential undone histories must be persistable.");
      equal(loaded.state, undoFirst, "Sequential tombstones with removed intermediate attempts must survive save/load unchanged.");
    }
  }
}

function verifyTruthfulBestRestoration() {
  for (const priorBest of [4, 6, 10] as const) {
    const state = createActiveState(false, false);
    state.resetJourney.bestCompletedDays = priorBest;
    const input = createInput("masturbation");
    const logged = recordActiveResetViolationState(state, input);
    const restored = undoActiveResetViolationState(logged, { violationId: input.violationId, undoneAt });
    assert(restored !== logged && restored.resetJourney.bestCompletedDays === priorBest, "Rollback metadata must preserve truthful prior summaries even when no historical attempt represents them.");
  }
  const highBest = createActiveState(false, false);
  highBest.resetJourney.bestCompletedDays = 10;
  const legacyHigh = withoutRollbackMetadata(recordActiveResetViolationState(highBest, createInput("masturbation")));
  const restoredHigh = undoActiveResetViolationState(legacyHigh, { violationId: "new-reset-violation", undoneAt });
  assert(restoredHigh !== legacyHigh && restoredHigh.resetJourney.bestCompletedDays === 10, "A metadata-free previous best is provable when current best exceeds the removed archive's six days.");
  const ambiguous = withoutRollbackMetadata(recordActiveResetViolationState(createActiveState(false, false), createInput("masturbation")));
  assert(undoActiveResetViolationState(ambiguous, { violationId: "new-reset-violation", undoneAt }) === ambiguous, "An ambiguous metadata-free tie must not guess between a prior best of zero and a prior unrepresented best of six.");
  const firstInput = timedInput("prior-history", "masturbation", "manual", "2026-09-04T12:00:00.000Z");
  const first = recordActiveResetViolationState(createActiveState(false, false), firstInput);
  const secondInput = timedInput("legacy-tie", "masturbation", "manual", "2026-09-07T12:00:00.000Z");
  const legacyTie = withoutRollbackMetadata(recordActiveResetViolationState(first, secondInput));
  const restoredTie = undoActiveResetViolationState(legacyTie, { violationId: secondInput.violationId, undoneAt });
  assert(restoredTie !== legacyTie && restoredTie.resetJourney.bestCompletedDays === 3, "A metadata-free best equal to both archived days and remaining historical maximum is provably restorable.");
}

function verifyInactiveContentFreeProof() {
  for (const reason of ["intentionalExplicitContent", "masturbationWithExplicitContent"] as const) {
    const input = createInput(reason);
    const logged = recordActiveResetViolationState(createActiveState(false, false), input);
    const laterActivation = {
      ...logged,
      contentFree: { status: "active" as const, activationId: "later-unrelated-activation", activatedAt: "2026-09-08T12:00:00.000Z", currentStreakStartedAt: "2026-09-08T12:00:00.000Z", bestStreakSeconds: 0, pastActivations: [], violations: [] }
    };
    const restored = undoActiveResetViolationState(laterActivation, { violationId: input.violationId, undoneAt: "2026-09-09T12:00:00.000Z" });
    assert(restored !== laterActivation && restored.contentFree === laterActivation.contentFree, "Case A must restore only Reset when activation history proves Content-Free was inactive at logging, even if a later unrelated activation is now active.");
    const ambiguousActive = clone(laterActivation);
    ambiguousActive.contentFree.activatedAt = "2026-09-07T12:00:30.000Z";
    assert(undoActiveResetViolationState(ambiguousActive, { violationId: input.violationId, undoneAt: "2026-09-09T12:00:00.000Z" }) === ambiguousActive, "Missing linkage is ambiguous when an activation already covered target recordedAt, even if it began after occurredAt.");
    const ambiguousPast = { ...logged, contentFree: { ...createDefaultBloomState().contentFree, pastActivations: [{ id: "program-at-recording", startedAt: "2026-09-07T11:00:00.000Z", endedAt: "2026-09-07T13:00:00.000Z" }] } };
    assert(undoActiveResetViolationState(ambiguousPast, { violationId: input.violationId, undoneAt }) === ambiguousPast, "A past activation covering recordedAt must prevent guessing that missing Content-Free linkage means inactivity.");
  }
}

function verifyUnsafeUndo() {
  let count = 0;
  const reject = (state: BloomLocalState, input: unknown, label: string) => {
    const before = JSON.stringify(state);
    assert(undoActiveResetViolationState(state, input as UndoInput) === state, `${label}: unsafe undo must return the original state.`);
    assert(JSON.stringify(state) === before, `${label}: rejected undo must not partially restore Reset or Content-Free.`);
    count++;
  };
  const input = createInput("masturbationWithExplicitContent");
  const logged = recordActiveResetViolationState(createActiveState(false, true), input);
  const undo = { violationId: input.violationId, undoneAt };
  for (const value of [null, [], "undo", {}, { violationId: input.violationId }, { undoneAt }, { ...undo, unexpected: true }]) reject(logged, value, "malformed undo input");
  for (const value of ["", " ", null, 17, "nonexistent-violation"]) reject(logged, { ...undo, violationId: value }, "invalid or nonexistent target identity");
  for (const value of ["2026-02-30T12:00:00.000Z", "2026-09-07", "2026-09-07T12:02:00+00:00", "2026-09-07T12:00:59.999Z", null, 17]) reject(logged, { ...undo, undoneAt: value }, "invalid or too-early undoneAt");
  const completed = createPopulatedState().resetJourney;
  assert(completed.status === "completed", "Completed Reset fixture required.");
  const { assessment: _assessment, ...finished } = completed;
  for (const reset of [createDefaultBloomState().resetJourney, { status: "recommended", id: "recommended", durationDays: 15, bestCompletedDays: 0, pastAttempts: [], violations: [] } as const, { status: "baseline_pending", id: "pending", durationDays: 15, bestCompletedDays: 0, pastAttempts: [], violations: [] } as const, { ...finished, status: "assessment_pending" } as const, completed]) {
    reject({ ...logged, resetJourney: reset as ResetJourney }, undo, `wrong lifecycle ${reset.status}`);
  }
  for (const [path, value, remove] of [
    ["resetJourney.pastAttempts", [], false], ["resetJourney.pastAttempts.0.restartViolationId", "missing", false],
    ["resetJourney.violations.0.attemptId", "unknown-attempt", false], ["resetJourney.currentAttempt.startedAt", "2026-09-07T12:00:30.000Z", false],
    ["resetJourney.violations.0.bestCompletedDaysBefore", 7, false], ["resetJourney.bestCompletedDays", 7, false],
    ["contentFree.currentStreakStartedAt", "2026-09-07T12:00:30.000Z", false],
    ["contentFree.bestStreakSeconds", 518401, false], ["contentFree.violations.0.recordedAt", "2026-09-07T12:01:01.000Z", false],
    ["contentFree.violations.0.occurredAt", "2026-09-07T11:59:59.000Z", false],
    ["contentFree.violations.0.streakBefore.currentStreakStartedAt", "2026-09-07T12:00:30.000Z", false],
    ["contentFree.violations.0.activationId", "missing-activation", false], ["contentFree.violations.0.source", { kind: "manual", logActionId: "different-event" }, false],
    ["contentFree.violations.0.streakBefore", undefined, true], ["contentFree.violations", [], false],
    ["resetJourney.violations.0.reason", "masturbation", false]
  ] as const) {
    const malformed = clone(logged);
    replaceAtPath(malformed, path, value, remove);
    reject(malformed, undo, `ambiguous or malformed relationship: ${path}`);
  }
  const alreadyUndoneContent = clone(logged);
  const linked = alreadyUndoneContent.contentFree.violations[0];
  assert(linked !== undefined, "Linked Content-Free fixture required.");
  alreadyUndoneContent.contentFree.violations[0] = { ...linked, status: "undone", undoneAt };
  reject(alreadyUndoneContent, undo, "linked Content-Free event already undone while Reset remains recorded");
  const changedActivation = clone(logged);
  assert(changedActivation.contentFree.status === "active", "Active Content-Free fixture required.");
  const previousContent = changedActivation.contentFree;
  changedActivation.contentFree = {
    ...previousContent,
    activationId: "new-activation", activatedAt: "2026-09-08T12:00:00.000Z", currentStreakStartedAt: "2026-09-08T12:00:00.000Z",
    pastActivations: [...previousContent.pastActivations, { id: previousContent.activationId, startedAt: previousContent.activatedAt, endedAt: "2026-09-07T13:00:00.000Z" }]
  };
  reject(changedActivation, { ...undo, undoneAt: "2026-09-09T12:00:00.000Z" }, "linked event belongs to a previous activation");
  const disabledContent = clone(changedActivation);
  assert(disabledContent.contentFree.status === "active", "Active Content-Free fixture required.");
  disabledContent.contentFree = { status: "inactive", bestStreakSeconds: previousContent.bestStreakSeconds, pastActivations: changedActivation.contentFree.pastActivations, violations: previousContent.violations };
  reject(disabledContent, undo, "linked Content-Free program is now inactive");
  for (const time of ["2026-09-07T12:00:00.000Z", "2026-09-07T12:01:30.000Z"]) {
    const laterContent = clone(logged);
    assert(laterContent.contentFree.status === "active", "Active Content-Free fixture required.");
    laterContent.contentFree.violations.push({
      id: "later-content-only-event", activationId: laterContent.contentFree.activationId, kind: "intentionalExplicitContent",
      occurredAt: time, recordedAt: "2026-09-07T12:01:45.000Z", source: { kind: "manual", logActionId: "later-content-only-source" }, status: "recorded",
      streakBefore: { currentStreakStartedAt: laterContent.contentFree.currentStreakStartedAt, bestStreakSeconds: laterContent.contentFree.bestStreakSeconds }
    });
    reject(laterContent, undo, "a later effective Content-Free record must block restoration even when current streak timestamp still matches target");
    if (time > "2026-09-07T12:00:00.000Z") {
      laterContent.contentFree.violations.reverse();
      reject(laterContent, undo, "a chronologically later Content-Free record must still block undo when array order places the target last");
    }
  }
  const duplicateContent = clone(logged);
  assert(linked !== undefined, "Linked Content-Free fixture required.");
  duplicateContent.contentFree.violations.push({ ...linked, id: "duplicate-link" });
  reject(duplicateContent, undo, "multiple Content-Free records share the target source");
  const laterReset = recordActiveResetViolationState(logged, timedInput("later-reset", "masturbationWithExplicitContent", "manual", "2026-09-08T12:00:00.000Z"));
  reject(laterReset, { ...undo, undoneAt: "2026-09-09T12:00:00.000Z" }, "later effective Reset restart still depends on the target");
  return count;
}

async function verifyV6Migration() {
  const recorded = recordActiveResetViolationState(createActiveState(true, true), createInput("masturbationWithExplicitContent"));
  const expected = asMigratedV6(recorded);
  const client = new UndoTestStorage();
  client.values.set(v6Key, envelope(6, asV6(recorded)));
  const migrated = await loadBloomLocalState(client, now);
  assert(migrated.status === "success" && migrated.source === "legacy" && !migrated.needsPersist, "Valid v6 Reset violations must migrate directly to durable v7.");
  equal(migrated.state, expected, "Migration must preserve every existing fact, add recorded status, and avoid invented undo or rollback metadata.");
  assert(migrated.state.resetJourney.violations.every((violation) => violation.status === "recorded" && !("undoneAt" in violation) && !("bestCompletedDaysBefore" in violation)), "Every legacy Reset violation must remain a recorded historical fact without guessed rollback metadata.");
  assert(migrated.state.resetJourney.status === "active", "Migration and loading must not automatically undo or complete Reset.");
  assert(!client.values.has(v6Key) && client.values.has(BLOOM_STATE_STORAGE_KEY), "Successful v6 migration must retain durable v7 and clean the source.");
  const reloaded = await loadBloomLocalState(client, now);
  assert(reloaded.status === "success" && reloaded.source === "current", "Migrated v7 must load as current without repeating migration.");
  equal(reloaded.state, expected, "Current validation must preserve all migrated recorded statuses without auto-undo.");
  const ambiguousRecorded = recordActiveResetViolationState(createActiveState(false, false), createInput("masturbation"));
  const ambiguousClient = new UndoTestStorage();
  ambiguousClient.values.set(v6Key, envelope(6, asV6(ambiguousRecorded)));
  const ambiguous = await loadBloomLocalState(ambiguousClient, now);
  assert(ambiguous.status === "success", "Legacy fixture must migrate successfully even when exact undo is unknowable.");
  assert(undoActiveResetViolationState(ambiguous.state, { violationId: "new-reset-violation", undoneAt }) === ambiguous.state, "Migration must not guess missing best rollback metadata to make ambiguous older events undoable.");
}

async function verifyMigrationDurability() {
  const recorded = recordActiveResetViolationState(createActiveState(true, true), createInput("intentionalExplicitContent"));
  const raw = envelope(6, asV6(recorded));
  const expected = asMigratedV6(recorded);
  const failedClient = new UndoTestStorage();
  failedClient.values.set(v6Key, raw);
  failedClient.failCurrentWrite = true;
  const failed = await loadBloomLocalState(failedClient, now);
  assert(failed.status === "success" && failed.source === "legacy" && failed.needsPersist && failed.persistenceError !== null, "Failed v7 write must retain usable legacy facts with an unacknowledged migration warning.");
  equal(failed.state, expected, "Failed migration must preserve original histories and linked Content-Free snapshots.");
  assert(failedClient.values.get(v6Key) === raw && !failedClient.values.has(BLOOM_STATE_STORAGE_KEY) && !failedClient.operations.includes(`remove:${v6Key}`), "Failed v7 persistence must preserve v6 bytes and never attempt source cleanup.");
  failedClient.failCurrentWrite = false;
  const retried = await loadBloomLocalState(failedClient, now);
  assert(retried.status === "success" && !retried.needsPersist && !failedClient.values.has(v6Key), "Retry must durably migrate before cleaning the retained v6 source.");
  const heldClient = new UndoTestStorage();
  heldClient.values.set(v6Key, raw);
  const held = heldClient.holdNextCurrentWrite();
  let settled = false;
  const loading = loadBloomLocalState(heldClient, now).then((result) => { settled = true; return result; });
  await held.started;
  assert(!settled && heldClient.values.get(v6Key) === raw && !heldClient.values.has(BLOOM_STATE_STORAGE_KEY), "Pending v7 write must keep migration unresolved and v6 intact.");
  assert(!heldClient.operations.includes(`remove:${v6Key}`), "Source cleanup must wait for durable v7 acknowledgement.");
  held.release();
  await loading;
  assert(heldClient.operations.indexOf(`remove:${v6Key}`) > heldClient.operations.indexOf(`durable:${BLOOM_STATE_STORAGE_KEY}`), "Successful migration must remove its source strictly after durable v7.");
  const cleanupClient = new UndoTestStorage();
  cleanupClient.values.set(v6Key, raw);
  cleanupClient.failRemovalKey = v6Key;
  const cleanup = await loadBloomLocalState(cleanupClient, now);
  assert(cleanup.status === "success" && !cleanup.needsPersist && cleanupClient.values.get(v6Key) === raw && cleanupClient.values.has(BLOOM_STATE_STORAGE_KEY), "Cleanup failure must preserve durable v7 plus the original fallback source.");
  const reloaded = await loadBloomLocalState(cleanupClient, now);
  assert(reloaded.status === "success" && reloaded.source === "current", "A leftover v6 key after cleanup failure must not override durable v7.");
}

async function verifyMalformedUndoFacts() {
  const logged = recordActiveResetViolationState(createActiveState(false, true), createInput("masturbationWithExplicitContent"));
  const restored = undoActiveResetViolationState(logged, { violationId: "new-reset-violation", undoneAt });
  const cases: Array<[string, BloomLocalState, string, unknown, boolean?]> = [
    ["missing recorded status", logged, "resetJourney.violations.0.status", undefined, true],
    ["unknown status", logged, "resetJourney.violations.0.status", "deleted"],
    ["recorded carrying undoneAt", logged, "resetJourney.violations.0.undoneAt", undoneAt],
    ["missing undoneAt", restored, "resetJourney.violations.0.undoneAt", undefined, true],
    ["invalid undoneAt", restored, "resetJourney.violations.0.undoneAt", "2026-02-30T12:00:00.000Z"],
    ["noncanonical undoneAt", restored, "resetJourney.violations.0.undoneAt", "2026-09-07T12:02:00+00:00"],
    ["date-only undoneAt", restored, "resetJourney.violations.0.undoneAt", "2026-09-07"],
    ["numeric undoneAt", restored, "resetJourney.violations.0.undoneAt", 17],
    ["undo before recording", restored, "resetJourney.violations.0.undoneAt", "2026-09-07T12:00:59.999Z"],
    ["undone still referenced by effective restart", logged, "resetJourney.violations.0", { ...logged.resetJourney.violations[0], status: "undone", undoneAt }],
    ["recorded reference to nonexistent attempt", logged, "resetJourney.violations.0.attemptId", "removed-attempt"],
    ["restored active counter forbidden", restored, "resetJourney.currentAttempt.completedDays", 6],
    ["negative rollback best", logged, "resetJourney.violations.0.bestCompletedDaysBefore", -1],
    ["rollback best beyond duration", logged, "resetJourney.violations.0.bestCompletedDaysBefore", 16],
    ["fractional rollback best", logged, "resetJourney.violations.0.bestCompletedDaysBefore", 1.5],
    ["string rollback best", logged, "resetJourney.violations.0.bestCompletedDaysBefore", "6"],
    ["null rollback best", logged, "resetJourney.violations.0.bestCompletedDaysBefore", null],
    ["malformed undone source", restored, "resetJourney.violations.0.source", { kind: "manual", sessionId: "wrong-source-field" }],
    ["linked Content-Free undo before recording", restored, "contentFree.violations.0.undoneAt", "2026-09-07T12:00:59.999Z"]
  ];
  for (const [label, base, path, value, remove] of cases) {
    const malformed = clone(base);
    replaceAtPath(malformed, path, value, remove === true);
    await assertCorruptPreserved(malformed, label);
  }
  const duplicateTombstone = clone(restored);
  const target = duplicateTombstone.resetJourney.violations[0];
  assert(target !== undefined, "Undone tombstone fixture required.");
  duplicateTombstone.resetJourney.violations.push({ ...target, id: "different-id-same-undone-source" });
  await assertCorruptPreserved(duplicateTombstone, "source uniqueness must include undone tombstones");
  return cases.length + 1;
}

async function verifyDeletionAndFuturePreservation() {
  const client = new UndoTestStorage();
  for (const key of [BLOOM_STATE_STORAGE_KEY, ...historicalKeys, `${BLOOM_CORRUPT_BACKUP_PREFIX}old`, `${BLOOM_CORRUPT_BACKUP_PREFIX}current`]) client.values.set(key, "remove");
  client.values.set("unrelated", "retain");
  await createBloomStatePersistenceCoordinator(client, now).deleteAll();
  equal([...client.values.entries()], [["unrelated", "retain"]], "Delete-all must remove v1–v7 and every Bloom corrupt backup while retaining unrelated storage.");
  assert(client.operations[client.operations.length - 1] === `remove:${BLOOM_STATE_STORAGE_KEY}`, "Delete-all must preserve current-key-last lifecycle ordering.");
  for (const key of [BLOOM_STATE_STORAGE_KEY, ...historicalKeys]) {
    const futureClient = new UndoTestStorage();
    const raw = envelope(99, { resetJourney: "future history" });
    futureClient.values.set(key, raw);
    const future = await loadBloomLocalState(futureClient, now);
    assert(future.status === "unsupported-version" && future.version === 99 && future.sourceKey === key, "Unsupported future versions must remain unsupported at every known key.");
    assert(futureClient.values.get(key) === raw, "Future payloads must remain byte-exact at their source key.");
    assertBackup(futureClient, future.backupKey, raw, key);
  }
}

function timedInput(id: string, reason: ResetViolation["reason"], kind: BehaviorEventSource["kind"], time: string): RecordInput {
  return { ...createInput(reason, sourceFor(kind, `${id}-source`)), violationId: `${id}-violation`, replacementAttemptId: `${id}-replacement`, contentFreeViolationId: `${id}-content`, occurredAt: time, recordedAt: time };
}

function sourceFor(kind: BehaviorEventSource["kind"], id: string): BehaviorEventSource { return kind === "manual" ? { kind, logActionId: id } : { kind, sessionId: id }; }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function last<T>(values: readonly T[]): T | undefined { return values[values.length - 1]; }
function envelope(version: number, state: unknown) { return JSON.stringify({ version, savedAt: now().toISOString(), state }); }

function withoutRollbackMetadata(state: BloomLocalState): BloomLocalState {
  const result = clone(state);
  const target = last(result.resetJourney.violations);
  assert(target !== undefined, "Violation fixture required.");
  delete target.bestCompletedDaysBefore;
  return result;
}

function asV6(state: BloomLocalState) {
  const result = clone(state) as unknown as { resetJourney: { violations: Array<Record<string, unknown>> } };
  for (const violation of result.resetJourney.violations) {
    delete violation.status;
    delete violation.undoneAt;
    delete violation.bestCompletedDaysBefore;
  }
  return result;
}

function asMigratedV6(state: BloomLocalState): BloomLocalState {
  const result = clone(state);
  result.resetJourney.violations = result.resetJourney.violations.map((violation) => {
    const { bestCompletedDaysBefore: _best, ...record } = violation;
    assert(record.status === "recorded", "Only genuinely recorded v6 fixtures may be migrated.");
    return record;
  });
  return result;
}

function replaceAtPath(root: unknown, path: string, value: unknown, remove: boolean) {
  const keys = path.split(".");
  const final = keys.pop();
  assert(final !== undefined, "Fixture mutation requires a final field.");
  let parent = root as Record<string, unknown>;
  for (const key of keys) parent = parent[key] as Record<string, unknown>;
  if (remove) delete parent[final];
  else parent[final] = value;
}

async function assertCorruptPreserved(state: BloomLocalState, label: string) {
  assert(!validateAndNormalizeBloomState(state).success, `${label}: contradictory undo history must fail direct validation instead of being repaired.`);
  const raw = envelope(7, state);
  const client = new UndoTestStorage();
  client.values.set(BLOOM_STATE_STORAGE_KEY, raw);
  const result = await loadBloomLocalState(client, now);
  assert(result.status === "corrupt" && result.sourceKey === BLOOM_STATE_STORAGE_KEY, `${label}: malformed undo history must follow the existing corruption strategy.`);
  assert(client.values.get(BLOOM_STATE_STORAGE_KEY) === raw, `${label}: original malformed source bytes must remain untouched.`);
  assertBackup(client, result.backupKey, raw, BLOOM_STATE_STORAGE_KEY);
}

function assertBackup(client: UndoTestStorage, key: string | null, raw: string, sourceKey: string) {
  assert(key !== null && key.startsWith(BLOOM_CORRUPT_BACKUP_PREFIX), "Corrupt/future facts must receive a scoped backup.");
  const backup = client.values.get(key);
  assert(backup !== undefined, "Backup must become durable.");
  const parsed = JSON.parse(backup) as { rawPayload?: unknown; sourceKey?: unknown };
  assert(parsed.rawPayload === raw && parsed.sourceKey === sourceKey, "Backups must retain exact source bytes and source-key ownership.");
}

function equal(actual: unknown, expected: unknown, message: string) { assert(isDeepStrictEqual(actual, expected), message); }
function assert(condition: boolean, message: string): asserts condition { if (!condition) throw new Error(message); }

class UndoTestStorage implements StorageClient {
  readonly values = new Map<string, string>();
  readonly operations: string[] = [];
  failCurrentWrite = false;
  failRemovalKey: string | null = null;
  private heldWrite: { started: () => void; wait: Promise<void> } | null = null;

  holdNextCurrentWrite() {
    let started!: () => void;
    let release!: () => void;
    const began = new Promise<void>((resolve) => { started = resolve; });
    const wait = new Promise<void>((resolve) => { release = resolve; });
    this.heldWrite = { started, wait };
    return { started: began, release };
  }

  async getItem(key: string) { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string) {
    this.operations.push(`write:${key}`);
    if (key === BLOOM_STATE_STORAGE_KEY) {
      const held = this.heldWrite;
      this.heldWrite = null;
      if (held !== null) { held.started(); await held.wait; }
      if (this.failCurrentWrite) throw new Error("Synthetic v7 migration write failure.");
    }
    this.values.set(key, value);
    this.operations.push(`durable:${key}`);
  }
  async removeItem(key: string) {
    this.operations.push(`remove:${key}`);
    if (key === this.failRemovalKey) throw new Error("Synthetic source cleanup failure.");
    this.values.delete(key);
  }
  async getAllKeys() { return [...this.values.keys()]; }
}
