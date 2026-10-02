import type { ResetViolation } from "./ResetJourney";

// One intentional manual behavior uses the existing Reset semantic reasons.
export type BehaviorSlipReason = ResetViolation["reason"];
