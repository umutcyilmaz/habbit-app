"""Read-only Simulator storage audit. Call before/after with E2E app container."""
from pathlib import Path
import sys, json, hashlib
container = Path(sys.argv[2])
folder = container/'Library/Application Support/com.umutcyilmaz.bloom.e2e/RCTAsyncLocalStorage_V1'
manifest = json.loads((folder/'manifest.json').read_text()) if (folder/'manifest.json').exists() else {}
values = {}
for key, value in manifest.items():
    raw = value.encode() if isinstance(value,str) and value else (folder/hashlib.md5(key.encode()).hexdigest()).read_bytes()
    values[key] = {'sha256':hashlib.sha256(raw).hexdigest(), 'value':json.loads(raw) if key.endswith('bloom.localState.v8') else None}
baseline = Path('/private/tmp/bloom-sounds-storage-before.json')
if sys.argv[1] == 'before':
    baseline.write_text(json.dumps(values)); print('Read-only storage baseline:',len(values),'keys')
elif sys.argv[1] == 'session-before':
    key = 'bloom.e2e.kegel.qa_sounds_1142_20261013_f9d42.bloom.localState.v8'
    Path('/private/tmp/bloom-sounds-session-before.json').write_text(json.dumps(values[key]['value']))
    print('Saved read-only audio-session baseline')
else:
    before = json.loads(baseline.read_text())
    prefix = 'bloom.e2e.kegel.qa_sounds_1142_20261013_f9d42.'
    assert all(k in values and values[k]['sha256']==v['sha256'] for k,v in before.items() if not k.startswith(prefix))
    key=prefix+'bloom.localState.v8'
    state_before = json.loads(Path('/private/tmp/bloom-sounds-session-before.json').read_text())
    assert values[key]['value'] == state_before, 'Audio QA changed persistent state'
    state=state_before['state']
    result={'existingStorageKeysUnchanged':len([k for k in before if not k.startswith(prefix)]),'qaEntireEnvelopeUnchanged':True,'kegelSessionsPreserved':len(state['kegel']['sessions']),'kegelRepetitionsPreserved':sum(s['completedRepetitions'] for s in state['kegel']['sessions']),'libraryPreserved':state['library']}
    Path('docs/qa/relaxing-sounds/state-audit.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result))
