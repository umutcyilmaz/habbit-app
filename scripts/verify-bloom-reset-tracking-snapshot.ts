import { isDeepStrictEqual } from "node:util";

import type { ErectionQuality } from "../src/domain/models/MasturbationSession";
import type {
  CompletedMasturbationSession,
  MasturbationTrackingState
} from "../src/domain/models/MasturbationTrackingState";
import { getResetTrackingSnapshot } from "../src/domain/reset/getResetTrackingSnapshot";

const capturedAt = "2026-10-02T12:00:00.000Z";

export function verifyBloomResetTrackingSnapshot() {
  verifyObservationCounts();
  verifyCaptureCutoff();
  verifyCurrentSessionExclusion();
  verifyHistoricalPreferenceAndImmutability();
  verifyInvalidCaptureTimes();
  console.log("Bloom Reset Tracking snapshot verification passed (eligible completed history, inclusive capture cutoff, exact descriptive means, chronological intervals, missing versus zero, disabled Tracking, immutable inputs, and canonical timestamps).");
}

function verifyObservationCounts() {
  const empty = getResetTrackingSnapshot(tracking([]), capturedAt);
  equal(empty, {}, "No completed history must omit every aggregate rather than store zero or undefined fields.");
  assert(empty !== null && empty.averageIntervalSeconds === undefined && empty.averageErectionQuality === undefined && empty.explicitContentSessionRatio === undefined,
    "Unavailable observations must remain undefined when read.");

  const first = completed("first", "2026-10-01T08:00:00.000Z", "2026-10-01T08:05:00.000Z", 4, false);
  equal(getResetTrackingSnapshot(tracking([first]), capturedAt), {
    averageErectionQuality: 4,
    explicitContentSessionRatio: 0
  }, "One completed session supplies its erection quality and actual zero explicit-content ratio, without an interval.");
  equal(getResetTrackingSnapshot(tracking([{ ...first, usedExplicitContent: true }]), capturedAt), {
    averageErectionQuality: 4,
    explicitContentSessionRatio: 1
  }, "One explicit-content session supplies ratio one.");

  const second = completed("second", "2026-10-01T10:00:00.125Z", "2026-10-01T10:01:00.000Z", 7, true);
  equal(getResetTrackingSnapshot(tracking([second, first]), capturedAt), {
    averageIntervalSeconds: 7200.125,
    averageErectionQuality: 5.5,
    explicitContentSessionRatio: 0.5
  }, "Two sessions use their chronological start-to-start interval, preserving milliseconds rather than session durations or end-to-start gaps.");

  const third = completed("third", "2026-10-01T15:00:00.003Z", "2026-10-01T15:30:00.000Z", 8, false);
  const expected = {
    averageIntervalSeconds: 12600.0015,
    averageErectionQuality: 19 / 3,
    explicitContentSessionRatio: 1 / 3
  };
  for (const sessions of [[first, second, third], [third, first, second], [second, third, first]]) {
    equal(getResetTrackingSnapshot(tracking(sessions), capturedAt), expected,
      "Every eligible observation contributes to arithmetic means; source ordering must not alter chronological intervals or round stored precision.");
  }
}

function verifyCaptureCutoff() {
  const atCutoff = completed("at-cutoff", "2026-10-02T11:00:00.000Z", capturedAt, 3, false);
  const future = completed("future", "2026-10-02T11:30:00.000Z", "2026-10-02T12:00:00.001Z", 10, true);
  equal(getResetTrackingSnapshot(tracking([future, atCutoff]), capturedAt), {
    averageErectionQuality: 3,
    explicitContentSessionRatio: 0
  }, "A session ending exactly at capture is eligible; a session ending one millisecond later is excluded even if it started before capture.");
  equal(getResetTrackingSnapshot(tracking([future]), capturedAt), {},
    "History with no eligible sessions must omit all aggregates, including explicit ratio.");
  const old = completed("old", "2020-01-01T10:00:00.000Z", "2020-01-01T10:05:00.000Z", 7, true);
  const snapshot = getResetTrackingSnapshot(tracking([atCutoff, old]), capturedAt);
  equal(snapshot, {
    averageIntervalSeconds: (Date.parse(atCutoff.startedAt) - Date.parse(old.startedAt)) / 1000,
    averageErectionQuality: 5,
    explicitContentSessionRatio: 0.5
  }, "All eligible historical sessions contribute without a recent-window limit.");
}

function verifyCurrentSessionExclusion() {
  const history = completed("history", "2026-10-01T10:00:00.000Z", "2026-10-01T10:03:00.000Z", 2, false);
  const awaitingFeedback: MasturbationTrackingState["currentSession"] = {
    id: "awaiting", status: "awaiting_feedback", startedAt: "2026-10-02T10:00:00.000Z",
    endedAt: "2026-10-02T10:05:00.000Z", durationSeconds: 300, pauses: [],
    erectionQuality: 10, usedExplicitContent: true, endingReason: "climaxed"
  };
  const currentSessions: MasturbationTrackingState["currentSession"][] = [
    { id: "active", status: "active", startedAt: "2026-10-02T11:00:00.000Z", pauses: [] },
    awaitingFeedback
  ];
  for (const currentSession of currentSessions) {
    equal(getResetTrackingSnapshot({ ...tracking([]), currentSession }, capturedAt), {},
      "An unfinished current session must never create baseline observations, even when awaiting feedback already contains every answer.");
    equal(getResetTrackingSnapshot({ ...tracking([history]), currentSession }, capturedAt), {
      averageErectionQuality: 2,
      explicitContentSessionRatio: 0
    }, "An active or awaiting-feedback current session must not affect completed historical observations.");
  }
  const malformedHistory = tracking([history]);
  (malformedHistory.sessions as unknown[]).push(awaitingFeedback);
  equal(getResetTrackingSnapshot(malformedHistory, capturedAt), {
    averageErectionQuality: 2,
    explicitContentSessionRatio: 0
  }, "The eligibility condition must require completed status, even if an unfinished record appears in history at runtime.");
}

function verifyHistoricalPreferenceAndImmutability() {
  const sessions = [
    completed("later", "2026-10-02T10:00:00.100Z", "2026-10-02T10:04:00.000Z", 7, true),
    completed("earlier", "2026-10-01T10:00:00.000Z", "2026-10-01T10:03:00.000Z", 4, false)
  ];
  const enabled = tracking(sessions);
  const disabled = { ...enabled, enabled: false };
  const before = JSON.stringify(disabled);
  deepFreeze(disabled);
  const snapshot = getResetTrackingSnapshot(disabled, capturedAt);
  equal(snapshot, getResetTrackingSnapshot(enabled, capturedAt),
    "Disabling Tracking must not erase completed history or change its descriptive snapshot.");
  equal(snapshot, getResetTrackingSnapshot(disabled, capturedAt),
    "Repeated calls with explicit facts must produce the same snapshot.");
  assert(JSON.stringify(disabled) === before && disabled.sessions === sessions && disabled.sessions[0]?.id === "later",
    "The selector must accept frozen input and preserve original session order, records, and Tracking state.");
}

function verifyInvalidCaptureTimes() {
  const state = tracking([completed("history", "2026-10-01T10:00:00.000Z", "2026-10-01T10:03:00.000Z", 5, false)]);
  for (const invalid of [
    "", "not-a-date", "2026-10-02", "2026-02-30T12:00:00.000Z", "2026-10-02T12:00:00Z",
    "2026-10-02T12:00:00.000+00:00", "2026-10-02T12:00:00.00Z", null, undefined, 123
  ]) {
    assert(getResetTrackingSnapshot(state, invalid as string) === null,
      "Invalid, impossible, noncanonical, or missing capture timestamps must return null using the existing selector convention.");
  }
}

function tracking(sessions: CompletedMasturbationSession[]): MasturbationTrackingState {
  return { enabled: true, currentSession: null, sessions };
}

function completed(
  id: string, startedAt: string, endedAt: string, erectionQuality: ErectionQuality, usedExplicitContent: boolean
): CompletedMasturbationSession {
  return {
    id, status: "completed", startedAt, endedAt,
    durationSeconds: (Date.parse(endedAt) - Date.parse(startedAt)) / 1000,
    pauses: [], erectionQuality, usedExplicitContent, endingReason: "climaxed"
  };
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  for (const child of Object.values(value)) deepFreeze(child);
  Object.freeze(value);
}

function equal(actual: unknown, expected: unknown, message: string): void {
  assert(isDeepStrictEqual(actual, expected), message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
