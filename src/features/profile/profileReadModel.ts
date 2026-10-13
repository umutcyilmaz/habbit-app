import type { BloomLocalState } from "../../storage/bloomState";
import { getBloomProgressReadModel } from "../../domain/progress/getBloomProgressReadModel";
import { deriveKegelSummary } from "../kegel/kegelSummary";
import { libraryArticles } from "../library/libraryContent";
import { getStartingRecommendationView } from "../starting-recommendation/startingRecommendationView";

export function savedProfileArticles(state: BloomLocalState) {
  return libraryArticles.filter(article => state.library.bookmarkedArticleIds.includes(article.id));
}

// Read only confirmed facts. No profile counters, entitlements or new storage.
export function getProfileReadModel(source: {
  durableState: BloomLocalState;
  hydrationStatus: "loading" | "ready" | "error";
}, now: Date) {
  if (source.hydrationStatus !== "ready" || !Number.isFinite(now.getTime())) return null;
  const state = source.durableState;
  const progress = getBloomProgressReadModel(source, now.toISOString());
  if (progress === null) return null;
  const kegel = deriveKegelSummary(state.kegel, now);
  const content = progress.contentFree.progress;
  const assessment = getStartingRecommendationView(state);
  return {
    contentFreeDays: content.status === "active" ? content.currentCompletedDays : null,
    bestContentFreeDays: Math.floor(content.effectiveBestStreakSeconds / 86400),
    completedPracticeCount: progress.tracking.summary.completedSessionCount,
    kegelStreak: kegel.streak,
    completedKegelSets: new Set(state.kegel.sessions.map(session => session.id)).size,
    kegelRepetitions: kegel.total,
    completedArticleCount: libraryArticles.filter(article => state.library.completedArticleIds.includes(article.id)).length,
    savedArticleCount: savedProfileArticles(state).length,
    completedResetCount: progress.reset.completedAttemptCount,
    assessmentAvailable: assessment.kind === "recommendation",
    assessmentDetail: assessment.kind === "recommendation" ? "Kaydedilmiş başlangıç önerini gör"
      : state.productOnboarding.status === "completed" ? "Planın seçildi · sonuç görüntüleme henüz yok"
      : "Henüz değerlendirme tamamlanmadı"
  };
}
