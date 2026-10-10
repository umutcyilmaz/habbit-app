import { Redirect } from "expo-router";
import { phase10QaEnabled } from "../../src/features/debug/phase10/phase10QaMode";
import { Phase10QaScreen } from "../../src/features/debug/phase10/Phase10QaScreen";

export default function Phase10QaRoute() {
  if (!phase10QaEnabled) return <Redirect href="/" />;
  return <Phase10QaScreen />;
}
