import { Redirect, useLocalSearchParams } from "expo-router";
import { urgePreviewEnabled } from "../../src/features/urge-control/preview/urgePreviewMode";
import { UrgePreviewScreen } from "../../src/features/urge-control/preview/UrgePreviewScreen";

export default function UrgeControlPreviewRoute() {
  const { fixture } = useLocalSearchParams<{ fixture?: string | string[] }>();
  if (!urgePreviewEnabled) return <Redirect href="/" />;
  return <UrgePreviewScreen key={fixture === "completion" ? "completion" : "standard"} completionFixture={fixture === "completion"} />;
}
