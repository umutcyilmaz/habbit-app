#!/usr/bin/env python3
"""Read-only comparison. Emit hashes, never user's raw stored values."""
import argparse, hashlib, json
from pathlib import Path
parser=argparse.ArgumentParser();parser.add_argument('--storage-dir',required=True);parser.add_argument('--baseline-manifest',required=True);parser.add_argument('--baseline-files',required=True);parser.add_argument('--owned-prefix',required=True);parser.add_argument('--output',required=True);args=parser.parse_args()
folder=Path(args.storage_dir);before=json.loads(Path(args.baseline_manifest).read_text());baseline_files=json.loads(Path(args.baseline_files).read_text());after=json.loads((folder/'manifest.json').read_text())
def digest(key,value,old=False):
    name=hashlib.md5(key.encode()).hexdigest()
    if value is None:return baseline_files[name] if old else hashlib.sha256((folder/name).read_bytes()).hexdigest()
    return hashlib.sha256(value.encode()).hexdigest()
a={k:digest(k,v,True) for k,v in before.items()};b={k:digest(k,v) for k,v in after.items()};changed=[k for k in a if a[k]!=b.get(k)];added=sorted(set(b)-set(a));unexpected=[k for k in added if not k.startswith(args.owned_prefix)]
result={'baselineKeyCount':len(a),'finalKeyCount':len(b),'baselineKeyHashes':a,'finalOriginalKeyHashes':{k:b.get(k) for k in a},'changedOrRemovedOriginalKeys':changed,'addedKeys':added,'unexpectedNewKeys':unexpected,'originalKeysPreserved':not changed,'newKeysConfinedToOwnedQaNamespace':not unexpected}
Path(args.output).write_text(json.dumps(result,indent=2)+'\n');print('Original keys preserved:',not changed,'count:',len(a));print('New keys confined to current QA namespace:',not unexpected,'count:',len(added));raise SystemExit(bool(changed or unexpected))
