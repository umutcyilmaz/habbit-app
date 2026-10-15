import { Redirect } from "expo-router";
import { PracticeQaScreen } from "../../src/features/practice/qa/PracticeQaScreen";
import { practicePersistenceQaEnabled } from "../../src/features/practice/qa/practicePersistenceQa";
export default function PracticePersistenceQaRoute(){if(!practicePersistenceQaEnabled)return <Redirect href="/"/>;return <PracticeQaScreen/>;}
