import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { createBloomLocalStateMutationRuntime } from "../src/app/providers/bloomLocalStateMutationRuntime";
import { createBloomProductAcknowledgedActions } from "../src/app/providers/bloomProductAcknowledgedActions";
import { scoreBloomOnboarding } from "../src/domain/onboarding/scoreBloomOnboarding";
import type { BloomOnboardingAnswers } from "../src/domain/onboarding/types";
import { productOnboardingEntryRoute } from "../src/features/product-onboarding/productOnboardingRoute";
import { productOnboardingSubmission } from "../src/features/product-onboarding/productOnboardingSubmission";
import { completedProductAnswers, isProductQuestionAnswered, productQuestions, selectProductAnswer, type DraftAnswers } from "../src/features/product-onboarding/productOnboardingQuiz";
import { createDefaultBloomState } from "../src/storage/bloomState";
import type { BloomStateWriteReceipt } from "../src/storage/bloomStatePersistence";
import { BLOOM_PERSISTENCE_VERSION } from "../src/storage/bloomStateSchema";
import { verifyBloomStartingRecommendationFeature } from "./verify-bloom-starting-recommendation-feature";

const ids = ["explicitContentFrequency", "unplannedContentUse", "activityInterruption", "contentTriggeredMasturbation", "repeatedContentReturn", "difficultyReducingContent", "erectionQuality", "erectionMaintenanceDifficulty", "masturbationTechniques", "techniqueDependency", "delayedOrDifficultEjaculation", "safetySignals"];

async function verify() {
  assert.deepEqual(productQuestions.map((question) => question.id), ids);
  assert.equal(productQuestions.length, 12);
  const defaultState = createDefaultBloomState();
  assert.equal(productOnboardingEntryRoute(defaultState.productOnboarding), "/onboarding");
  const root = readFileSync("app/index.tsx", "utf8");
  assert.match(root, /hydrationStatus !== "ready"/);
  assert.match(root, /durableState\.productOnboarding/);
  assert.doesNotMatch(root, /durableState\.onboarding\.completed/);
  assert.match(readFileSync("app/onboarding/result.tsx", "utf8"), /productOnboardingEntryRoute/);
  assert.doesNotMatch(readFileSync("app/onboarding/quiz.tsx", "utf8"), /features\/onboarding\/screens\/OnboardingQuizScreen/);

  let draft: DraftAnswers = {};
  assert.equal(completedProductAnswers(draft), null);
  for (let index = 0; index < productQuestions.length; index++) {
    const question = productQuestions[index]!;
    assert.equal(isProductQuestionAnswered(draft, index), false);
    draft = selectProductAnswer(draft, index, question.options[0]!.value);
    assert.equal(isProductQuestionAnswered(draft, index), true);
  }
  assert(completedProductAnswers(draft));
  const before = draft.explicitContentFrequency;
  draft = selectProductAnswer(draft, 6, 10);
  assert.equal(draft.erectionQuality, 10);
  draft = selectProductAnswer(draft, 6, "notSure");
  assert.equal(draft.erectionQuality, "notSure");
  assert.equal(draft.explicitContentFrequency, before, "Back/forward retains previous answers in one draft.");
  draft = selectProductAnswer(draft, 8, "veryHighSpeed");
  draft = selectProductAnswer(draft, 8, "notSure");
  assert.deepEqual(draft.masturbationTechniques, ["notSure"]);
  draft = selectProductAnswer(draft, 8, "normalHandTechnique");
  assert.deepEqual(draft.masturbationTechniques, ["normalHandTechnique"]);
  draft = selectProductAnswer(draft, 11, "none");
  draft = selectProductAnswer(draft, 11, "pain");
  assert.deepEqual(draft.safetySignals, ["pain"]);
  draft = selectProductAnswer(draft, 11, "unsure");
  assert.deepEqual(draft.safetySignals, ["pain", "unsure"]);
  draft = selectProductAnswer(draft, 11, "none");
  assert.deepEqual(draft.safetySignals, ["none"]);
  assert.equal(completedProductAnswers({ ...draft, safetySignals: [] }), null);
  assert.equal(completedProductAnswers({ ...draft, masturbationTechniques: ["notSure", "other"] }), null);
  assert.equal(completedProductAnswers({ ...draft, erectionQuality: 0 as never }), null);
  const answers = completedProductAnswers(draft);
  assert(answers);

  const attempts: Array<{ state: ReturnType<typeof createDefaultBloomState>; succeed: () => void; fail: () => void }> = [];
  const runtime = createBloomLocalStateMutationRuntime({ initialState: defaultState, initialHydrationStatus: "ready",
    persistState: (state) => new Promise<BloomStateWriteReceipt>((resolve, reject) => {
      const writeId = attempts.length + 1;
      attempts.push({ state, succeed: () => resolve({ status: "persisted", writeId, generation: 0 }), fail: () => reject(new Error("synthetic failure")) });
    })
  });
  const actions = createBloomProductAcknowledgedActions({ applyAcknowledgedMutation: runtime.applyAcknowledgedMutation });
  let commands = 0;
  const deps = { save: (result: ReturnType<typeof scoreBloomOnboarding>) => { commands++; return actions.onboarding.saveProductOnboardingResult(result); },
    retry: runtime.retryPersistence, getOnboarding: () => runtime.getState().productOnboarding };
  const first = productOnboardingSubmission.submit(answers as BloomOnboardingAnswers, deps);
  assert(first);
  assert.equal(productOnboardingSubmission.submit(answers, deps), first, "Repeated press shares in-flight submission.");
  assert.equal(commands, 1);
  assert.equal(attempts.length, 1);
  const accepted = runtime.getState();
  assert.equal(accepted.productOnboarding.status, "completed");
  assert.equal(accepted.productOnboarding.planAcceptance, null);
  assert.equal(accepted.onboarding, defaultState.onboarding);
  assert.equal(accepted.activePlan, defaultState.activePlan);
  assert.equal(accepted.masturbationTracking, defaultState.masturbationTracking);
  assert.equal(accepted.contentFree, defaultState.contentFree);
  assert.equal(accepted.resetJourney, defaultState.resetJourney);
  assert.equal(runtime.getDurableState(), defaultState, "No navigation before durability.");
  const submitted = productOnboardingSubmission.getSnapshot().result!;
  assert.deepEqual(submitted, scoreBloomOnboarding(answers, submitted.completedAt));
  attempts[0]!.fail();
  const failed = await first;
  assert(!failed.ok && failed.accepted && failed.retryable);
  assert.equal(productOnboardingSubmission.getSnapshot().persisted, false);
  assert.equal(productOnboardingSubmission.getSnapshot().retryToken, failed.retryToken);
  assert.equal(productOnboardingSubmission.submit(answers, deps), null, "Accepted failure cannot rescore or replay command.");
  const retry = productOnboardingSubmission.retry(deps);
  assert(retry);
  assert.equal(attempts.length, 2);
  assert.equal(attempts[1]!.state, accepted, "Retry preserves accepted snapshot.");
  assert.equal(commands, 1);
  assert.equal(productOnboardingSubmission.getSnapshot().result, submitted);
  attempts[1]!.succeed();
  assert.equal((await retry).ok, true);
  assert.equal(runtime.getDurableState(), accepted);
  assert.equal(productOnboardingSubmission.getSnapshot().persisted, true);
  assert.equal(productOnboardingEntryRoute(accepted.productOnboarding), "/bloom/starting-recommendation");
  if (accepted.productOnboarding.status !== "completed") throw new Error("Expected result");
  assert.equal(productOnboardingEntryRoute({ ...accepted.productOnboarding, planAcceptance: { acceptedAt: submitted.completedAt, recommendation: submitted.recommendation } }), "/(tabs)/today");
  assert.equal(productOnboardingSubmission.submit(answers, deps), null);
  assert.equal(commands, 1);
  assert.equal(BLOOM_PERSISTENCE_VERSION, 7);
  await verifyBloomStartingRecommendationFeature();
  console.log("Bloom product onboarding UI verification passed.");
}

void verify().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
