import { Redirect } from "expo-router";
import { kegelPersistenceQaEnabled } from "../../src/features/kegel/kegelPersistenceQa";
import { KegelFeatureScreen } from "../../src/features/kegel/screens/KegelFeatureScreen";
export default function KegelPersistenceQaRoute() {
  return kegelPersistenceQaEnabled ? <KegelFeatureScreen qa /> : <Redirect href="/" />;
}
