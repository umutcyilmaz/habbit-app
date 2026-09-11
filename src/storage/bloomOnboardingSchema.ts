import type { ProductOnboardingState } from "../domain/models/ProductOnboardingState";
import { validateBloomOnboardingResult } from "../domain/onboarding/validation";
import { isValidBloomIsoTimestamp } from "./bloomValueValidation";

export function normalizeProductOnboarding(
  value: unknown,
  mode: "current" | "v4" = "current"
): ProductOnboardingState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("state.productOnboarding must be an object.");
  }
  const record = value as Record<string, unknown>;
  // V4 never recorded acceptance. Ignore only that later-schema property if
  // present, rather than importing it or inferring acceptance from feature state.
  const keys = Object.keys(record).filter((key) => mode !== "v4" || key !== "planAcceptance");
  const requiredKeys = mode === "current" && record.status === "completed"
    ? ["status", "result", "planAcceptance"]
    : ["status", "result"];
  if (keys.length !== requiredKeys.length || !keys.every((key) => requiredKeys.includes(key))) {
    throw new TypeError("state.productOnboarding must contain exactly the supported lifecycle fields.");
  }
  if (record.status === "notCompleted" && record.result === null) {
    return { status: "notCompleted", result: null };
  }
  if (record.status === "completed") {
    const result = validateBloomOnboardingResult(record.result);
    if (mode === "v4" || record.planAcceptance === null) {
      return { status: "completed", result, planAcceptance: null };
    }
    const acceptance = record.planAcceptance;
    if (typeof acceptance !== "object" || acceptance === null || Array.isArray(acceptance)) {
      throw new TypeError("state.productOnboarding.planAcceptance must be null or an object.");
    }
    const accepted = acceptance as Record<string, unknown>;
    const acceptanceKeys = Object.keys(accepted);
    if (acceptanceKeys.length !== 2 || !acceptanceKeys.includes("acceptedAt") ||
      !acceptanceKeys.includes("recommendation")) {
      throw new TypeError("state.productOnboarding.planAcceptance must contain only acceptedAt and recommendation.");
    }
    if (!isValidBloomIsoTimestamp(accepted.acceptedAt) ||
      Date.parse(accepted.acceptedAt) < Date.parse(result.completedAt)) {
      throw new TypeError("state.productOnboarding.planAcceptance.acceptedAt must be a canonical ISO timestamp at or after quiz completion.");
    }
    // The validated result already restricts the recommendation enum. Matching
    // that value validates the accepted enum without re-running any scoring.
    if (accepted.recommendation !== result.recommendation) {
      throw new TypeError("state.productOnboarding.planAcceptance.recommendation must match the saved result.");
    }
    return {
      status: "completed",
      result,
      planAcceptance: {
        acceptedAt: accepted.acceptedAt,
        recommendation: result.recommendation
      }
    };
  }
  throw new TypeError("state.productOnboarding has an invalid lifecycle shape.");
}
