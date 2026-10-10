import { getResetContentFreeContinuationOffer } from "../src/domain/contentFree/getResetContentFreeCredit";
import { getBloomContentFreeEntryIntent } from "../src/app/flows/getBloomContentFreeEntryIntent";
import { createResetContinuityFixture } from "./fixtures/resetContinuity";
import { completeElapsedResetPeriodState } from "../src/storage/bloomState";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";

import { getBloomHomeReadModel } from "../src/domain/home/getBloomHomeReadModel";
import { createDefaultBloomState, type BloomLocalState } from "../src/storage/bloomState";
import { createActiveState } from "./verify-bloom-reset-violations";
import { formatAverageInterval, formatErectionQuality, getTrackingSummary } from "../src/features/home/homePresentation";

const ts: typeof import("typescript") = createRequire(resolve("package.json"))("typescript");
const screenPath = "src/features/home/screens/BloomHomeScreen.tsx";
const hookPath = "src/features/home/useBloomHomeFeature.ts";
const at = "2026-09-04T12:00:00.000Z";
type Feature = Record<string, unknown>;
type Tree = { type: string | ((props: Record<string, unknown>) => Tree); props: Record<string, unknown> };

let currentFeature: Feature;
const screenSource = readFileSync(screenPath, "utf8");
const hookSource = readFileSync(hookPath, "utf8");
const compiled = ts.transpileModule(screenSource, { fileName: screenPath, compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX
} });
const module_ = { exports: {} as Record<string, unknown> };
const theme = {
  spacing: { xs2: 4, xs: 8, sm: 12, md: 16, lg: 20, xl: 24, layout: { navClearance: 88 } },
  colors: { border: { accent: "blue" }, accent: { primary: "blue" }, text: { primary: "white" }, bg: { surface: "dark", surfaceElevated: "gray" } },
  radius: { lg: 16, pill: 999 }, typography: { display: { fontFamily: "Inter" }, numericTimer: { fontSize: 32, lineHeight: 40 } }
};
const jsx = (type: Tree["type"], props: Record<string, unknown>): Tree => ({ type, props });
const required = (name: string): unknown => {
  if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
  if (name === "react-native") return { View: "View", StyleSheet: { create: (styles: unknown) => styles } };
  if (name.endsWith("/AppButton")) return { AppButton: "AppButton" };
  if (name.endsWith("/AppCard")) return { AppCard: "AppCard" };
  if (name.endsWith("/AppScreen")) return { AppScreen: "AppScreen" };
  if (name.endsWith("/AppText")) return { AppText: "AppText" };
  if (name.endsWith("/theme")) return { theme };
  if (name.endsWith("/homePresentation")) return { formatAverageInterval, formatErectionQuality,
    getBestContentFreeDays: (seconds: number) => Math.floor(seconds / 86400) };
  if (name.endsWith("/useBloomHomeFeature")) return { useBloomHomeFeature: () => currentFeature };
  throw new Error(`Unexpected screen import: ${name}`);
};
runInNewContext(compiled.outputText, { module: module_, exports: module_.exports, require: required }, { filename: screenPath });
const BloomHomeScreen = module_.exports.BloomHomeScreen as () => Tree;

function nodes(tree: unknown): Tree[] {
  if (tree == null || typeof tree === "boolean") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  if (typeof tree !== "object" || !("type" in tree)) return [];
  const entry = tree as Tree;
  return typeof entry.type === "function" ? nodes(entry.type(entry.props)) :
    [entry, ...nodes(entry.props.children)];
}
function textOf(tree: unknown): string {
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(textOf).join("");
  if (tree !== null && typeof tree === "object" && "props" in tree) return textOf((tree as Tree).props.children);
  return "";
}
function render(state: BloomLocalState, clock = at, activationOverrides: Partial<{
  busy: boolean; locked: boolean; canRetry: boolean; message: string | null;
}> = {}) {
  const model = getBloomHomeReadModel(state, clock);
  assert(model !== null, "Fixture must produce a Home read model.");
  const calls: unknown[] = [];
  const trackingActivation = { busy: false, locked: false, canRetry: false, message: null,
    enable: () => calls.push("enableTracking"), retry: () => calls.push("retryTracking"), ...activationOverrides };
  currentFeature = { hydrationStatus: "ready", model, tracking: getTrackingSummary(state.masturbationTracking, clock),
    contentFreeContinuation: getResetContentFreeContinuationOffer(state, state), contentFree: state.contentFree, openAction: (action: unknown) => calls.push(action),
    openContentFree: () => calls.push("contentFree"), openPanic: () => calls.push("panic"), trackingActivation };
  const entries = nodes(BloomHomeScreen());
  return { model, entries, calls,
    id: (id: string) => entries.find((entry) => entry.props.testID === id),
    text: () => entries.map((entry) => entry.type === "AppText" ? textOf(entry.props.children) : "").join(" "),
    press: (id: string) => {
      const button = entries.find((entry) => entry.props.testID === id);
      assert(button?.type === "AppButton" && typeof button.props.onPress === "function", `Missing action ${id}.`);
      (button.props.onPress as () => void)();
    }
  };
}
function base(tracking = true, content = false): BloomLocalState {
  const state = createDefaultBloomState();
  state.masturbationTracking.enabled = tracking;
  if (content) state.contentFree = { status: "active", activationId: "cf", activatedAt: "2026-09-01T00:00:00.000Z",
    currentStreakStartedAt: "2026-09-02T00:00:00.000Z", bestStreakSeconds: 42 * 86400, pastActivations: [], violations: [] };
  return state;
}
function session(index: number, erectionQuality: 6 | 8 = 6) {
  const day = String(index + 1).padStart(2, "0");
  return { status: "completed" as const, id: `s${index}`, startedAt: `2026-09-${day}T10:00:00.000Z`,
    endedAt: `2026-09-${day}T10:05:00.000Z`, durationSeconds: 300, pauses: [], erectionQuality,
    usedExplicitContent: false, endingReason: "climaxed" as const };
}
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

const empty = render(base());
assert(empty.id("bloom.home.tracking") && empty.id("bloom.home.content-free"), "Tracking and inactive Content-Free must both render.");
assert(empty.id("bloom.home.tracking.average-interval")?.props.children === "—" &&
  empty.id("bloom.home.tracking.erection-quality")?.props.children === "—", "Empty Tracking must show two dashes.");
assert(empty.id("bloom.home.tracking.action")?.props.label === "İlk kaydını ekle", "Empty Tracking must offer first record.");
empty.press("bloom.home.tracking.action");
assert((empty.calls[0] as { id: string }).id === "startMasturbationSession", "Tracking CTA must use the canonical Home action.");
assert(empty.id("bloom.home.content-free.action")?.props.label === "Sayacını başlat", "Inactive Content-Free must offer route entry.");
empty.press("bloom.home.content-free.action");
assert(empty.calls[1] === "contentFree", "Inactive Content-Free must navigate only.");

const populatedState = base();
populatedState.masturbationTracking.sessions = [session(0, 6), session(3, 8)];
const populated = render(populatedState);
assert(populated.id("bloom.home.tracking.average-interval")?.props.children === "3 gün" &&
  populated.id("bloom.home.tracking.erection-quality")?.props.children === "7/10", "Populated metrics must use completed history.");
assert(populated.id("bloom.home.tracking.action")?.props.label === "Oturum başlat", "Populated Tracking must offer ordinary start.");
const summary = getTrackingSummary(populatedState.masturbationTracking, at);
assert(summary.averageIntervalSeconds === 3 * 86400 && summary.averageErectionQuality === 7, "Summary arithmetic must be exact.");
const future = base();
future.masturbationTracking.sessions = [session(0), { ...session(4), endedAt: "2026-09-05T10:05:00.000Z" }];
assert(getTrackingSummary(future.masturbationTracking, at).completedSessionCount === 1,
  "Completed sessions ending after observation time must be excluded.");

const contentOnly = render(base(false, true));
assert(!contentOnly.id("bloom.home.tracking") && contentOnly.id("bloom.home.tracking.inactive") &&
  contentOnly.id("bloom.home.tracking.enable")?.props.label === "Takibi başlat" &&
  contentOnly.id("bloom.home.tracking.enable")?.props.variant === "secondary" &&
  contentOnly.id("bloom.home.content-free.current")?.props.children === 2,
  "Active Content-Free must retain its streak while offering optional Tracking activation.");
assert(contentOnly.entries.findIndex((n) => n.props.testID === "bloom.home.content-free") <
  contentOnly.entries.findIndex((n) => n.props.testID === "bloom.home.tracking.inactive"),
  "Active Content-Free must appear before optional Tracking activation.");
assert(contentOnly.text().includes("Bu takip, Content-Free sayacından bağımsız çalışır.") &&
  !contentOnly.text().includes("Content-Free serin etkilenmez"), "Inactive Tracking copy must apply even without a Content-Free streak.");
const noActivePlan = render(base(false, false));
assert(noActivePlan.text().includes("Bu takip, Content-Free sayacından bağımsız çalışır."),
  "Optional Tracking copy must also be accurate before Content-Free activation.");
contentOnly.press("bloom.home.tracking.enable");
assert(contentOnly.calls[0] === "enableTracking" && !contentOnly.id("bloom.home.tracking.action"),
  "Inactive Tracking enables permission without starting a session.");
assert(contentOnly.id("bloom.home.content-free.best") && contentOnly.text().includes("42 gün"), "Best streak must use completed days.");
contentOnly.press("bloom.home.content-free.action");
assert(contentOnly.calls[1] === "contentFree", "Active Content-Free management must navigate.");
const saving = render(base(false, true), at, { busy: true, locked: true });
assert(saving.id("bloom.home.tracking.enable")?.props.loading === true &&
  saving.id("bloom.home.tracking.enable")?.props.disabled === true && !saving.id("bloom.home.tracking.action"),
  "Pending activation shows saving and never offers a session action.");
const failed = render(base(false, true), at, { locked: true, canRetry: true, message: "Kaydetme henüz doğrulanmadı." });
assert(failed.id("bloom.home.tracking.activation-message") && failed.id("bloom.home.tracking.retry") &&
  !failed.id("bloom.home.tracking.enable") && !failed.id("bloom.home.tracking.action"),
  "Failed persistence shows feedback and only the safe retry action.");
failed.press("bloom.home.tracking.retry");
assert(failed.calls[0] === "retryTracking", "Failure retry uses its own handler without session navigation.");
const together = render(base(true, true));
assert(together.id("bloom.home.tracking") && together.id("bloom.home.content-free.current"), "Both active trackers must coexist.");
assert(together.entries.findIndex((n) => n.props.testID === "bloom.home.tracking") <
  together.entries.findIndex((n) => n.props.testID === "bloom.home.content-free"), "Ordinary Home shows Tracking before Content-Free.");

const resetState = createActiveState(false, true);
resetState.masturbationTracking.enabled = true;
resetState.urgeControl.activeEvent = null;
const reset = render(resetState, "2026-09-03T12:00:00.000Z");
assert(reset.model.primaryAction?.id === "viewActiveReset" && reset.id("bloom.home.reset") &&
  reset.id("bloom.home.tracking") && reset.id("bloom.home.content-free"), "Active Reset keeps both tracker contexts.");
assert(reset.entries.findIndex((n) => n.props.testID === "bloom.home.reset") <
  reset.entries.findIndex((n) => n.props.testID === "bloom.home.content-free") &&
  reset.entries.findIndex((n) => n.props.testID === "bloom.home.content-free") <
  reset.entries.findIndex((n) => n.props.testID === "bloom.home.tracking"), "Reset composition order must match reference.");
assert(reset.text().includes("Reset boyunca beklemede") && !reset.id("bloom.home.tracking.action") &&
  resetState.masturbationTracking.enabled, "Reset restrains Tracking presentation without changing enabled state.");
reset.press("bloom.home.reset.action");
assert((reset.calls[0] as { id: string }).id === "viewActiveReset", "Reset action must retain canonical identity.");
reset.press("bloom.home.panic");
assert(reset.calls[1] === "panic" && reset.entries.filter((n) => n.props.testID === "bloom.home.panic").length === 1,
  "Reset Home must expose exactly one Panic entry.");
const disabledResetState = createActiveState(false, true);
disabledResetState.masturbationTracking.enabled = false;
disabledResetState.urgeControl.activeEvent = null;
const disabledReset = render(disabledResetState, "2026-09-03T12:00:00.000Z");
assert(!disabledReset.id("bloom.home.tracking.inactive") && !disabledReset.id("bloom.home.tracking.enable") &&
  !disabledReset.id("bloom.home.tracking.action"), "Active Reset must not offer Tracking activation or a new session.");

const activeSession = base();
activeSession.masturbationTracking.currentSession = { id: "active", status: "active", startedAt: "2026-09-04T11:00:00.000Z", pauses: [] };
const activeView = render(activeSession);
assert(activeView.model.primaryAction?.id === "resumeMasturbationSession" && activeView.text().includes("Devam eden oturum") &&
  !activeView.id("bloom.home.tracking.action"), "Active session must suppress new session start.");
activeView.press("bloom.home.primary.action");
assert((activeView.calls[0] as { sessionId: string }).sessionId === "active", "Resume must preserve session ID.");
const feedbackState = base();
feedbackState.masturbationTracking.currentSession = { id: "feedback", status: "awaiting_feedback", startedAt: "2026-09-04T10:00:00.000Z",
  endedAt: "2026-09-04T10:05:00.000Z", durationSeconds: 300, pauses: [] };
const feedback = render(feedbackState);
assert(feedback.model.primaryAction?.id === "finishMasturbationSessionFeedback" && feedback.text().includes("Oturum geri bildirimi bekliyor") &&
  !feedback.id("bloom.home.tracking.action"), "Awaiting feedback must suppress new session start.");
const urgeState = base();
urgeState.urgeControl.activeEvent = { id: "urge", flowVersion: 2, status: "active", startedAt: "2026-09-04T11:00:00.000Z" };
const urge = render(urgeState);
assert(urge.model.primaryAction?.id === "resumeUrgeControl" && urge.text().includes("Devam eden dürtü kontrolü"), "Active Urge gets primary continuation.");
urge.press("bloom.home.primary.action");
assert((urge.calls[0] as { eventId: string }).eventId === "urge", "Urge action must retain event ID.");

const baselineState = base();
baselineState.resetJourney = { ...baselineState.resetJourney, status: "baseline_pending", id: "pending" };
const baseline = render(baselineState);
assert(baseline.model.primaryAction?.id === "completeResetBaseline" && baseline.text().includes("Reset başlangıç soruları hazır"), "Baseline pending gets primary CTA.");
const elapsed = render(resetState, "2026-09-16T12:00:00.000Z");
assert(elapsed.model.primaryAction?.id === "recordResetElapsedCompletion" && elapsed.text().includes("15 gün tamamlandı") &&
  !elapsed.id("bloom.home.reset"), "Elapsed Reset requests completion without displaying an active Reset clock.");
elapsed.press("bloom.home.primary.action");
assert((elapsed.calls[0] as { id: string }).id === "recordResetElapsedCompletion", "Elapsed CTA navigates with canonical action.");

const startingState = base();
const accepted = createActiveState(false, false).productOnboarding;
assert(accepted.status === "completed", "Starting recommendation fixture required.");
startingState.productOnboarding = { ...accepted, planAcceptance: null };
const starting = render(startingState);
assert(starting.model.primaryAction?.id === "reviewStartingRecommendation" && starting.text().includes("Başlangıç önerin hazır"), "Unaccepted starting recommendation gets primary CTA.");
const persistedState = base();
persistedState.resetJourney = { ...persistedState.resetJourney, status: "recommended", id: "recommended" };
const persisted = render(persistedState);
assert(persisted.model.primaryAction?.id === "reviewResetRecommendation" && persisted.text().includes("Reset önerin hazır"), "Persisted recommendation gets primary CTA.");

const advisedState = base();
advisedState.masturbationTracking.sessions = Array.from({ length: 6 }, (_, index) => ({ ...session(index),
  erectionQuality: (index < 3 ? 9 : 6) as 6 | 9,
  usedExplicitContent: index >= 3, endingReason: index < 3 ? "climaxed" as const : "firmnessDecreased" as const }));
const advised = render(advisedState, "2026-09-20T12:00:00.000Z");
assert(advised.model.primaryAction?.id === "startMasturbationSession" && advised.model.resetRecommendationAction !== null &&
  advised.id("bloom.home.tracking.action") && advised.id("bloom.home.reset-recommendation.action"),
  "Optional derived Reset advice must coexist with ordinary Tracking.");
advised.press("bloom.home.reset-recommendation.action");
assert((advised.calls[0] as { id: string }).id === "reviewResetRecommendation", "Optional advice must navigate by semantic action.");

const continuityFixture = createResetContinuityFixture();
const pendingReset = completeElapsedResetPeriodState(continuityFixture.state, { observedAt: continuityFixture.observeDays(20) });
const pendingHome = render(pendingReset, continuityFixture.observeDays(20));
assert(pendingHome.id("bloom.home.content-free.action")?.props.label === "Reset serinle devam et" && !pendingHome.text().includes("Sayacını başlat"),
  "Home's inactive Content-Free card must guide to continuation while the decision is pending.");
assert(getBloomContentFreeEntryIntent(pendingReset, continuityFixture.observeDays(20)).flow === "resetCompletion",
  "The Home Content-Free entry intent must preserve the acknowledged continuation route.");
assert(hookSource.includes("getBloomContentFreeEntryIntent(durableState, (now ?? readSystemTime)().toISOString())"),
  "Home must use the durable continuation-aware entry intent and scoped clock for its Content-Free action.");

currentFeature = { hydrationStatus: "loading", model: null };
assert(nodes(BloomHomeScreen()).some((n) => n.props.testID === "bloom.home.loading"), "Pending hydration gets loading state.");
currentFeature = { hydrationStatus: "ready", model: null };
assert(nodes(BloomHomeScreen()).some((n) => n.props.testID === "bloom.home.unavailable"), "Null composition gets unavailable state.");
assert(hookSource.includes("getBloomHomeReadModel(durableState, observationTime)") &&
  hookSource.includes("mapBloomHomeActionToFlowIntent(action)") && hookSource.includes("navigateBloomProductFlow(router,") &&
  hookSource.includes("activationController.enable(durableState.masturbationTracking)") &&
  !hookSource.includes("getNextBloomAction"),
  "Home hook must read durable product facts, activate through the controller, and navigate canonical actions.");
assert(!screenSource.includes("14 gün sonra") && !screenSource.includes("remainingSeconds") &&
  !screenSource.includes("tracking.disable"), "Home cannot promise automatic remeasurement, show seconds, or disable Tracking.");
console.log("Bloom Home UI verification passed (inactive activation, saving/retry feedback, presentation metrics, card ordering, semantic actions, hydration, and durable hook wiring).");
