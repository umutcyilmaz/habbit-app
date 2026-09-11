import type { UrgeControlEvent } from "./UrgeControlEvent";

export type ActiveUrgeControlEvent = Extract<UrgeControlEvent, { status: "active" }>;
export type CompletedUrgeControlEvent = Extract<UrgeControlEvent, { status: "completed" }>;

export type UrgeControlState = {
  activeEvent: ActiveUrgeControlEvent | null;
  records: CompletedUrgeControlEvent[];
};
