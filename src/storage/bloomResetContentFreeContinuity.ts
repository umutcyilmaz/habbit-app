import { getResetContentFreeCredit } from "../domain/contentFree/getResetContentFreeCredit";
import { getContentFreeStreakSeconds } from "../domain/contentFree/getContentFreeStreakSeconds";
import type { ContentFreeState, ResetContentFreeCredit } from "../domain/models/ContentFreeState";
import type { ResetJourney } from "../domain/models/ResetJourney";

// Undo can restore an earlier Reset boundary, including an earlier period end.
// Re-evaluate the original credit window and rebuild the affected ended bests.
export function reconcileResetContentFreeCredit(content: ContentFreeState, reset: ResetJourney): ContentFreeState {
  let earliest: { at: string; bestBefore: number } | null = null;
  const correct = (credit: ResetContentFreeCredit | undefined, activationStart: string) => {
    if (credit === undefined || !("id" in reset) || credit.resetJourneyId !== reset.id) return credit;
    const priorContent: ContentFreeState = {
      status: "inactive", bestStreakSeconds: credit.bestStreakSecondsBefore,
      pastActivations: content.pastActivations.filter((entry) => Date.parse(entry.startedAt) < Date.parse(activationStart)),
      violations: content.violations.filter((entry) => Date.parse(entry.occurredAt) < Date.parse(activationStart))
    };
    const next = getResetContentFreeCredit(reset, priorContent, credit.earnedUntil);
    if (next?.earnedStartedAt !== credit.earnedStartedAt || next?.earnedUntil !== credit.earnedUntil) {
      if (earliest === null || Date.parse(activationStart) < Date.parse(earliest.at)) {
        earliest = { at: activationStart, bestBefore: credit.bestStreakSecondsBefore };
      }
    }
    return next ?? undefined;
  };
  const pastActivations = content.pastActivations.map((entry) => {
    const resetCredit = correct(entry.resetCredit, entry.startedAt);
    const { resetCredit: _priorCredit, ...period } = entry;
    return resetCredit === undefined ? period : { ...period, resetCredit };
  });
  const activeCredit = content.status === "active" ? correct(content.resetCredit, content.activatedAt) : undefined;
  const { resetCredit: _previousActiveCredit, ...activeWithoutCredit } = content.status === "active" ? content : { ...content, resetCredit: undefined };
  const corrected: ContentFreeState = { ...activeWithoutCredit, pastActivations,
    ...(activeCredit === undefined ? {} : { resetCredit: activeCredit }) };
  // TypeScript does not follow updates made in the closure.
  const boundary = earliest as { at: string; bestBefore: number } | null;
  if (boundary === null) return content;
  const periods = [...pastActivations, ...(corrected.status === "active" ? [{
    id: corrected.activationId, startedAt: corrected.activatedAt
  }] : [])].filter((entry) => Date.parse(entry.startedAt) >= Date.parse(boundary.at));
  const ended: Array<{ at: string; seconds: number; violationId?: string }> = [];
  for (const period of periods) {
    let start = period.startedAt;
    const effective = corrected.violations.filter((entry) => entry.activationId === period.id && entry.status === "recorded")
      .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
    const seen = new Set<string>();
    for (const violation of effective) {
      const beforeEvent: ContentFreeState = { ...corrected, violations: corrected.violations.filter((entry) =>
        entry.activationId !== period.id || entry.status === "undone" || seen.has(entry.id)) };
      ended.push({ at: violation.recordedAt, violationId: violation.id,
        seconds: getContentFreeStreakSeconds(beforeEvent, start, violation.occurredAt, period.id) });
      seen.add(violation.id);
      start = violation.occurredAt;
    }
    if ("endedAt" in period) ended.push({ at: period.endedAt, seconds: getContentFreeStreakSeconds(corrected, start, period.endedAt, period.id) });
  }
  const bestAt = (at?: string, targetId?: string) => Math.max(boundary.bestBefore,
    ...ended.filter((entry) => at === undefined || Date.parse(entry.at) < Date.parse(at) ||
      (entry.at === at && (entry.violationId === undefined || (targetId !== undefined &&
        corrected.violations.findIndex((v) => v.id === entry.violationId) < corrected.violations.findIndex((v) => v.id === targetId)))))
      .map((entry) => entry.seconds));
  const correctedBaseline = (credit: ResetContentFreeCredit | undefined, at: string) => credit === undefined ? {} : {
    resetCredit: Date.parse(at) >= Date.parse(boundary.at) ? { ...credit, bestStreakSecondsBefore: bestAt(at) } : credit
  };
  return { ...corrected,
    pastActivations: corrected.pastActivations.map((entry) => ({ ...entry, ...correctedBaseline(entry.resetCredit, entry.startedAt) })),
    ...(corrected.status === "active" ? correctedBaseline(corrected.resetCredit, corrected.activatedAt) : {}),
    bestStreakSeconds: bestAt(), violations: corrected.violations.map((entry) =>
    Date.parse(entry.recordedAt) < Date.parse(boundary.at) ? entry : {
      ...entry, streakBefore: { ...entry.streakBefore, bestStreakSeconds: bestAt(entry.recordedAt, entry.id) }
    }) };
}

// Self-contained archived credits survive replacement journeys. While source
// history is present, validate its exact evidence as well as slice boundaries.
export function validateResetContentFreeContinuity(content: ContentFreeState, reset: ResetJourney): void {
  const activations = [...content.pastActivations, ...(content.status === "active" ? [{
    id: content.activationId, startedAt: content.activatedAt, resetCredit: content.resetCredit
  }] : [])];
  if (reset.status === "completed" && reset.contentFreeContinuation?.decision === "accepted" &&
    !activations.some((entry) => entry.startedAt === reset.contentFreeContinuation?.decidedAt && entry.resetCredit?.resetJourneyId === reset.id)) {
    throw new Error("Accepted Reset continuation requires its credited Content-Free activation.");
  }
  for (const activation of activations) {
    const credit = activation.resetCredit;
    if (credit === undefined || !("id" in reset) || credit.resetJourneyId !== reset.id) continue;
    const prior: ContentFreeState = { status: "inactive", bestStreakSeconds: credit.bestStreakSecondsBefore,
      pastActivations: content.pastActivations.filter((entry) => Date.parse(entry.startedAt) < Date.parse(activation.startedAt)),
      violations: content.violations.filter((entry) => Date.parse(entry.occurredAt) < Date.parse(activation.startedAt)) };
    const expected = getResetContentFreeCredit(reset, prior, credit.earnedUntil);
    // Earlier Phase 10 v7 credits may conservatively begin at deactivation.
    // Preserve those valid subsets on hydration instead of rewriting history.
    if (expected === null || Date.parse(credit.earnedStartedAt) < Date.parse(expected.earnedStartedAt) || expected.earnedUntil !== credit.earnedUntil) {
      throw new Error("Content-Free Reset credit disagrees with its effective Reset history.");
    }
  }
}
