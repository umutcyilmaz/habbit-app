import type { ISODateString, UUID } from "./shared";

export interface Insight {
  id: UUID;
  userId: UUID;
  type: "sensitiveWindow" | "commonMoment" | "pauseHelped" | "rushingPattern" | "exercisePattern";
  title: string;
  body: string;
  evidenceRangeStart: ISODateString;
  evidenceRangeEnd: ISODateString;
  relatedRecordIds: UUID[];
  confidence: "low" | "medium" | "high";
  status: "new" | "seen" | "dismissed" | "saved";
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
