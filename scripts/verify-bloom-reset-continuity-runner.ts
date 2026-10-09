import { verifyBloomResetContinuity } from "./verify-bloom-reset-continuity";
void verifyBloomResetContinuity().catch((error: unknown) => { console.error(error); process.exitCode = 1; });
