import { Redirect } from "expo-router";
import { KegelFeatureScreen } from "../../src/features/kegel/screens/KegelFeatureScreen";
import { kegelPreviewEnabled } from "../../src/features/kegel/kegelPreviewMode";
import { kegelPersistenceQaEnabled } from "../../src/features/kegel/kegelPersistenceQa";
export default function KegelRoute() {
  // A memory-only design build must never claim a durable product save.
  if (kegelPreviewEnabled && !kegelPersistenceQaEnabled) return <Redirect href="/debug/kegel" />;
  return <KegelFeatureScreen />;
}
