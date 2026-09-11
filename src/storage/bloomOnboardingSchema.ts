import type { ProductOnboardingState } from "../domain/models/ProductOnboardingState";
import { validateBloomOnboardingResult } from "../domain/onboarding/validation";

export function normalizeProductOnboarding(value: unknown): ProductOnboardingState {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError("state.productOnboarding must be an object.");
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length !== 2 || !keys.includes("status") || !keys.includes("result")) {
    throw new TypeError("state.productOnboarding must contain only status and result.");
  }
  if (record.status === "notCompleted" && record.result === null) {
    return { status: "notCompleted", result: null };
  }
  if (record.status === "completed") {
    return { status: "completed", result: validateBloomOnboardingResult(record.result) };
  }
  throw new TypeError("state.productOnboarding has an invalid lifecycle shape.");
}
