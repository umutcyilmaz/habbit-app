import type { PracticeState } from "../../domain/models/PracticeState";
// Stable local day at completion. Travel/device timezone changes never regroup
// older records. utcOffsetMinutes follows Date.getTimezoneOffset (UTC-local).
export function getPracticeLocalDay(completedAt:string,utcOffsetMinutes:number) {
  return new Date(Date.parse(completedAt)-utcOffsetMinutes*60000).toISOString().slice(0,10);
}
export function groupPracticeHistory(state:PracticeState) {
  const groups=new Map<string,PracticeState["sessions"]>();
  for(const session of [...state.sessions].sort((a,b)=>b.completedAt.localeCompare(a.completedAt)||a.id.localeCompare(b.id))) {
    const day=getPracticeLocalDay(session.completedAt,session.timezone.utcOffsetMinutes);
    const records=groups.get(day)??[];records.push(session);groups.set(day,records);
  }
  return [...groups].map(([day,sessions])=>({day,sessions}));
}
