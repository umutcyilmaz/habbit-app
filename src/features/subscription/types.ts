import type { SubscriptionState } from "../../domain/models";

export interface SubscriptionOfferPlaceholder {
  requiredTier: SubscriptionState["tier"];
  featureIds: string[];
}
