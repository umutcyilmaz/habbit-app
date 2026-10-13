// Execute the actual screen functions with controlled hooks/providers. No device storage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = (type, props) => ({ type, props: props || {} });
const runtime = { jsx, jsxs: jsx, Fragment: 'Fragment' };
const elements = tree => {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(elements);
  return [tree, ...elements(tree.props?.children)];
};
function evaluate(file, imports, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(output, { ...globals, module, exports: module.exports, require: name => {
    if (!(name in imports)) throw new Error(`Unexpected dependency: ${name}`);
    return imports[name];
  }});
  return module.exports;
}
async function run() {
  let cursor = 0, values = [], cleanup, alert, calls = 0, resolve, recoveryCalls = 0;
  let status = 'idle', error = null;
  const hooks = {
    useState(initial) { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], value => { values[index] = value; }]; },
    useRef(initial) { const index = cursor++; return values[index] ?? (values[index] = { current: initial }); },
    useCallback: callback => callback,
  };
  const imports = {
    react: hooks, 'react/jsx-runtime': runtime,
    'expo-router': { useFocusEffect: callback => { if (!cleanup) cleanup = callback(); } },
    'react-native': { Alert: { alert: (...args) => { alert = args; } }, Pressable: 'Pressable', View: 'View' },
    '../../../app/providers/LocalDataLifecycleProvider': { useLocalDataLifecycle: () => ({ deletionStatus: status, deletionError: error,
      deleteAllLocalData: () => { calls++; return new Promise(r => { resolve = r; }); }, retryBloomLocalDataResetNavigation: () => recoveryCalls++ }) },
    '../../../shared/components/v4/AppButton': { AppButton: 'AppButton' },
    '../../../shared/components/v4/AppText': { AppText: 'AppText' },
    '../components/SettingsPrimitives': { SettingsGroup: 'Group', SettingsNote: 'Note', SettingsPage: 'Page', SettingsRow: 'Row', settingsStyles: {} },
  };
  const { DataControlsScreen } = evaluate('src/features/settings/screens/DataControlsScreen.tsx', imports);
  const render = () => { cursor = 0; return elements(DataControlsScreen()); };
  const byId = id => render().find(node => node.props.testID === `bloom.settings.${id}`);
  assert(!byId('delete-confirmation'));
  byId('delete-open').props.onPress();
  assert(byId('delete-confirmation'));
  const hold = byId('delete-hold');
  assert.equal(hold.props.delayLongPress, 2000);
  hold.props.onPressIn(); hold.props.onPressOut();
  assert.equal(calls, 0, 'Short touch/release must not delete');
  byId('delete-cancel').props.onPress();
  hold.props.onLongPress(); assert.equal(calls, 0, 'Stale hold cannot submit after cancellation');
  byId('delete-open').props.onPress();
  byId('delete-accessible').props.onPress();
  assert(alert[1].includes('geri alınamaz'));
  assert.equal(calls, 0, 'Opening explicit accessibility confirmation cannot delete');
  const alertSubmit = alert[2].find(button => button.style === 'destructive').onPress;
  byId('delete-cancel').props.onPress(); alertSubmit();
  assert.equal(calls, 0, 'Late Alert callback cannot delete after cancellation');
  byId('delete-open').props.onPress(); render();
  cleanup(); cleanup = () => {};
  byId('delete-hold').props.onLongPress(); assert.equal(calls, 0, 'Unfocused screen cannot submit');
  cleanup = null; render();
  const submit = byId('delete-hold').props.onLongPress;
  submit(); submit(); assert.equal(calls, 1, 'Synchronous repeated events share one request');
  status = 'deleting';
  assert(byId('delete-hold').props.disabled);
  assert(byId('delete-pending')); assert(!byId('delete-success'));
  resolve(); await new Promise(r => setImmediate(r));
  assert(!byId('delete-success'), 'Promise resolution alone cannot show success');
  status = 'error'; error = 'Deletion is still unconfirmed';
  assert(byId('delete-error')); assert(!byId('delete-success'));
  const errorTexts = elements(byId('delete-error')).filter(node => node.type === 'AppText');
  assert.equal(errorTexts.length, 1, 'Unconfirmed deletion must present one Turkish error message');
  assert(errorTexts[0].props.children.includes('Silme doğrulanamadı'));
  assert(!render().some(node => node.props.children === error), 'Coordinator error must not appear verbatim');
  byId('delete-accessible').props.onPress();
  alert[2].find(button => button.style === 'destructive').onPress();
  assert.equal(calls, 2, 'Retry uses existing lifecycle command');
  resolve(); await new Promise(r => setImmediate(r));
  status = 'success'; error = 'Navigation failed';
  assert(byId('delete-success'));
  const recoveryTexts = elements(byId('delete-success')).filter(node => node.type === 'AppText');
  assert.equal(recoveryTexts.length, 1, 'Confirmed deletion with navigation failure must present one distinct Turkish message');
  assert(recoveryTexts[0].props.children.includes('silindiği doğrulandı, ancak başlangıç kurulumu açılamadı'));
  assert(!byId('delete-error'), 'Navigation failure must not imply deletion is unconfirmed');
  assert(!render().some(node => node.props.children === error));
  assert(byId('delete-hold').props.disabled);
  render().find(node => node.props.label === 'Başlangıç kurulumunu tekrar aç').props.onPress();
  assert.equal(recoveryCalls, 1); assert.equal(calls, 2, 'Navigation recovery must not re-delete');
  error = null;
  const successTexts = elements(byId('delete-success')).filter(node => node.type === 'AppText');
  assert.equal(successTexts.length, 1);
  assert.equal(successTexts[0].props.children, 'Yerel verilerin silindiği doğrulandı. Başlangıç kurulumu açılıyor.');
  assert(!render().some(node => node.props.label === 'Başlangıç kurulumunu tekrar aç'));
  cleanup(); cleanup = null; values = []; status = 'error';
  assert(byId('delete-error')); assert(byId('delete-confirmation'), 'Error survives revisit with retry confirmation');
  const changedScreens = ['SettingsHome', 'PrivacyOverview', 'DataControls', 'NotificationSettings', 'AppLockSettings', 'SubscriptionSettings'];
  for (const screen of changedScreens) {
    const source = fs.readFileSync(`src/features/settings/screens/${screen}Screen.tsx`, 'utf8');
    assert(!source.includes('DemoAppStateProvider'), `${screen} must not present demo preferences as product settings`);
    assert(!source.includes('router.push(routes.settings)'), 'Back must not push duplicate Settings');
  }

  // Evaluate the real QA adapter: fault injection cannot activate for product/release builds.
  const prefix = 'bloom.e2e.kegel.settings_unit_20261013.';
  for (const [dev,e2e,bundle,flag,runName,enabled] of [
    [true,true,'com.umutcyilmaz.bloom.e2e','1','settings_unit_20261013',true],
    [false,true,'com.umutcyilmaz.bloom.e2e','1','settings_unit_20261013',false],
    [true,false,'com.umutcyilmaz.bloom.e2e','1','settings_unit_20261013',false],
    [true,true,'com.umutcyilmaz.bloom','1','settings_unit_20261013',false],
    [true,true,'com.umutcyilmaz.bloom.e2e','0','settings_unit_20261013',false],
    [true,true,'com.umutcyilmaz.bloom.e2e','1','',false],
  ]) {
    const removed = [], rawKeys = [prefix+'bloom.v8', 'bloom.v8', 'bloom.e2e.kegel.previous.bloom.v8'];
    const constants = { default: { expoConfig: { ios: { bundleIdentifier: bundle } } } };
    const globals = { __DEV__:dev, process:{env:{EXPO_PUBLIC_KEGEL_QA_RUN:runName,EXPO_PUBLIC_KEGEL_PERSISTENCE_QA:flag,EXPO_PUBLIC_SETTINGS_DELETE_QA:'fail-once'}} };
    const mode = evaluate('src/features/kegel/kegelPreviewMode.ts', {'expo-constants':constants,'../../shared/runtime/e2eMode':{isE2EMode:e2e}},globals);
    let storage;
    const adapter = evaluate('src/features/kegel/kegelPersistenceQa.ts', {
      'expo-constants':constants, '../../shared/runtime/e2eMode':{isE2EMode:e2e}, './kegelPreviewMode':mode,
      '../../storage/storageClient': { storageClient: { getItem:async()=>null,setItem:async()=>{},getAllKeys:async()=>rawKeys,removeItem:async key=>{removed.push(key);} } },
      '../../storage/bloomStatePersistence': { createBloomStatePersistenceCoordinator: client => { storage=client;return {load:()=>{},enqueueWrite:()=>{},deleteAll:()=>{}}; } },
    },globals);
    assert.equal(adapter.kegelPersistenceQaEnabled,enabled);
    if (enabled) {
      assert.equal((await storage.getAllKeys()).join('|'),'bloom.v8');
      await assert.rejects(storage.removeItem('bloom.v8'),/Isolated Settings QA/);
      assert.equal(removed.length,0);
      await storage.removeItem('bloom.v8');
      assert.equal(removed.join('|'),prefix+'bloom.v8');
    } else {
      await storage.removeItem('bloom.v8');
      assert.equal(removed.length,1,'Fault injection must be inactive when any isolation gate is absent');
    }
  }
  console.log('Settings isolated fault adapter passed: dev/E2E/bundle/flag/run gates, namespaced key inventory, one-shot failure and retry.');
  console.log('Settings UI harness passed: cancel/short hold/blur/stale Alert, duplicate events, pending, truthful success, failure/retry, navigation recovery and revisit. Controlled hooks; not a mounted renderer.');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
