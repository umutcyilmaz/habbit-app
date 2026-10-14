import { Redirect } from "expo-router";
import { practicePreviewEnabled } from "../../src/features/practice/practicePreviewMode";
import { PracticePreviewScreen } from "../../src/features/practice/PracticePreviewScreen";
export default function PracticePreviewRoute() {
  if (!practicePreviewEnabled) return <Redirect href="/" />;
  return <PracticePreviewScreen />;
}
