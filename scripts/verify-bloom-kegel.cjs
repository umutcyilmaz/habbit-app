const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");

const root = resolve(__dirname, "..");
function evaluate(file, imports = {}, globals = {}) {
  const source = readFileSync(resolve(root, file), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } });
  const module = { exports: {} };
  runInNewContext(compiled.outputText, { module, exports: module.exports, require: name => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  }, ...globals }, { filename: file });
  return module.exports;
}
const config = evaluate("src/features/kegel/kegelConfig.ts");
const session = evaluate("src/features/kegel/kegelSession.ts", { "./kegelConfig": config });
const frame = session.getKegelFrame;
assert.equal(frame(-100).phase, "countdown");
assert.equal(frame(2999).secondsLeft, 1);
assert.equal(frame(3000).phase, "contract");
assert.equal(frame(5999).phase, "contract");
assert.equal(frame(6000).phase, "relax");
assert.equal(frame(6000).progress, 1);
assert.equal(frame(9000).repetition, 2);
assert.equal(frame(62999).phase, "relax", "Final relaxation must finish before completion");
assert.equal(frame(63000).phase, "completed");
assert.equal(frame(999999).repetition, 10);
const asymmetric = { repetitions: 2, countdownSeconds: 1, contractionSeconds: 2, relaxationSeconds: 4 };
assert.equal(frame(3000, asymmetric).phase, "relax");
assert.equal(frame(7000, asymmetric).repetition, 2);
assert.equal(frame(13000, asymmetric).phase, "completed");
const empty = session.createKegelPreviewData("empty");
for (const key of ["streak", "total", "week", "heat"]) assert.equal(empty[key], null);
assert.equal(session.createKegelPreviewData("design").kind, "design");
assert.notEqual(session.createKegelPreviewData("design"), session.createKegelPreviewData("design"));

for (const dev of [false, true]) for (const e2e of [false, true]) for (const bundle of [undefined, "com.umutcyilmaz.bloom", "com.umutcyilmaz.bloom.e2e"]) for (const flag of [undefined, "1", "true"]) {
  const mode = evaluate("src/features/kegel/kegelPreviewMode.ts", {
    "expo-constants": { default: { expoConfig: { ios: { bundleIdentifier: bundle } } } },
    "../../shared/runtime/e2eMode": { isE2EMode: e2e }
  }, { __DEV__: dev, process: { env: { EXPO_PUBLIC_KEGEL_PREVIEW: flag } } });
  assert.equal(mode.kegelPreviewEnabled, dev && e2e && bundle === "com.umutcyilmaz.bloom.e2e" && flag === "1");
}

// Execute the real hook with a deterministic monotonic clock and effect cleanup.
let now = 0, cursor = 0, pending = [], states = [], refs = [], effects = [], intervals = new Map(), nextId = 0, completed = 0, appStateListener;
const react = {
  useState(initial) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = typeof value === "function" ? value(states[i]) : value; }]; },
  useRef(initial) { const i = cursor++; return refs[i] ?? (refs[i] = { current: initial }); },
  useEffect(fn, deps) { const i = cursor++; const old = effects[i]; if (!old || deps.some((d, n) => d !== old.deps[n])) pending.push(() => { old?.cleanup?.(); effects[i] = { deps, cleanup: fn() }; }); }
};
const { useKegelExercise } = evaluate("src/features/kegel/useKegelExercise.ts", {
  react, "./kegelSession": session, "react-native": { AppState: { addEventListener(_, fn) { appStateListener = fn; return { remove() { appStateListener = undefined; } }; } } }
}, { performance: { now: () => now }, setInterval: fn => { const id = ++nextId; intervals.set(id, fn); return id; }, clearInterval: id => intervals.delete(id) });
const render = () => { cursor = 0; const value = useKegelExercise(() => completed++); const work = pending; pending = []; work.forEach(fn => fn()); return value; };
const tick = delta => { now += delta; [...intervals.values()].forEach(fn => fn()); return render(); };
let exercise = render();
exercise = tick(4200); assert.equal(exercise.frame.secondsLeft, 2);
exercise.pause(); exercise = render();
const pausedFrame = JSON.stringify(exercise.frame);
exercise = tick(20000); assert.equal(JSON.stringify(exercise.frame), pausedFrame);
exercise.resume(); exercise = render(); exercise = tick(1800);
assert.equal(exercise.frame.phase, "relax");assert.equal(exercise.frame.secondsLeft, 3);
appStateListener("background");exercise = render();assert.equal(exercise.paused, true);
tick(90000);assert.equal(completed, 0);
exercise.resume();render();tick(57000);assert.equal(completed, 1);
tick(10000);assert.equal(completed, 1, "Completion must fire once");
effects.forEach(effect => effect?.cleanup?.());assert.equal(intervals.size, 0);assert.equal(appStateListener, undefined);

const runtime = readFileSync(resolve(root, "src/features/kegel/kegelPreviewRuntime.ts"), "utf8");
assert(runtime.includes("createMemoryStorageClient()"));assert(!runtime.includes("storageClient"));
console.log("Kegel verification passed: timing boundaries, final relaxation, asymmetric editable config, truthful empty state, 36 preview guards, real-hook pause/resume/background/once-only completion and cleanup, memory-only runtime.");
