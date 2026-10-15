"""Read-only E2E Simulator storage hashes; never export stored record values."""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

device, destination = sys.argv[1:]
app = 'com.umutcyilmaz.bloom.e2e'
container = Path(subprocess.check_output(['xcrun', 'simctl', 'get_app_container', device, app, 'data'], text=True).strip())
values = {}
for manifest in container.glob('Library/Application Support/*/RCTAsyncLocalStorage_V1/manifest.json'):
    for key, inline in json.loads(manifest.read_text()).items():
        raw = inline.encode() if inline is not None else (manifest.parent / hashlib.md5(key.encode()).hexdigest()).read_bytes()
        values[key] = hashlib.sha256(raw).hexdigest()
Path(destination).write_text(json.dumps(values, indent=2) + '\n')
print('E2E storage key count:', len(values))
