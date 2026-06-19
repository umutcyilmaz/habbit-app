import type { ISODateString, UUID } from "./shared";

export interface SubscriptionState {
  id: UUID;
  userId: UUID;
  tier: "free" | "plus";
  status: "inactive" | "trialing" | "active" | "expired" | "unknown";
  provider?: "apple" | "google" | "stripe" | "none";
  currentPeriodEndsAt?: ISODateString;
  entitlementIds: string[];
  createdAt: ISODateString;
  updatedAt: ISODateString;
}
