import type { BloomLocalState } from "./bloomState";
import { findLibraryArticle } from "../features/library/libraryContent";

export type LibraryStateKind = "bookmark" | "completion";
export function setLibraryArticleState(state: BloomLocalState, kind: LibraryStateKind, id: string, enabled: boolean): BloomLocalState {
  const key = kind === "bookmark" ? "bookmarkedArticleIds" : "completedArticleIds";
  const ids = state.library[key];
  // Unknown/deleted content can be removed, never newly marked as read/saved.
  if (enabled && !findLibraryArticle(id)) throw new Error("Unknown Library article");
  if (ids.includes(id) === enabled) return state;
  return { ...state, library: { ...state.library, [key]: enabled ? [...ids, id] : ids.filter(value => value !== id) } };
}
