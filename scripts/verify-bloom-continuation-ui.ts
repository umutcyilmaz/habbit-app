import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import type { ResetContentFreeContinuationOffer } from "../src/domain/contentFree/getResetContentFreeCredit";

const ts: typeof import("typescript") = createRequire(resolve("package.json"))("typescript");
type Element = { type: unknown; props: Record<string, unknown> };
function nodes(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (value === null || typeof value !== "object" || !("props" in value)) return [];
  const element = value as Element;
  return [element, ...nodes(element.props.children)];
}
function renderFunction(path: string, name: string, feature: unknown, argument?: unknown) {
  const file = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fn = file.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === name);
  assert(fn !== undefined, `Missing actual UI function ${name}.`);
  const source = fn.getText(file).replace(/^export /, "");
  const module = { exports: {} as Record<string, (props: unknown) => unknown> };
  const jsx = (type: unknown, props: Record<string, unknown>) => ({ type, props });
  runInNewContext(ts.transpileModule(`export ${source}`, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX
  } }).outputText, {
    module, exports: module.exports, styles: {},
    AppCard: "AppCard", AppText: "AppText", AppButton: "AppButton", AppScreen: "AppScreen", View: "View",
    SaveStatus: "SaveStatus", ViolationHistory: "ViolationHistory", useContentFreeFeature: () => feature,
    require: (name: string) => { assert(name === "react/jsx-runtime", "UI extraction imports only JSX runtime."); return { jsx, jsxs: jsx }; }
  });
  return nodes(module.exports[name]!(argument));
}

// Render the actual screen branches; never manufacture label text in the test.
export function verifyBloomContinuationUi(offer: ResetContentFreeContinuationOffer) {
  const calls: unknown[] = [];
  const feature = { continuationOffer: offer, view: { kind: "completed", progress: { status: "inactive" } },
    busy: false, locked: false, actions: {
      decideContinuation: (decision: string) => calls.push(decision), openContinuation: () => calls.push("open")
    } };
  const reset = renderFunction("src/features/reset/screens/ResetProductScreen.tsx", "ResetContent", feature, { mode: "completion", feature });
  const accept = reset.find((entry) => entry.props.testID === "bloom.reset.content-free.accept");
  assert(accept?.props.label === offer.primaryLabel, "Reset CTA must use the canonical earned-credit label.");
  const displayed = reset.find((entry) => entry.props.testID === "bloom.reset.content-free.credit");
  assert(Array.isArray(displayed?.props.children) && displayed.props.children[0] === offer.completedDays,
    "Reset displays canonical completed credit days without screen arithmetic.");
  if (offer.completedDays < 15) assert(accept.props.label !== "15 günlük serimle devam et", "Short credit cannot claim a fifteen-day streak.");
  (accept.props.onPress as () => void)();
  const decline = reset.find((entry) => entry.props.testID === "bloom.reset.content-free.decline");
  assert(decline !== undefined, "Continuation must expose explicit decline.");
  (decline.props.onPress as () => void)();
  assert(calls[0] === "accepted" && calls[1] === "declined", "Both buttons dispatch semantic decisions to the acknowledged feature.");
  const content = renderFunction("src/features/content-free/screens/ContentFreeScreen.tsx", "ContentFreeScreen", feature);
  assert(content.some((entry) => entry.props.testID === "bloom.content-free.reset-continuation") &&
    !content.some((entry) => entry.props.testID === "bloom.content-free.activate"),
    "Direct Content-Free screen must replace ordinary activation with continuation guidance.");
  const open = content.find((entry) => entry.props.testID === "bloom.content-free.continuation.open");
  assert(open !== undefined, "Direct entry must provide a continuation route button.");
  (open.props.onPress as () => void)();
  assert(calls[2] === "open", "Direct entry opens the decision without silently accepting it.");
}
function assert(value: boolean, message: string): asserts value { if (!value) throw new Error(message); }
