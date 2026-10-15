import { Redirect } from "expo-router";
import { PracticeHistoryScreen } from "../../../src/features/practice/PracticeHistoryScreen";
import { practicePreviewEnabled } from "../../../src/features/practice/practicePreviewMode";
import { practicePersistenceQaEnabled } from "../../../src/features/practice/qa/practicePersistenceQa";
export default function PracticeRoute() {
  if(practicePreviewEnabled&&!practicePersistenceQaEnabled)return <Redirect href="/debug/practice"/>;
  return <PracticeHistoryScreen/>;
}
