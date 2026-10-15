import { Redirect } from "expo-router";
import { PracticeFeatureScreen } from "../../../src/features/practice/PracticeFeatureScreen";
import { practicePreviewEnabled } from "../../../src/features/practice/practicePreviewMode";
import { practicePersistenceQaEnabled } from "../../../src/features/practice/qa/practicePersistenceQa";
export default function PracticeRoute() {
  if(practicePreviewEnabled&&!practicePersistenceQaEnabled)return <Redirect href="/debug/practice"/>;
  return <PracticeFeatureScreen/>;
}
