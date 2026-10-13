import type { ContentFreeState } from "../../../domain/models/ContentFreeState";
import type { MasturbationTrackingState } from "../../../domain/models/MasturbationTrackingState";
import { getContentFreeStreakSeconds } from "../../../domain/contentFree/getContentFreeStreakSeconds";

export type CalendarDay = {
  key: string; label: string; dateLabel: string; start: number; end: number; today: boolean; future: boolean;
};
export type ContentActivityDay = CalendarDay & {
  status: "untracked" | "partial" | "tracked" | "violation" | "future"; trackedSeconds: number; violationCount: number;
};

// Calendar arithmetic uses local midnights, not 24-hour subtraction: DST days
// can last 23/25 hours. Timestamps remain canonical UTC and are never rewritten.
export function calendarDays(at: string, count: number, week = false): CalendarDay[] {
  const now = new Date(at);
  if (!Number.isFinite(now.getTime())) return [];
  // Use UTC only for civil-date arithmetic, then resolve EACH boundary in
  // the current local zone. Carrying a normalized 01:00 midnight into other
  // dates would shift their bounds in zones with a midnight DST transition.
  const civilToday = new Date(0);
  civilToday.setUTCFullYear(now.getFullYear(), now.getMonth(), now.getDate());
  civilToday.setUTCHours(0, 0, 0, 0);
  const first = new Date(civilToday);
  first.setUTCDate(first.getUTCDate() - (week ? (first.getUTCDay() + 6) % 7 : count - 1));
  const localBoundary = (civil: Date) => {
    const date = new Date(0);
    date.setFullYear(civil.getUTCFullYear(), civil.getUTCMonth(), civil.getUTCDate());
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  };
  return Array.from({ length: count }, (_, index) => {
    const civil = new Date(first); civil.setUTCDate(civil.getUTCDate() + index);
    const next = new Date(civil); next.setUTCDate(next.getUTCDate() + 1);
    return { key: civil.toISOString().split("T")[0]!, label: ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"][civil.getUTCDay()]!,
      dateLabel: civil.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }),
      start: localBoundary(civil), end: localBoundary(next), today: civil.getTime() === civilToday.getTime(), future: civil.getTime() > civilToday.getTime() };
  });
}

export function getContentActivity(content: ContentFreeState, at: string, week = false): ContentActivityDay[] {
  const now = Date.parse(at);
  const activations = content.pastActivations.map(a => ({ ...a }));
  if (content.status === "active") activations.push({ id: content.activationId, startedAt: content.activatedAt, endedAt: at,
    ...(content.resetCredit ? { resetCredit: content.resetCredit } : {}) });
  const intervals = activations.flatMap(a => [[Date.parse(a.startedAt), Math.min(now, Date.parse(a.endedAt))],
    ...(a.resetCredit ? [[Date.parse(a.resetCredit.earnedStartedAt), Math.min(now, Date.parse(a.resetCredit.earnedUntil))]] : [])]);
  return calendarDays(at, week ? 7 : 28, week).map(day => {
    const pieces = intervals.map(([start, end]) => [Math.max(day.start, start!), Math.min(day.end, end!)] as const)
      .filter(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && end > start).sort((a, b) => a[0] - b[0]);
    let milliseconds = 0, coveredUntil = day.start;
    for (const [start, end] of pieces) { milliseconds += Math.max(0, end - Math.max(start, coveredUntil)); coveredUntil = Math.max(coveredUntil, end); }
    const violationCount = content.violations.filter(v => v.status === "recorded" && Date.parse(v.occurredAt) <= now &&
      Date.parse(v.occurredAt) >= day.start && Date.parse(v.occurredAt) < day.end).length;
    return { ...day, trackedSeconds: Math.floor(milliseconds / 1000), violationCount,
      status: day.future ? "future" : violationCount > 0 ? "violation" : milliseconds === 0 ? "untracked" :
        milliseconds >= day.end - day.start ? "tracked" : "partial" };
  });
}

export function getContentStreakHistory(content: ContentFreeState, at: string) {
  if (!Number.isFinite(Date.parse(at))) return [];
  const activations = content.pastActivations.filter(a => Date.parse(a.endedAt) <= Date.parse(at)).map(a => ({ ...a, active: false }));
  if (content.status === "active") activations.push({ id: content.activationId, startedAt: content.activatedAt, endedAt: at, active: true,
    ...(content.resetCredit ? { resetCredit: content.resetCredit } : {}) });
  return activations.flatMap(a => {
    const until = Math.min(Date.parse(a.endedAt), Date.parse(at));
    if (until < Date.parse(a.startedAt)) return [];
    const violations = content.violations.filter(v => v.activationId === a.id && v.status === "recorded" &&
      Date.parse(v.occurredAt) <= until).slice().sort((x, y) => Date.parse(x.occurredAt) - Date.parse(y.occurredAt));
    const rows = [];
    let start = a.startedAt;
    for (const violation of violations) {
      rows.push({ id: `${a.id}.${violation.id}`, startedAt: start, endedAt: violation.occurredAt,
        seconds: getContentFreeStreakSeconds(content, start, violation.occurredAt, a.id), endReason: "violation" as const,
        resetSeconds: start === a.startedAt && start !== violation.occurredAt && a.resetCredit ? (Date.parse(a.resetCredit.earnedUntil) - Date.parse(a.resetCredit.earnedStartedAt)) / 1000 : 0 });
      start = violation.occurredAt;
    }
    rows.push({ id: `${a.id}.last`, startedAt: start, endedAt: new Date(until).toISOString(),
      seconds: getContentFreeStreakSeconds(content, start, new Date(until).toISOString(), a.id),
      endReason: a.active ? "active" as const : "stopped" as const,
      resetSeconds: start === a.startedAt && !violations.some(v => v.occurredAt === start) && a.resetCredit ? (Date.parse(a.resetCredit.earnedUntil) - Date.parse(a.resetCredit.earnedStartedAt)) / 1000 : 0 });
    return rows;
  }).reverse().sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt));
}

export function getTrackingHistory(tracking: MasturbationTrackingState, at: string) {
  const sessions = tracking.sessions.filter(s => s.status === "completed" && Date.parse(s.endedAt) <= Date.parse(at))
    // Later saved array entries win equal end times; no locale-dependent ID order.
    .slice().reverse().sort((a, b) => Date.parse(b.endedAt) - Date.parse(a.endedAt));
  const days = calendarDays(at, 28).map(day => ({ ...day,
    count: sessions.filter(s => Date.parse(s.endedAt) >= day.start && Date.parse(s.endedAt) < day.end).length }));
  return { sessions, days, incomplete: tracking.currentSession, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
}

export function formatHistoryDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "Süre kaydedilmedi";
  const whole = Math.max(0, Math.floor(seconds));
  const parts = [[Math.floor(whole / 86400), "gün"], [Math.floor(whole % 86400 / 3600), "sa"], [Math.floor(whole % 3600 / 60), "dk"], [whole % 60, "sn"]] as const;
  return parts.filter(([value]) => value > 0).map(([value, unit]) => `${value} ${unit}`).join(" ") || "0 sn";
}
