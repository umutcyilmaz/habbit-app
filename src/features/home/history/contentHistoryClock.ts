import type { ContentFreeState } from "../../../domain/models/ContentFreeState";
import { getContentFreeStreakSeconds } from "../../../domain/contentFree/getContentFreeStreakSeconds";
import { getContentActivity, getContentStreakHistory, type ContentActivityDay } from "./activityHistory";

// Display-only facts, rebuilt when the acknowledged Content-Free object changes.
// Merged intervals let a tick update today's coverage without traversing every
// activation for each of the 35 calendar cells or rebuilding completed streaks.
export function getContentHistoryClockFacts(content: ContentFreeState) {
  const intervals = content.pastActivations.flatMap(a => [
    [Date.parse(a.startedAt), Date.parse(a.endedAt)],
    ...(a.resetCredit ? [[Date.parse(a.resetCredit.earnedStartedAt), Date.parse(a.resetCredit.earnedUntil)]] : []),
  ]);
  if (content.status === "active") {
    intervals.push([Date.parse(content.activatedAt), Infinity]);
    if (content.resetCredit) intervals.push([Date.parse(content.resetCredit.earnedStartedAt), Date.parse(content.resetCredit.earnedUntil)]);
  }
  const merged: [number, number][] = [];
  for (const [start, end] of intervals.filter(([s, e]) => Number.isFinite(s) && e! > s!).sort((a, b) => a[0]! - b[0]!)) {
    const last = merged[merged.length - 1];
    if (last && start! <= last[1]) last[1] = Math.max(last[1], end!);
    else merged.push([start!, end!]);
  }
  // Crossing an event time matters after clock rollback/forward too. In
  // particular a future saved violation must not appear before it occurred.
  const boundaries = [...new Set([
    ...intervals.flat(),
    ...content.violations.filter(v => v.status === "recorded").map(v => Date.parse(v.occurredAt)),
  ].filter(Number.isFinite))].sort((a, b) => a - b);
  return { content, intervals: merged, boundaries };
}

type ClockFacts = ReturnType<typeof getContentHistoryClockFacts>;

export function getContentHistoryClockKey(facts: ClockFacts, milliseconds: number, timeZone: string, refresh: number) {
  let low = 0, high = facts.boundaries.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (facts.boundaries[middle]! <= milliseconds) low = middle + 1;
    else high = middle;
  }
  const date = new Date(milliseconds);
  return `${date.getFullYear()}/${date.getMonth()}/${date.getDate()}/${date.getTimezoneOffset()}/${timeZone}/${low}/${refresh}`;
}

export function getContentHistoryClockSnapshot(facts: ClockFacts, at: string) {
  return { facts, at, activity: getContentActivity(facts.content, at), week: getContentActivity(facts.content, at, true),
    streaks: getContentStreakHistory(facts.content, at) };
}

export function advanceContentHistoryClock(snapshot: ReturnType<typeof getContentHistoryClockSnapshot>, at: string) {
  if (snapshot.at === at) return snapshot;
  const milliseconds = Date.parse(at);
  const advanceDay = (day: ContentActivityDay): ContentActivityDay => {
    if (!day.today) return day;
    let coverage = 0;
    for (const [start, end] of snapshot.facts.intervals) {
      if (start >= day.end || start >= milliseconds) break;
      coverage += Math.max(0, Math.min(end, day.end, milliseconds) - Math.max(start, day.start));
    }
    const trackedSeconds = Math.floor(coverage / 1000);
    const status = day.violationCount > 0 ? "violation" : coverage === 0 ? "untracked" : coverage >= day.end - day.start ? "tracked" : "partial";
    return trackedSeconds === day.trackedSeconds && status === day.status ? day : { ...day, trackedSeconds, status };
  };
  // One live domain duration; completed rows keep their identities and values.
  const streaks = snapshot.streaks.map(s => s.endReason !== "active" ? s : { ...s, endedAt: at,
    seconds: getContentFreeStreakSeconds(snapshot.facts.content, s.startedAt, at,
      snapshot.facts.content.status === "active" ? snapshot.facts.content.activationId : undefined) });
  return { activity: snapshot.activity.map(advanceDay), week: snapshot.week.map(advanceDay), streaks };
}
