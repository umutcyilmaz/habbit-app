import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import {
  createBloomProductFlowActions,
  type BloomProductFlowActions
} from "../src/app/flows/bloomProductFlowActions";
import {
  createBloomProductAcknowledgedActions,
  type BloomProductAcknowledgedActions
} from "../src/app/providers/bloomProductAcknowledgedActions";
import type { BloomPersistedMutationResult } from "../src/app/providers/bloomLocalStateMutationRuntime";

// The persistence runner compiles into a temporary directory without JSX.
// Resolve its already-installed compiler from the repository, and evaluate only
// this small hook module with local imports rather than loading provider TSX.
const ts: typeof import("typescript") = createRequire(resolve("package.json"))("typescript");
const hookPath = "src/app/flows/useBloomProductFlowActions.ts";
const at = "2026-11-01T12:00:00.123Z";

export async function verifyBloomProductReactFlows() {
  const source = readFileSync(hookPath, "utf8");
  verifyHookStructure(source);
  await verifyHookDependencyWiring(source);
  console.log("Bloom React product-flow adapter verification passed (actual hook dependency wiring, stable command memoization, no provider-state reads, deferred fact generation, and acknowledgement identity). This uses a controlled hook harness, not a mounted React renderer.");
}

function verifyHookStructure(source: string) {
  const parsed = ts.createSourceFile(hookPath, source, ts.ScriptTarget.ES2020, true, ts.ScriptKind.TS);
  const imports = parsed.statements.filter(ts.isImportDeclaration).map((node) => {
    assert(ts.isStringLiteral(node.moduleSpecifier), "Hook imports must use explicit module paths.");
    return node.moduleSpecifier.text;
  });
  const allowed = ["react", "../providers/BloomLocalStateProvider", "./bloomProductFlowActions"];
  assert(imports.length === allowed.length && imports.every((module) => allowed.includes(module)),
    "The React adapter must depend only on React memoization, provider commands, and the existing flow factory.");
  const hook = parsed.statements.find((node): node is import("typescript").FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === "useBloomProductFlowActions");
  assert(hook !== undefined && hook.parameters.length === 0 && hook.type?.getText(parsed) === "BloomProductFlowActions",
    "The public adapter must return the existing grouped flow API without additional inputs or parallel signatures.");
  assert(hook.body?.statements.length === 2, "The hook must only obtain productActions and return the memoized factory result.");
  const bindingStatement = hook.body.statements[0]!;
  assert(ts.isVariableStatement(bindingStatement), "The hook must obtain provider commands through a local binding.");
  const binding = bindingStatement.declarationList.declarations[0];
  assert(binding !== undefined && ts.isObjectBindingPattern(binding.name) && binding.name.elements.length === 1 &&
    binding.name.elements[0]!.name.getText(parsed) === "productActions" &&
    binding.initializer !== undefined && ts.isCallExpression(binding.initializer) &&
    binding.initializer.expression.getText(parsed) === "useBloomLocalState",
  "Only productActions may be destructured from the provider; product state must remain outside the adapter.");
  const returned = hook.body.statements[1]!;
  assert(ts.isReturnStatement(returned) && returned.expression !== undefined && ts.isCallExpression(returned.expression),
    "The adapter must return one memoized flow-factory construction.");
  const memo = returned.expression;
  assert(memo.expression.getText(parsed) === "useMemo" && memo.arguments.length === 2,
    "Flow actions must be memoized with an explicit dependency list.");
  const dependencies = memo.arguments[1]!;
  assert(ts.isArrayLiteralExpression(dependencies) && dependencies.elements.length === 1 &&
    dependencies.elements[0]!.getText(parsed) === "productActions",
  "Only the acknowledged command reference may invalidate flow-action memoization.");
  const calls: string[] = [];
  const inspect = (node: import("typescript").Node) => {
    if (ts.isCallExpression(node)) calls.push(node.expression.getText(parsed));
    assert(!ts.isNewExpression(node), "The adapter must not instantiate clocks, IDs, persistence, or navigation helpers.");
    ts.forEachChild(node, inspect);
  };
  inspect(parsed);
  assert(calls.length === 3 && calls.includes("useBloomLocalState") && calls.includes("useMemo") &&
    calls.includes("createBloomProductFlowActions"),
  "The adapter must contain no additional selector, fact-generation, mutation, or navigation calls.");
}

async function verifyHookDependencyWiring(source: string) {
  const first = productSpy();
  const second = productSpy();
  let currentContext = providerContext(first.actions, 1);
  let providerReads = 0;
  let factoryBuilds = 0;
  let clockCalls = 0;
  let idCalls = 0;
  const dependencySnapshots: unknown[][] = [];
  let priorDependencies: readonly unknown[] | undefined;
  let memoized: unknown;

  // This models dependency comparison only. It verifies how the actual hook
  // calls useMemo; it does not re-test React's rendering/memo implementation.
  const useMemo = <T>(build: () => T, dependencies: readonly unknown[]): T => {
    dependencySnapshots.push(Array.from(dependencies));
    if (priorDependencies === undefined || dependencies.length !== priorDependencies.length ||
      dependencies.some((value, index) => !Object.is(value, priorDependencies![index]))) {
      memoized = build();
      priorDependencies = Array.from(dependencies);
    }
    return memoized as T;
  };
  const factory = (options: Parameters<typeof createBloomProductFlowActions>[0]) => {
    factoryBuilds++;
    assert(Object.keys(options).length === 1 && options.productActions === currentContext.productActions,
      "The hook must pass only the provider's existing productActions to the Phase 1Q factory.");
    return createBloomProductFlowActions({
      ...options,
      now: () => { clockCalls++; return new Date(at); },
      createId: (prefix) => { idCalls++; return `${prefix}-react-test-${idCalls}`; }
    });
  };
  const compiled = ts.transpileModule(source, {
    fileName: hookPath,
    reportDiagnostics: true,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, strict: true }
  });
  assert(!(compiled.diagnostics ?? []).some((entry) => entry.category === ts.DiagnosticCategory.Error),
    "The actual hook must transpile independently of provider TSX.");
  const module = { exports: {} as Record<string, unknown> };
  const localRequire = (specifier: string): unknown => {
    if (specifier === "react") return { useMemo };
    if (specifier === "../providers/BloomLocalStateProvider") return {
      useBloomLocalState: () => { providerReads++; return currentContext; }
    };
    if (specifier === "./bloomProductFlowActions") return { createBloomProductFlowActions: factory };
    throw new Error(`Unexpected React adapter dependency: ${specifier}`);
  };
  runInNewContext(compiled.outputText, { module, exports: module.exports, require: localRequire }, { filename: hookPath });
  const useFlow = module.exports.useBloomProductFlowActions as () => BloomProductFlowActions;
  assert(typeof useFlow === "function", "The actual module must export the product-flow hook.");
  assert(providerReads === 0 && factoryBuilds === 0 && clockCalls === 0 && idCalls === 0,
    "Importing the adapter must not read provider state, construct flows, or generate facts.");

  const initialFlow = useFlow();
  assert(Number(providerReads) === 1 && Number(factoryBuilds) === 1, "The first render must obtain commands and build one flow object.");
  assert(initialFlow.tracking.enable === first.actions.tracking.enable,
    "The hook must expose the factory result, preserving existing direct command aliases.");
  currentContext = providerContext(first.actions, 2);
  const unchangedCommands = useFlow();
  assert(unchangedCommands === initialFlow && Number(factoryBuilds) === 1,
    "A new provider context with unrelated state changes must retain the same flow-actions reference.");
  assert(unchangedCommands.tracking.session.start === initialFlow.tracking.session.start &&
    unchangedCommands.urgeControl === initialFlow.urgeControl,
  "Nested flow methods and groups must remain stable when productActions is stable.");
  currentContext = providerContext(second.actions, 3);
  const replacementFlow = useFlow();
  assert(replacementFlow !== initialFlow && Number(factoryBuilds) === 2,
    "Replacing the acknowledged command object must rebuild flow actions rather than retain stale command closures.");
  assert(dependencySnapshots.length === 3 && dependencySnapshots.every((entries) => entries.length === 1) &&
    dependencySnapshots[0]![0] === first.actions && dependencySnapshots[1]![0] === first.actions && dependencySnapshots[2]![0] === second.actions,
  "The actual useMemo calls must depend solely on the current provider command reference.");
  assert(clockCalls === 0 && idCalls === 0 && first.calls.length === 0 && second.calls.length === 0,
    "Mounting and rerendering the adapter must not generate identities/timestamps, invoke commands, or navigate.");

  const pending = replacementFlow.tracking.session.start();
  assert(pending === second.acknowledgement.promise && Number(second.calls.length) === 1 && first.calls.length === 0,
    "A flow invocation after command replacement must use the latest productActions and preserve its exact Promise.");
  const input = second.calls[0]!;
  assert(input.sessionId === "masturbation-session-react-test-1" && input.startedAt === at &&
    Number(clockCalls) === 1 && Number(idCalls) === 1,
  "The existing Phase 1Q factory must generate the one session ID/time only at explicit flow invocation.");
  const result: BloomPersistedMutationResult = {
    ok: false, accepted: true, persisted: false, sequence: 91,
    reason: "persistenceInvalidated", retryable: false
  };
  second.acknowledgement.resolve(result);
  assert(await pending === result, "The React adapter must not transform acknowledgement outcomes or fabricate success.");
  currentContext = providerContext(second.actions, 4);
  assert(useFlow() === replacementFlow && Number(factoryBuilds) === 2 && Number(clockCalls) === 1 && Number(idCalls) === 1,
    "Acknowledgement-related provider updates must not rebuild flow actions or regenerate facts.");
}

function providerContext(productActions: BloomProductAcknowledgedActions, revision: number) {
  const target = { productActions, state: { revision }, durableState: { revision: revision - 1 }, persistenceError: null };
  return new Proxy(target, {
    get(object, property) {
      if (property !== "productActions") throw new Error(`React flow hook read unrelated provider property: ${String(property)}`);
      return object.productActions;
    },
    ownKeys() { throw new Error("React flow hook enumerated the full provider context."); }
  });
}

function productSpy() {
  const acknowledgement = deferred<BloomPersistedMutationResult>();
  const calls: Array<{ sessionId: string; startedAt: string }> = [];
  const base = createBloomProductAcknowledgedActions({
    applyAcknowledgedMutation: async () => { throw new Error("Render must not dispatch any product mutation."); }
  });
  const actions: BloomProductAcknowledgedActions = {
    ...base,
    tracking: {
      ...base.tracking,
      session: {
        ...base.tracking.session,
        start: (input) => { calls.push(input); return acknowledgement.promise; }
      }
    }
  };
  return { actions, calls, acknowledgement };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => { resolve = complete; });
  return { promise, resolve };
}
function assert(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}
