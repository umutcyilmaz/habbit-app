import { useRef, useState } from "react";
import { useRouter } from "expo-router";
import { View } from "react-native";
import { useBloomLocalState } from "../../../app/providers/BloomLocalStateProvider";
import { bloomProductRoutePaths } from "../../../app/navigation/bloomProductRoutes";
import { routes } from "../../../constants/navigation";
import { getResetContentFreeContinuationOffer } from "../../../domain/contentFree/getResetContentFreeCredit";
import { getContentFreeProgress } from "../../../domain/contentFree/getContentFreeProgress";
import { AppScreen } from "../../../shared/components/v4/AppScreen";
import { AppText } from "../../../shared/components/v4/AppText";
import { AppButton } from "../../../shared/components/v4/AppButton";
import { usePhase10QaSession } from "./Phase10QaProvider";
import { phase10Scenarios, type Phase10ScenarioId } from "./phase10QaSession";

export function Phase10QaScreen() {
  const qa = usePhase10QaSession();
  const router = useRouter();
  const { state, durableState, hasHydrated, retryHydration } = useBloomLocalState();
  const inFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!qa) return null;
  const reset = durableState.resetJourney;
  const offer = getResetContentFreeContinuationOffer(durableState, durableState);
  const content = getContentFreeProgress(durableState.contentFree, qa.runtime.now().toISOString());
  const run = async (scenario?: Phase10ScenarioId, beforeCompletion = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      if (scenario) await qa.prepareScenario(scenario, beforeCompletion);
      await retryHydration();
    } catch { setMessage("QA setup or reload failed. No success was confirmed. Try again."); }
    finally { inFlight.current = false; setBusy(false); }
  };
  const openReset = () => {
    if (reset.status !== "active" && reset.status !== "completed") return;
    router.push({ pathname: reset.status === "completed" ? bloomProductRoutePaths.resetCompletion : bloomProductRoutePaths.resetProgress,
      params: { journeyId: reset.id, attemptId: reset.currentAttempt.id } });
  };
  return (
    <AppScreen testID="bloom.qa.phase10" scroll contentContainerStyle={{ gap: 16, paddingBottom: 32 }}>
      <AppText variant="heading1">Phase 10 · isolated QA</AppText>
      <AppText tone="secondary">Synthetic clock + private E2E storage. Scenario buttons replace only this QA save. All screen buttons use real acknowledged actions.</AppText>
      <AppText testID="bloom.qa.phase10.clock">Clock: {qa.runtime.now().toISOString()}</AppText>
      <AppText testID="bloom.qa.phase10.state">Reset: {reset.status} · Content-Free: {durableState.contentFree.status} · Days: {content?.status === "active" ? content.currentCompletedDays : 0} · Decision: {reset.status === "completed" ? reset.contentFreeContinuation?.decision ?? (offer ? "pending" : "not offered") : "n/a"}</AppText>
      {message ? <AppText tone="danger">{message}</AppText> : null}
      <View style={{ gap: 8 }}>
        {phase10Scenarios.map((scenario) => <AppButton key={scenario.id} testID={`bloom.qa.phase10.${scenario.id}`} label={scenario.label} disabled={busy || !hasHydrated} onPress={() => { void run(scenario.id); }} />)}
      </View>
      <AppButton testID="bloom.qa.phase10.before-completion" label="3 · Prepare before completion button" variant="secondary" disabled={busy || !hasHydrated} onPress={() => { void run("completed-pending", true); }} />
      <AppButton testID="bloom.qa.phase10.reset" label="Open real Reset screen" disabled={busy || !hasHydrated || (reset.status !== "active" && reset.status !== "completed")} onPress={openReset} />
      <AppButton testID="bloom.qa.phase10.content-free" label="Open real Content-Free screen" disabled={busy || !hasHydrated} onPress={() => router.push(bloomProductRoutePaths.contentFree)} />
      <AppButton testID="bloom.qa.phase10.home" label="Open real Home" disabled={busy || !hasHydrated} onPress={() => router.push(routes.home)} />
      <AppButton testID="bloom.qa.phase10.reload" label="Reload saved QA state (no reseed)" variant="secondary" disabled={busy || !hasHydrated || state !== durableState} onPress={() => { void run(); }} />
      <AppButton testID="bloom.qa.phase11.invalidate-save" label="Invalidate next QA save once" variant="ghost" disabled={busy || !hasHydrated} onPress={() => { qa.invalidateNextSave(); setMessage("Next QA receipt will be invalidated. Open a screen and use Save current state to recover."); }} />
      <AppButton testID="bloom.qa.phase10.fail-save" label="Fail next QA save once" variant="ghost" disabled={busy || !hasHydrated} onPress={() => { qa.failNextSave(); setMessage("Next QA write will fail. Open a screen, act, then use its real retry button."); }} />
    </AppScreen>
  );
}
