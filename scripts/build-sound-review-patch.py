"""Build/apply-check a text-only review patch without staging or committing."""
from pathlib import Path
import subprocess, tempfile, tarfile, io
root = Path(__file__).resolve().parents[1]
base = '65d65223dd9bd2e83dffefd14765cca6e285bb5b'
assert subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==base
tracked = subprocess.check_output(['git','diff','--name-only',base],cwd=root,text=True).splitlines()
new = subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=root,text=True).splitlines()
scoped = ['.maestro/relaxing-sounds.yaml','app/bloom/library/sound.tsx','docs/audio-sources.md','docs/phase11-4-2-relaxing-sounds-qa.md']
new = [p for p in new if p in scoped or p.startswith(('src/features/relaxing-sounds/','docs/qa/relaxing-sounds/')) or (p.startswith('scripts/') and ('sound' in p or 'audio' in p))]
paths = []
for p in sorted(set(tracked+new)):
    data = (root/p).read_bytes()
    if '\x00'.encode() in data: continue
    try: data.decode('utf8')
    except UnicodeDecodeError: continue
    if Path(p).suffix.lower() in {'.wav','.mp3','.png','.jpg','.jpeg','.webp','.m4a'}: continue
    paths.append(p)
patch = subprocess.check_output(['git','diff',base,'--',*[p for p in paths if p in tracked]],cwd=root)
for p in paths:
    if p in tracked: continue
    r = subprocess.run(['git','diff','--no-index','--','/dev/null',p],cwd=root,stdout=subprocess.PIPE)
    assert r.returncode == 1
    patch += r.stdout
assert b'\nGIT binary patch\n' not in patch
output = root/'docs/patches/phase11-4-2-relaxing-sounds-text-only.patch'
output.parent.mkdir(exist_ok=True);output.write_bytes(patch)
with tempfile.TemporaryDirectory(prefix='bloom-sound-review-',dir='/private/tmp') as folder:
    archive = subprocess.check_output(['git','archive',base],cwd=root)
    with tarfile.open(fileobj=io.BytesIO(archive)) as t: t.extractall(folder)
    subprocess.run(['git','apply','--check',str(output)],cwd=folder,check=True)
    subprocess.run(['git','apply',str(output)],cwd=folder,check=True)
    assert all((Path(folder)/p).read_bytes()==(root/p).read_bytes() for p in paths)
print(f'Text-only patch verified: {len(paths)} files, {len(patch)} bytes; HEAD unchanged; no index changes.')
