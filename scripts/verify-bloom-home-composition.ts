import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";

import { getBloomHomeReadModel } from "../src/domain/home/getBloomHomeReadModel";
import { getContentFreeProgress } from "../src/domain/contentFree/getContentFreeProgress";
import { getMasturbationTrackingAvailability } from "../src/domain/productPolicy/getMasturbationTrackingAvailability";
import { getUrgeControlProgress } from "../src/domain/urgeControl/getUrgeControlProgress";
import { createDefaultBloomState, type BloomLocalState } from "../src/storage/bloomState";
import { BLOOM_STATE_STORAGE_KEY, loadBloomLocalState, persistBloomLocalState } from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION } from "../src/storage/bloomStateSchema";
import { createMemoryStorageClient } from "../src/storage/storageAdapters";
import { createActiveState } from "./verify-bloom-reset-violations";

const at = "2026-09-07T12:05:00.000Z";
const legacyKeys = ["activePlan", "onboarding", "tenDayReset", "debug", "protection", "checkIns", "pause", "arousalControl"] as const;
type HomeInput = Parameters<typeof getBloomHomeReadModel>[0];

export async function verifyBloomHomeComposition() {
  for (const enabled of [false, true]) {
    for (const contentActive of [false, true]) {
      const state = trackerState(enabled, contentActive);
      const before = JSON.stringify(state);
      const home = getBloomHomeReadModel(state, at);
      assert(home !== null, "Valid tracker combinations must compose a Home read model.");
      assert(home.primaryTracker?.kind === (enabled ? "masturbationTracking" : contentActive ? "contentFree" : undefined),
        "Tracking is primary when enabled; otherwise active Content-Free is primary.");
      assert(home.secondaryTracker?.kind === (enabled && contentActive ? "contentFree" : undefined),
        "Only enabled Tracking plus active Content-Free produces a secondary tracker.");
      if (!enabled && !contentActive) assert(home.primaryTracker === null && home.secondaryTracker === null, "Unavailable trackers must be explicit null values.");
      assert(home.primaryAction?.id === (enabled ? "startMasturbationSession" : contentActive ? "viewContentFree" : undefined),
        "With no higher-priority work, the semantic action follows the available primary tracker.");
      if (!enabled && !contentActive) assert(home.primaryAction === null, "Empty product onboarding must not invent onboarding or motivational work.");
      equal(home.trackingAvailability, getMasturbationTrackingAvailability(state, at), "Home must expose the existing Phase 1N availability result unchanged.");
      assert(home.urgeControlAvailable === true && home.urgeControlProgress === null,
        "Urge Control is available as optional support without becoming a default action or fabricated active progress.");
      if (home.primaryTracker?.kind === "masturbationTracking") {
        equal(home.primaryTracker.availability, home.trackingAvailability, "Tracking summaries must compose, not reinterpret, product policy.");
        assert(home.primaryTracker.completedSessionCount === 1, "Tracking summary counts only completed session history.");
      }
      const contentTracker = home.primaryTracker?.kind === "contentFree" ? home.primaryTracker : home.secondaryTracker;
      if (contentActive) {
        assert(contentTracker?.kind === "contentFree", "An active Content-Free tracker must be represented in exactly one role.");
        equal(contentTracker.progress, getContentFreeProgress(state.contentFree, at), "Content-Free facts must match the existing elapsed streak selector.");
      }
      assert(JSON.stringify(state) === before, "Composing tracker roles must not mutate any input facts.");
      await verifyRoundTrip(state);
    }
  }
  verifySupportDuringReset();
  verifySafeInvalidResults();
  verifyPurityAndLegacyIsolation();
  verifyDomainImports();
  console.log("Bloom Home composition verification passed (four tracker combinations, selector equivalence, invalid-input safety, frozen/legacy-isolated reads, and v7 round trips).");
}

function verifySupportDuringReset() {
  for (const enabled of [false, true]) {
    const state = createActiveState(false, true);
    state.masturbationTracking.enabled = enabled;
    state.urgeControl = { ...state.urgeControl, activeEvent: null };
    const home = getBloomHomeReadModel(state, at);
    assert(home?.primaryAction?.id === "viewActiveReset", "Reset can have action priority while tracker facts remain represented.");
    const tracker = enabled ? home.secondaryTracker : home.primaryTracker;
    assert(tracker?.kind === "contentFree", "Active Content-Free must remain represented during Reset regardless of Tracking's enabled flag.");
    equal(tracker.progress, getContentFreeProgress(state.contentFree, at), "Reset must not reinterpret or hide independent Content-Free progress.");
    equal(home.trackingAvailability, getMasturbationTrackingAvailability(state, at), "Reset Home must preserve the canonical availability block reason.");
    assert(home.trackingAvailability.blockReason === (enabled ? "resetRestriction" : "trackingDisabled"),
      "Tracker permission and behavioral restriction remain separate facts under a Reset action.");
  }
  const urge = trackerState(true, true);
  urge.urgeControl.activeEvent = {
    id: "home-active-urge", status: "active", startedAt: "2026-09-07T12:02:00.000Z",
    interruptCompletedAt: "2026-09-07T12:02:15.000Z", selectedTechnique: "grounding54321",
    phoneAwayStartedAt: "2026-09-07T12:03:00.000Z"
  };
  const home = getBloomHomeReadModel(urge, at);
  assert(home?.primaryAction?.id === "resumeUrgeControl" && home.primaryTracker?.kind === "masturbationTracking" &&
    home.secondaryTracker?.kind === "contentFree", "An unfinished support flow changes action priority without erasing tracker roles.");
  equal(home.urgeControlProgress, getUrgeControlProgress(urge.urgeControl, at), "Home must reuse Urge Control resume timing/stage facts.");
}

function verifySafeInvalidResults() {
  const state = trackerState(true, true);
  for (const invalid of ["", "invalid", "2026-09-07T12:05:00Z", "2026-02-30T12:05:00.000Z", undefined, null, 7]) {
    assert(getBloomHomeReadModel(state, invalid as never) === null, "A noncanonical clock must not produce a guessed Home action.");
  }
  const invalidContent = trackerState(true, true);
  assert(invalidContent.contentFree.status === "active", "Active Content-Free fixture required.");
  invalidContent.contentFree.currentStreakStartedAt = "invalid";
  assert(getBloomHomeReadModel(invalidContent, at) === null, "An invalid required Content-Free selector result invalidates the complete composition.");
  const invalidUrge = trackerState(true, false);
  invalidUrge.urgeControl.activeEvent = { id: "invalid-progress", status: "active", startedAt: "invalid" };
  assert(getBloomHomeReadModel(invalidUrge, at) === null, "An existing urge event with unknown timing must not become a guessed resume action.");
  const missingAttempt = createActiveState(false, true);
  (missingAttempt.resetJourney as unknown as Record<string, unknown>).currentAttempt = undefined;
  assert(getBloomHomeReadModel(missingAttempt, at) === null, "An active Reset with indeterminate progress must not accidentally grant a tracker action.");
}

function verifyPurityAndLegacyIsolation() {
  const full = trackerState(true, true);
  const input = productOnly(full);
  const expected = getBloomHomeReadModel(input, at);
  assert(expected !== null, "Only the five new product slices are sufficient input.");
  equal(getBloomHomeReadModel(full, at), expected, "Legacy fields must not influence Home composition.");
  const changedLegacy = { ...full };
  for (const key of legacyKeys) (changedLegacy as unknown as Record<string, unknown>)[key] = "unrelated legacy state changed";
  equal(getBloomHomeReadModel(changedLegacy, at), expected, "Changing every legacy feature must leave the new Home result identical.");
  const poisoned = productOnly(full);
  for (const key of legacyKeys) {
    Object.defineProperty(poisoned, key, { enumerable: true, get() { throw new Error(`Home read forbidden legacy field ${key}`); } });
  }
  equal(getBloomHomeReadModel(poisoned, at), expected, "Home must not read or spread legacy properties even when they are present.");
  const frozen = deepFreeze(productOnly(full));
  const bytes = JSON.stringify(frozen);
  equal(getBloomHomeReadModel(frozen, at), expected, "Deeply frozen product state must support pure Home reads.");
  equal(getBloomHomeReadModel(frozen, at), expected, "Repeated calls at the same explicit time must be deterministic.");
  assert(JSON.stringify(frozen) === bytes, "The read model must never persist its priorities or computed progress into state.");
}

function verifyDomainImports() {
  const source = readFileSync(resolve("src/domain/home/getBloomHomeReadModel.ts"), "utf8");
  const imports = Array.from(source.matchAll(/(?:import|export)\s+[\s\S]*?\sfrom\s+["']([^"']+)["']/g), (match) => match[1]!);
  assert(imports.every((specifier) => !/(?:react|expo|navigation|\/journey\/|\/storage\/|async-storage)/i.test(specifier)),
    "The new Home domain module must not import React, routes, storage, or legacy journey logic.");
  assert(!/Date\.now\s*\(|Math\.random\s*\(|randomUUID\s*\(|new\s+Date\s*\(\s*\)/.test(source),
    "Home must not generate timestamps or identities internally.");
  assert(!/["']\/(?:reset|session|onboarding|tabs|today)(?:\/|["'])/.test(source), "Domain actions must remain semantic IDs without router paths.");
}

function trackerState(enabled: boolean, contentActive: boolean): BloomLocalState {
  const state = createDefaultBloomState();
  state.masturbationTracking = { enabled, currentSession: null, sessions: [{
    id: "home-completed-session", status: "completed", startedAt: "2026-08-01T10:00:00.000Z",
    endedAt: "2026-08-01T10:05:00.000Z", durationSeconds: 300, pauses: [],
    erectionQuality: 6, usedExplicitContent: false, endingReason: "climaxed"
  }] };
  if (contentActive) state.contentFree = {
    status: "active", activationId: "home-content-activation", activatedAt: "2026-09-01T12:00:00.000Z",
    currentStreakStartedAt: "2026-09-01T12:00:00.000Z", bestStreakSeconds: 3600, pastActivations: [], violations: []
  };
  return state;
}

function productOnly(state: BloomLocalState): HomeInput {
  return {
    productOnboarding: state.productOnboarding, masturbationTracking: state.masturbationTracking,
    contentFree: state.contentFree, resetJourney: state.resetJourney, urgeControl: state.urgeControl
  };
}

async function verifyRoundTrip(state: BloomLocalState) {
  assert(BLOOM_PERSISTENCE_VERSION === 7 && BLOOM_STATE_STORAGE_KEY === "bloom.localState.v7", "Derived Home facts must retain the existing persistence schema and key.");
  const before = getBloomHomeReadModel(state, at);
  const storage = createMemoryStorageClient();
  await persistBloomLocalState(state, storage, () => new Date(at));
  const raw = await storage.getItem(BLOOM_STATE_STORAGE_KEY);
  assert(raw !== null, "A v7 fixture must be saved.");
  equal(JSON.parse(raw).state, state, "No Home priority, role, or derived progress may enter the persisted state.");
  const loaded = await loadBloomLocalState(storage, () => new Date(at));
  assert(loaded.status === "success" && loaded.source === "current", "Home inputs must survive the existing v7 load path.");
  equal(getBloomHomeReadModel(loaded.state, at), before, "The same facts and explicit clock must produce the same Home result after reload.");
}

function deepFreeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
function equal(actual: unknown, expected: unknown, message: string) { assert(isDeepStrictEqual(actual, expected), message); }
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
