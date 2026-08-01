import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import {
  e2eTimerDurations,
  productionTimerDurations,
  resolveBloomTimerDurations,
  resolveE2EMode
} from "../src/shared/runtime/e2eMode";
import { createDefaultBloomState } from "../src/storage/bloomState";

const projectRoot = process.cwd();

function verifyE2ERuntime() {
  assert(
    resolveE2EMode({
      isDevelopment: true,
      environmentValue: undefined
    }) === false,
    "Normal development must not enable E2E mode."
  );
  assert(
    resolveE2EMode({
      isDevelopment: true,
      environmentValue: "1"
    }) === true,
    "Development with EXPO_PUBLIC_E2E_MODE=1 must enable E2E mode."
  );
  assert(
    resolveE2EMode({
      isDevelopment: false,
      environmentValue: "1"
    }) === false,
    "Production must ignore the E2E environment flag."
  );
  assert(
    resolveE2EMode({
      isDevelopment: true,
      environmentValue: "true"
    }) === false,
    "Only the explicit value 1 may enable E2E mode."
  );

  assertDurations(
    resolveBloomTimerDurations({
      isDevelopment: true,
      environmentValue: undefined
    }),
    productionTimerDurations,
    "normal development"
  );
  assertDurations(
    resolveBloomTimerDurations({
      isDevelopment: true,
      environmentValue: "1"
    }),
    e2eTimerDurations,
    "E2E development"
  );
  assertDurations(
    resolveBloomTimerDurations({
      isDevelopment: false,
      environmentValue: "1"
    }),
    productionTimerDurations,
    "production"
  );

  assert(
    productionTimerDurations.pauseRoundSeconds === 90 &&
      productionTimerDurations.resetSeconds === 120 &&
      productionTimerDurations.arousalPauseSeconds === 30,
    "Production timer durations must remain 90, 120, and 30 seconds."
  );
  assert(
    e2eTimerDurations.pauseRoundSeconds === 3 &&
      e2eTimerDurations.resetSeconds === 3 &&
      e2eTimerDurations.arousalPauseSeconds === 3,
    "E2E timer durations must remain short but non-zero."
  );

  const defaultState = JSON.stringify(createDefaultBloomState());
  assert(
    !defaultState.toLowerCase().includes("e2e"),
    "The E2E flag must not be represented in Bloom state."
  );

  const storageDirectory = join(projectRoot, "src", "storage");
  const storageSource = readdirSync(storageDirectory)
    .filter((fileName) => fileName.endsWith(".ts"))
    .map((fileName) => readFileSync(join(storageDirectory, fileName), "utf8"))
    .join("\n");
  assert(
    !storageSource.includes("EXPO_PUBLIC_E2E_MODE") &&
      !storageSource.includes("shared/runtime/e2eMode"),
    "Storage modules must not read or persist E2E mode."
  );

  assertSourceUsesRuntimeDuration(
    "src/app/providers/BloomLocalStateProvider.tsx",
    "timerDurationSeconds: pauseRoundDurationSeconds"
  );
  assertSourceUsesRuntimeDuration(
    "src/features/reset/screens/TenDayResetPracticeScreen.tsx",
    "resetDurationSeconds"
  );
  assertSourceUsesRuntimeDuration(
    "src/features/arousal-control/screens/PauseScreen.tsx",
    "arousalPauseDurationSeconds"
  );

  console.log("Bloom E2E runtime verification passed.");
}

function assertDurations(
  actual: typeof productionTimerDurations,
  expected: typeof productionTimerDurations,
  context: string
) {
  assert(
    actual.pauseRoundSeconds === expected.pauseRoundSeconds &&
      actual.resetSeconds === expected.resetSeconds &&
      actual.arousalPauseSeconds === expected.arousalPauseSeconds,
    `Unexpected timer durations for ${context}.`
  );
}

function assertSourceUsesRuntimeDuration(
  relativePath: string,
  expectedSource: string
) {
  const source = readFileSync(join(projectRoot, relativePath), "utf8");

  assert(
    source.includes(expectedSource) &&
      source.includes("shared/runtime/e2eMode"),
    `${relativePath} must use the centralized E2E runtime duration.`
  );
}

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

verifyE2ERuntime();
