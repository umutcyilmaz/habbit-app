import { bloomOnboardingQuestions } from "../../domain/onboarding/questions";
import type { BloomOnboardingAnswers } from "../../domain/onboarding/types";
import { validateBloomOnboardingAnswers } from "../../domain/onboarding/validation";

export type DraftAnswers = Partial<BloomOnboardingAnswers>;
export const productQuestions = bloomOnboardingQuestions;

export function selectProductAnswer(draft: DraftAnswers, questionIndex: number, value: string | number): DraftAnswers {
  const question = productQuestions[questionIndex];
  if (!question || !question.options.some((option) => option.value === value)) return draft;
  if (question.type === "single_select") return { ...draft, [question.id]: value };
  const existing = draft[question.id];
  const selected = Array.isArray(existing) ? existing as Array<string | number> : [];
  const exclusive = question.exclusiveOptions.some((option) => option === value);
  const next = selected.includes(value)
    ? selected.filter((item) => item !== value)
    : exclusive ? [value] : [...selected.filter((item) => !question.exclusiveOptions.some((option) => option === item)), value];
  return { ...draft, [question.id]: next };
}

export function isProductQuestionAnswered(draft: DraftAnswers, questionIndex: number): boolean {
  const question = productQuestions[questionIndex];
  if (!question) return false;
  const value = draft[question.id];
  if (question.type === "single_select") return question.options.some((option) => option.value === value);
  if (!Array.isArray(value) || value.length === 0 || new Set(value).size !== value.length) return false;
  return value.every((answer) => question.options.some((option) => option.value === answer)) &&
    !question.exclusiveOptions.some((answer) => value.includes(answer) && value.length > 1);
}

export function completedProductAnswers(draft: DraftAnswers): BloomOnboardingAnswers | null {
  if (!productQuestions.every((_, index) => isProductQuestionAnswered(draft, index))) return null;
  try { return validateBloomOnboardingAnswers(draft); }
  catch { return null; }
}
