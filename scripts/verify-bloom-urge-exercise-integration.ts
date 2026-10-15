import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

import { getUrgeControlRouteView } from "../src/features/urge-control/urgeControlView";
import { createUrgeExerciseTimer } from "../src/features/urge-control/exercise/urgeExerciseTimer";
import { createDefaultBloomState } from "../src/storage/bloomState";
import { verifyBloomUrgeControlFeature, verifyBloomUrgeNavigationGuards } from "./verify-bloom-urge-control-feature";

const at = "2026-11-01T12:00:00.000Z";

async function main() {
  await verifyBloomUrgeControlFeature();
  await verifyBloomUrgeNavigationGuards();
  verifyEphemeralExerciseLifecycle();
  verifyProductionRoutingBoundary();
  verifyIntegrationSources();
  console.log("Bloom Phase 11.8.2B Urge exercise integration verification passed (direct current interrupt adapter, explicit ephemeral timer, durable outcome gate, retry-safe exit, legacy/identity isolation, and unchanged Panic ownership).");
}

function verifyEphemeralExerciseLifecycle() {
  let now = 0;
  const timer = createUrgeExerciseTimer(() => now);
  timer.activate();
  equal(timer.getSnapshot(), {
    phase: "ready", durationMs: 600_000, elapsedMs: 0, foreground: true, confirmingExit: false, pauseReason: null
  }, "A production exercise must open stopped at the default ten minutes.");
  for (const minutes of [5, 10, 15, 20]) {
    timer.select(minutes);
    assert(timer.getSnapshot().durationMs === minutes * 60_000, "Only the approved duration presets may update the ready timer.");
  }
  timer.start();
  now = 1_000;
  timer.tick();
  assert(timer.getSnapshot().phase === "running" && timer.getSnapshot().elapsedMs === 1_000,
    "Elapsed exercise time must begin only after explicit Start.");
  timer.setForeground(false);
  now = 61_000;
  timer.tick();
  assert(timer.getSnapshot().phase === "paused" && timer.getSnapshot().elapsedMs === 1_000,
    "Background time must not advance the exercise.");
  timer.setForeground(true);
  assert(timer.getSnapshot().phase === "paused", "Foreground return must require explicit Resume.");
  timer.resume();
  now += timer.getSnapshot().durationMs;
  timer.tick();
  assert(timer.getSnapshot().phase === "completed", "Timer expiry may change only the ephemeral timer phase.");
  timer.dispose();
  const reopened = createUrgeExerciseTimer(() => now);
  reopened.activate();
  assert(reopened.getSnapshot().phase === "ready" && reopened.getSnapshot().durationMs === 600_000 && reopened.getSnapshot().elapsedMs === 0,
    "Reopening an interrupt must create a fresh stopped ten-minute timer.");
  reopened.dispose();
}

function verifyProductionRoutingBoundary() {
  const state = createDefaultBloomState();
  state.urgeControl = { activeEvent: { id:"current-urge", flowVersion:2, status:"active", startedAt:at }, records:[] };
  const current = getUrgeControlRouteView(state.urgeControl, "current-urge", at);
  assert(current.kind === "current" && current.progress.stage === "interrupt", "A valid fresh current event must resolve directly to interrupt.");
  assert(getUrgeControlRouteView(state.urgeControl, "stale-id", at).kind === "mismatch", "A stale deep link must not select the active exercise.");
  state.urgeControl = { activeEvent: { id:"legacy-urge", status:"active", startedAt:at }, records:[] };
  const legacy = getUrgeControlRouteView(state.urgeControl, "legacy-urge", at);
  assert(legacy.kind === "legacy" && legacy.progress.stage === "interrupt", "Legacy identity and stage semantics must remain separate.");
}

function verifyIntegrationSources() {
  const screen = readFileSync("src/features/urge-control/screens/UrgeControlResumeScreen.tsx", "utf8");
  const feature = readFileSync("src/features/urge-control/useUrgeControlFeature.ts", "utf8");
  const exercise = readFileSync("src/features/urge-control/exercise/UrgeExercise.tsx", "utf8");
  const panic = readFileSync("src/features/panic/usePanicFeature.ts", "utf8");
  assert(screen.includes('testIDPrefix="bloom.urge.exercise"') && screen.includes('label:"Durum kontrolüne geç"') && !screen.includes("Şunu bitir"),
    "The current interrupt UI must be the production exercise adapter, without the former card.");
  assert(!/QA önizleme|Kaydedilmez|2 saniyelik bitiş/.test(screen), "Production copy must not contain preview fixture wording.");
  assert(feature.includes("holdInterruptForAcknowledgement") && feature.includes("latestUrge !== durable.current.urgeControl"),
    "The adapter must gate outcome and exit on durable Urge truth.");
  assert(exercise.includes("current.confirmingExit") && exercise.includes("!focused") && exercise.includes("interactionDisabled"),
    "Evaluation must reject unfocused, exit-confirming and persistence-locked interaction.");
  assert(panic.includes("controller.startUrge") && panic.includes("controller.recordSlip") && !panic.includes("UrgeExercise"),
    "Panic Urge and Behavior Slip ownership must remain separate from the exercise UI.");
  for (const source of [screen, feature, exercise]) {
    assert(!/AsyncStorage|persistBloom|bloomBehaviorSlipTransitions|flowActions\.(behaviorSlip|tracking|contentFree)/.test(source),
      "Exercise integration must not introduce direct storage, tracker or Behavior Slip mutation ownership.");
  }
}

function equal(actual: unknown, expected: unknown, message: string) {
  if (!isDeepStrictEqual(actual, expected)) throw new Error(message);
}
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
