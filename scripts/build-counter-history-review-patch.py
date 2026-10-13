"""Package this phase's text changes and check against an isolated HEAD archive."""
from pathlib import Path
import json, re, subprocess, tempfile
root = Path(__file__).resolve().parents[1]
qa = root/'docs/qa/counter-history'
tracked = subprocess.check_output(['git','diff','--name-only','HEAD'],cwd=root,text=True).splitlines()
untracked = subprocess.check_output(['git','ls-files','--others','--exclude-standard'],cwd=root,text=True).splitlines()
script_names = {'scripts/build-counter-history-gallery.py','scripts/build-counter-history-review-patch.py','scripts/extract-counter-reference.cjs','scripts/run-bloom-counter-history-verification.cjs','scripts/snapshot-counter-history-storage.py','scripts/verify-bloom-counter-history.ts'}
owned = []
for name in untracked:
    if name == 'docs/phase11-6-2-counter-history-qa.md' or name.startswith(('src/features/home/history/','src/features/content-free/screens/ContentFreeActivity.tsx','.maestro/counter-history-','docs/qa/counter-history/')) or name in script_names:
        if Path(name).suffix in {'.ts','.tsx','.cjs','.py','.yaml','.md','.html','.json'} and name != 'docs/qa/counter-history/review-patch-check.json':
            owned.append(name)
patch = subprocess.check_output(['git','diff','HEAD','--',*tracked],cwd=root,text=True)
for name in owned:
    contents = (root/name).read_text()
    assert '\0' not in contents, name
    lines = contents.splitlines()
    patch += f'diff --git a/{name} b/{name}\nnew file mode 100644\n--- /dev/null\n+++ b/{name}\n@@ -0,0 +1,{len(lines)} @@\n' + ''.join('+'+line+'\n' for line in lines)
patchpath = root/'docs/patches/phase11-6-2-counter-history-text-only.patch'
patchpath.write_text(patch)
assert not re.search(r'^(?:GIT binary patch|Binary files .+ differ)$',patch,re.MULTILINE)
snapshot = Path(tempfile.mkdtemp(prefix='bloom-counter-history-review-',dir='/private/tmp'))
archive = snapshot/'head.tar'
with archive.open('wb') as handle:
    subprocess.run(['git','archive','HEAD'],cwd=root,stdout=handle,check=True)
subprocess.run(['tar','-xf',str(archive),'-C',str(snapshot)],check=True)
subprocess.run(['git','apply','--check','--whitespace=error',str(patchpath)],cwd=snapshot,check=True)
for link in re.findall(r'(?:src|href)="([^"]+)"',(qa/'index.html').read_text()):
    assert (qa/link).resolve().exists(),link
(qa/'review-patch-check.json').write_text(json.dumps({'base_head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'snapshot':str(snapshot),'text_files':len(tracked)+len(owned),'patch_bytes':patchpath.stat().st_size,'binary_diff':False,'git_apply_check':'passed','gallery_links':'passed'},indent=2)+'\n')
print('Review patch whitespace/applicability and gallery links passed:',len(tracked)+len(owned),'text files;',patchpath.stat().st_size,'bytes.')
