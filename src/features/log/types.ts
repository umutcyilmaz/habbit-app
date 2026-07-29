import type { BloomCheckInRecord } from "../../storage/bloomState";

export type LogDraft = Omit<BloomCheckInRecord, "id" | "createdAt">;
