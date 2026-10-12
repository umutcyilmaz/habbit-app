import type { KegelState } from "../../domain/models/KegelState";
import type { KegelPreviewData } from "./kegelSession";

export function kegelLocalDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
}

export function deriveKegelSummary(state: KegelState, now: Date): KegelPreviewData {
  const today = kegelLocalDate(now);
  const counts = new Map<string, number>();
  const ids = new Set<string>();
  let total = 0;
  for (const session of state.sessions) {
    if (ids.has(session.id)) continue;
    ids.add(session.id);
    total += session.completedRepetitions;
    counts.set(session.completionDate, (counts.get(session.completionDate) ?? 0)+1);
  }
  const dateAt = (offset: number) => {
    // Calendar arithmetic at noon survives DST; never divide milliseconds by 86400.
    const date = new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
    date.setDate(date.getDate()+offset);
    return kegelLocalDate(date);
  };
  const dayIndex = (now.getDay()+6)%7;
  const week = Array.from({length:7},(_,i) => counts.get(dateAt(i-dayIndex)) ?? 0);
  const heat = Array.from({length:28},(_,i) => counts.get(dateAt(i-27)) ?? 0);
  // Descriptive activity streak: >=1 saved set per local calendar day.
  // Yesterday remains current until today ends. No rewards or level progression.
  let offset = counts.has(today) ? 0 : -1, streak = 0;
  while (counts.has(dateAt(offset))) { streak++; offset--; }
  return {kind:"real",done:counts.get(today) ?? 0,streak,total,week,heat,dayIndex};
}
