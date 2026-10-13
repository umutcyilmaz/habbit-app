"""Read-only per-key hashes for Simulator preservation checks; never export values."""
import hashlib, json, pathlib, subprocess, sys
out = {}
for bundle in ['com.umutcyilmaz.bloom', 'com.umutcyilmaz.bloom.e2e']:
    container = subprocess.check_output(['xcrun','simctl','get_app_container','booted',bundle,'data'],text=True).strip()
    root = pathlib.Path(container)/'Library'/'Application Support'/bundle/'RCTAsyncLocalStorage_V1'
    manifest = json.loads((root/'manifest.json').read_text())
    entries = {}
    for key, value in manifest.items():
        raw = value.encode() if isinstance(value,str) else (root/hashlib.md5(key.encode()).hexdigest()).read_bytes()
        entries[key] = hashlib.sha256(raw).hexdigest()
    out[bundle] = entries
pathlib.Path(sys.argv[1]).write_text(json.dumps(out,indent=2))
print({bundle:len(entries) for bundle,entries in out.items()})
