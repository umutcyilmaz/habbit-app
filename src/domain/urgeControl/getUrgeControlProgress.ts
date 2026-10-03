import type { UrgeControlState } from "../models/UrgeControlState";
import type { ISODateString } from "../models/shared";

export type UrgeControlProgress = {
  stage: "interrupt" | "technique" | "phoneAwayReady" | "phoneAwayActive" | "outcome" | "trigger" | "triggers" | "readyToComplete";
  elapsedEventSeconds: number;
  phoneAwayElapsedSeconds?: number;
};

// Current events resume interrupt -> outcome -> finalized triggers. Historical
// events retain their guided stages. All timers remain derived reads only.
export function getUrgeControlProgress(urgeControl: UrgeControlState, now: ISODateString): UrgeControlProgress | null {
  const event = urgeControl.activeEvent;
  if (event === null || event.status !== "active" || !isCanonicalTimestamp(now) ||
    !isCanonicalTimestamp(event.startedAt)) return null;

  if (event.flowVersion === 2) {
    if (event.interruptCompletedAt !== undefined && (!isCanonicalTimestamp(event.interruptCompletedAt) ||
      Date.parse(event.interruptCompletedAt) < Date.parse(event.startedAt))) return null;
    if ((event.outcome !== undefined && event.interruptCompletedAt === undefined) ||
      (event.triggers !== undefined && (event.outcome === undefined || !Array.isArray(event.triggers)))) return null;
    return {
      stage: event.interruptCompletedAt === undefined ? "interrupt"
        : event.outcome === undefined ? "outcome"
        : event.triggers === undefined ? "triggers"
        : "readyToComplete",
      elapsedEventSeconds: elapsedSeconds(event.startedAt, now)
    };
  }
  if (event.flowVersion !== undefined) return null;

  const { interruptCompletedAt, phoneAwayStartedAt, phoneAwayEndedAt } = event;
  for (const time of [interruptCompletedAt, phoneAwayStartedAt, phoneAwayEndedAt]) {
    if (time !== undefined && (!isCanonicalTimestamp(time) || Date.parse(time) < Date.parse(event.startedAt))) return null;
  }
  if (phoneAwayStartedAt !== undefined && interruptCompletedAt !== undefined &&
    Date.parse(phoneAwayStartedAt) < Date.parse(interruptCompletedAt)) return null;
  if (phoneAwayEndedAt !== undefined && (phoneAwayStartedAt === undefined ||
    Date.parse(phoneAwayEndedAt) < Date.parse(phoneAwayStartedAt))) return null;

  const stage: UrgeControlProgress["stage"] = interruptCompletedAt === undefined ? "interrupt"
    : event.selectedTechnique === undefined ? "technique"
    : phoneAwayStartedAt === undefined ? "phoneAwayReady"
    : phoneAwayEndedAt === undefined ? "phoneAwayActive"
    : event.outcome === undefined ? "outcome"
    : event.trigger === undefined ? "trigger"
    : "readyToComplete";

  return {
    stage,
    elapsedEventSeconds: elapsedSeconds(event.startedAt, now),
    ...(phoneAwayStartedAt === undefined ? {} : {
      phoneAwayElapsedSeconds: elapsedSeconds(phoneAwayStartedAt, phoneAwayEndedAt ?? now)
    })
  };
}

function elapsedSeconds(startedAt: ISODateString, endedAt: ISODateString): number {
  return Math.max(0, Math.floor((Date.parse(endedAt) - Date.parse(startedAt)) / 1000));
}

function isCanonicalTimestamp(value: unknown): value is ISODateString {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && new Date(time).toISOString() === value;
}
