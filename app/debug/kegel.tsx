import { Redirect, useLocalSearchParams } from "expo-router";
import { kegelPreviewEnabled } from "../../src/features/kegel/kegelPreviewMode";
import { KegelPreviewScreen } from "../../src/features/kegel/screens/KegelPreviewScreen";

export default function KegelPreviewRoute() {
  const { scenario } = useLocalSearchParams<{ scenario?: string }>();
  if (!kegelPreviewEnabled) return <Redirect href="/" />;
  return <KegelPreviewScreen key={scenario ?? "intro"} scenario={scenario ?? "intro"} />;
}
