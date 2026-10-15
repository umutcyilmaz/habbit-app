import { practiceEndingLabels, practiceFeelingValues, type CompletedPracticeSession, type PracticeIntroduction, type PracticeState } from "../domain/models/PracticeState";
import { isValidBloomIsoTimestamp as iso } from "./bloomValueValidation";

function requireValue(condition: unknown): asserts condition { if (!condition) throw new Error("Invalid Practice data."); }
function object(value: unknown): Record<string, unknown> { requireValue(typeof value === "object" && value !== null && !Array.isArray(value)); return value as Record<string, unknown>; }
function duration(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value) && value >= 0; }
function level(value: unknown): value is number { return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10; }
function array(value: unknown): unknown[] { requireValue(Array.isArray(value)); return value; }
export function normalizePracticeIntroduction(value: unknown): PracticeIntroduction {
  const v=object(value); requireValue(typeof v.version==="number" && Number.isSafeInteger(v.version) && v.version>=1 && iso(v.acknowledgedAt));
  return {version:v.version,acknowledgedAt:v.acknowledgedAt};
}
export function normalizeCompletedPracticeSession(value: unknown): CompletedPracticeSession {
  const v=object(value), tz=object(v.timezone);
  requireValue(typeof v.id==="string" && /^[a-zA-Z0-9_-]{1,160}$/.test(v.id) && v.version===1 && v.source==="guided_practice");
  requireValue(iso(v.startedAt) && iso(v.completedAt) && v.completedAt>=v.startedAt);
  requireValue(typeof tz.name==="string" && tz.name.length>0 && tz.name.length<=100);
  // The stored IANA identifier and completion offset are descriptive metadata.
  new Intl.DateTimeFormat("en",{timeZone:tz.name});
  requireValue(typeof tz.utcOffsetMinutes==="number" && Number.isInteger(tz.utcOffsetMinutes) && Math.abs(tz.utcOffsetMinutes)<=840);
  requireValue(duration(v.foregroundExerciseMs) && duration(v.activeMs) && duration(v.intentionalPauseMs));
  requireValue(Math.abs(v.activeMs+v.intentionalPauseMs-v.foregroundExerciseMs)<0.001);
  requireValue(v.foregroundExerciseMs<=Date.parse(v.completedAt)-Date.parse(v.startedAt)+1);
  let previousEnd=0, pauseTotal=0;
  const pauses=array(v.pauses).map(input=>{const p=object(input);requireValue(duration(p.startMs)&&duration(p.endMs)&&p.endMs>=p.startMs&&p.startMs>=previousEnd&&p.endMs<=(v.foregroundExerciseMs as number));previousEnd=p.endMs;pauseTotal+=p.endMs-p.startMs;return {startMs:p.startMs,endMs:p.endMs};});
  requireValue(Math.abs(pauseTotal-v.intentionalPauseMs)<0.001);
  let previousAt=0, previousReport=v.startedAt;
  const arousalReports=array(v.arousalReports).map(input=>{const p=object(input);requireValue(duration(p.atMs)&&p.atMs>=previousAt&&p.atMs<=(v.foregroundExerciseMs as number)&&level(p.level)&&iso(p.reportedAt)&&p.reportedAt>=previousReport&&p.reportedAt<=(v.completedAt as string));previousAt=p.atMs;previousReport=p.reportedAt;return {atMs:p.atMs,reportedAt:p.reportedAt,level:p.level};});
  requireValue(v.erectionQuality===null||level(v.erectionQuality));requireValue(v.explicitContent===null||typeof v.explicitContent==="boolean");
  requireValue(v.ending===null||typeof v.ending==="string"&&Object.prototype.hasOwnProperty.call(practiceEndingLabels,v.ending));
  const feelings=array(v.feelings);requireValue(feelings.every(f=>practiceFeelingValues.includes(f as never))&&new Set(feelings).size===feelings.length);
  return {id:v.id,version:1,source:"guided_practice",startedAt:v.startedAt,completedAt:v.completedAt,timezone:{name:tz.name,utcOffsetMinutes:tz.utcOffsetMinutes},foregroundExerciseMs:v.foregroundExerciseMs,activeMs:v.activeMs,intentionalPauseMs:v.intentionalPauseMs,pauses,arousalReports,erectionQuality:v.erectionQuality as number|null,explicitContent:v.explicitContent as boolean|null,ending:v.ending as CompletedPracticeSession["ending"],feelings:feelings as CompletedPracticeSession["feelings"]};
}
export function normalizePracticeState(value: unknown): PracticeState {
  const v=object(value), sessions=array(v.sessions).map(normalizeCompletedPracticeSession);
  requireValue(new Set(sessions.map(s=>s.id)).size===sessions.length);
  return {introduction:v.introduction===null?null:normalizePracticeIntroduction(v.introduction),sessions};
}
export function practicePayloadEqual(a: CompletedPracticeSession, b: CompletedPracticeSession): boolean {
  return JSON.stringify(normalizeCompletedPracticeSession(a))===JSON.stringify(normalizeCompletedPracticeSession(b));
}
