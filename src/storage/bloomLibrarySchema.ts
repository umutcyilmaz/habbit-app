import type { BloomLocalState } from "./bloomState";

// Additive v8 field: old v8 payloads are normalized through the existing
// acknowledged rewrite path. Older versions cannot supply Library facts.
// Keep unknown IDs: content removal must never erase a user's stored choice.
export function normalizeLibraryState(value: unknown): BloomLocalState["library"] {
  if (value === undefined) return { bookmarkedArticleIds: [], completedArticleIds: [] };
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Library state");
  const record = value as Record<string, unknown>;
  const ids = (input: unknown): string[] => {
    if (!Array.isArray(input) || input.some(id => typeof id !== "string" || !id.trim() || id.length > 200)) throw new Error("Invalid Library IDs");
    return [...new Set(input as string[])];
  };
  return { bookmarkedArticleIds: ids(record.bookmarkedArticleIds), completedArticleIds: ids(record.completedArticleIds) };
}
