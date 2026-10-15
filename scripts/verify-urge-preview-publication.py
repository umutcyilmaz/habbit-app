#!/usr/bin/env python3
"""Build/check the explicit Phase 11.8.1 publication proposal. Never stages files."""
from pathlib import Path
from html.parser import HTMLParser
import argparse
import hashlib
import json
import re
import subprocess
from urllib.parse import unquote

root = Path(__file__).resolve().parent.parent
qa = root / 'docs/qa/urge-control'
args = argparse.ArgumentParser()
args.add_argument('--write', action='store_true', help='Generate the explicit file list and size manifest before checking')
write = args.parse_args().write

def read(name):
    return json.loads((qa / name).read_text())

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

assets = read('publication-assets.json')
selected = {row['file'] for row in assets['screenshots']}
assert 16 <= len(selected) <= 24 and len(selected) == len(assets['screenshots'])
assert selected == {row['file'] for row in read('screenshot-hashes.json')}
for row in read('screenshot-hashes.json'):
    path = qa / row['file']
    assert path.parent == qa and path.suffix == '.png'
    assert digest(path) == row['sha256'] and path.stat().st_size == row['bytes'], path
    asset = next(asset for asset in assets['screenshots'] if asset['file'] == row['file'])
    assert asset['sha256'] == row['sha256'] and asset['bytes'] == row['bytes']

files = {'package.json', 'src/app/providers/AppProviders.tsx', 'app/debug/urge-control.tsx',
         'docs/phase11-8-1-urge-ui-qa.md', 'docs/phase11-8-2-urge-integration-proposal.md',
         'scripts/build-urge-preview-gallery.py', 'scripts/render-urge-reference.cjs',
         'scripts/snapshot-urge-preview-storage.py', 'scripts/verify-bloom-urge-preview.cjs',
         'scripts/verify-urge-preview-publication.py'}
for pattern in ['src/features/urge-control/preview/*', '.maestro/urge-preview*.yaml']:
    files.update(str(path.relative_to(root)) for path in root.glob(pattern) if path.is_file())
metadata = ['.gitignore', 'README.md', 'index.html', 'manual-inspection.json',
            'production-regression-evidence.json', 'production-source-preservation.json',
            'screenshot-hashes.json', 'storage-preservation.json', 'test-results.json',
            'publication-assets.json', 'publication-scope.md', 'publication-verification.json',
            'review-files.txt', 'review-manifest.json', 'publication-typecheck.log',
            'publication-verify-urge-preview.log']
logs = {row['log'] for row in read('test-results.json')['automaticChecks'] + read('test-results.json')['nativeRuns']}
assert all(re.fullmatch(r'[a-z0-9-]+\.log', name) for name in logs)
files.update('docs/qa/urge-control/' + name for name in set(metadata) | logs | selected)
files = sorted(files)
if write:
    (qa / 'review-files.txt').write_text('\n'.join(files) + '\n')
    manifest = {'proposalOnly': True, 'changedFileCount': len(files),
                'textFileCount': len(files) - len(selected), 'imageCount': len(selected),
                'totalBytes': 0, 'imageBytes': assets['publishedBytes'],
                'originalImageCount': assets['rawCaptureCount'], 'originalImageBytes': assets['rawBytes'],
                'localOnlyImageCount': assets['localOnlyCaptureCount'],
                'sizeMeaning': 'Working-tree byte sum; not Git pack, ZIP or transfer size',
                'noStagingCommitOrPush': True,
                'excluded': ['53 unselected PNGs retained locally', 'local-archive/',
                             'per-key storage hash dumps', 'raw storage payloads', 'secrets',
                             'docs/patches/', '.local-design/', 'unrelated files and logs']}
    for _ in range(12):
        (qa / 'review-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
        total = sum((root / name).stat().st_size for name in files)
        if total == manifest['totalBytes']:
            break
        manifest['totalBytes'] = total
    else:
        raise AssertionError('Size metadata failed to converge')
assert (qa / 'review-files.txt').read_text().splitlines() == files
assert all((root / name).is_file() for name in files)
assert not any(name.startswith(('docs/patches/', '.local-design/')) or '/local-archive/' in name for name in files)
assert not any(re.search(r'/(?:narrow-.*storage|storage-(?:before|after))', name) for name in files)
manifest = read('review-manifest.json')
assert manifest['totalBytes'] == sum((root / name).stat().st_size for name in files)
assert manifest['imageCount'] == len(selected) and manifest['changedFileCount'] == len(files)
ignored = subprocess.run(['git', 'check-ignore', '--stdin'], input='\n'.join(files)+'\n', cwd=root, text=True, capture_output=True)
assert not ignored.stdout.strip(), ignored.stdout
available = set(files) | set(subprocess.check_output(['git', 'ls-files'], cwd=root, text=True).splitlines())

def check_link(origin, target):
    if target.startswith(('https:', 'http:', 'mailto:', '#')):
        return
    path = (origin.parent / unquote(target.split('#')[0])).resolve()
    assert path.is_file() and str(path.relative_to(root)) in available, (origin, target)

class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.images = []
    def handle_starttag(self, tag, attrs):
        for key, value in attrs:
            if key in ('href', 'src') and value:
                check_link(qa / 'index.html', value)
                if tag == 'img' and key == 'src':
                    self.images.append(value)

parser = Links()
parser.feed((qa / 'index.html').read_text())
assert set(parser.images) == selected and len(parser.images) == len(selected)
for name in files:
    if name.endswith('.md'):
        origin = root / name
        for target in re.findall(r'\[[^\]]+\]\(([^)]+)\)', origin.read_text()):
            check_link(origin, target)
for finding in read('manual-inspection.json')['findings']:
    assert set(finding['files']) <= selected
archive = qa / 'local-archive'
if (archive / 'original-screenshot-hashes.json').exists():
    original = json.loads((archive / 'original-screenshot-hashes.json').read_text())
    assert len(original) == 75
    for row in original:
        assert digest(qa / row['file']) == row['sha256'], row['file']
    excluded = {row['file'] for row in original} - selected
    result = subprocess.run(['git', 'check-ignore', '--stdin'], cwd=qa, input='\n'.join(sorted(excluded))+'\n', text=True, capture_output=True)
    assert set(result.stdout.splitlines()) == excluded
if (archive / 'approved-source-hashes.json').exists():
    protected = json.loads((archive / 'approved-source-hashes.json').read_text())
    assert all(digest(root / name) == expected for name, expected in protected.items()), 'Approved runtime/tests/proposal changed'
subprocess.run(['git', 'diff', '--check'], cwd=root, check=True)
assert not subprocess.check_output(['git', 'diff', '--cached', '--name-only'], cwd=root), 'Index must remain unchanged and empty'
print(json.dumps({key: manifest[key] for key in ['changedFileCount', 'textFileCount', 'imageCount', 'totalBytes', 'imageBytes', 'localOnlyImageCount']}, indent=2))
print('PASS: published links/hashes/list/size; all 75 originals and approved runtime/tests/proposal preserved; no staging.')
