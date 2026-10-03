import type { CurrentUrgeControlEvent, LegacyUrgeControlEvent } from "../../domain/models/UrgeControlEvent";
import type { UrgeControlState } from "../../domain/models/UrgeControlState";
import type { ISODateString } from "../../domain/models/shared";
import { getUrgeControlProgress, type UrgeControlProgress } from "../../domain/urgeControl/getUrgeControlProgress";

export type UrgeControlRouteView =
  | { kind: "missing" | "invalid" | "mismatch" | "unavailable" }
  | { kind: "current"; event: Extract<CurrentUrgeControlEvent, { status: "active" }>; progress: UrgeControlProgress }
  | { kind: "legacy"; event: Extract<LegacyUrgeControlEvent, { status: "active" }>; progress: UrgeControlProgress };

// Only identity comes from the URL. Its optional stage hint is never read here.
export function getUrgeControlRouteView(urge: UrgeControlState, eventId: unknown, at: ISODateString): UrgeControlRouteView {
  if (eventId === undefined || eventId === null) return { kind: "missing" };
  if (typeof eventId !== "string" || eventId.trim().length === 0) return { kind: "invalid" };
  const event = urge.activeEvent;
  if (event === null || event.status !== "active" || event.id !== eventId) return { kind: "mismatch" };
  const progress = getUrgeControlProgress(urge, at);
  if (progress === null) return { kind: "unavailable" };
  return event.flowVersion === 2 ? { kind: "current", event, progress } : { kind: "legacy", event, progress };
}
