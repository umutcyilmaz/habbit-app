"""Hash existing Simulator AsyncStorage values without emitting their contents."""
import hashlib, json, subprocess, sys
from pathlib import Path
result = {}
for app in ['com.umutcyilmaz.bloom', 'com.umutcyilmaz.bloom.e2e']:
    container = Path(subprocess.check_output(['xcrun', 'simctl', 'get_app_container', 'booted', app, 'data'], text=True).strip())
    values = {}
    for manifest in container.glob('Library/Application Support/*/RCTAsyncLocalStorage_V1/manifest.json'):
        for key, inline in json.loads(manifest.read_text()).items():
            raw = inline.encode() if inline is not None else (manifest.parent / hashlib.md5(key.encode()).hexdigest()).read_bytes()
            values[key] = hashlib.sha256(raw).hexdigest()
    result[app] = values
Path(sys.argv[1]).write_text(json.dumps(result, indent=2) + '\n')
print('Storage snapshot:', {app: len(values) for app, values in result.items()})
